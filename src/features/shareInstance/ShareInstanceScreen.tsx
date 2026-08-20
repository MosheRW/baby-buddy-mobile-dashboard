import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ActionButton, AppText, Card, TextField, ToggleSwitch } from '../../components';
import { ChevronLeftGlyph } from '../../components/glyphs';
import { fontSize, spacing, useTheme, useThemedStyles, type AppTheme } from '../../theme';
import type { MainStackParamList } from '../../navigation/types';
import { useAuthStore, useUiStore } from '../../stores';
import { useFieldChain } from '../../hooks/useFieldChain';
import { sanitizeUsername } from '../../lib/userName';
import { signInWithPassword } from '../../api/auth';
import { errorMessage, request } from '../../api/client';
import { profileResponseSchema } from '../../api/schemas';
import {
  AdminWebError,
  NotAdminError,
  createToken,
  createUser,
  listUserTokens,
  listUsers,
  type AdminUser,
} from '../../api/adminWeb';
import { toJoinMode, type JoinPayload } from '../../lib/joinCode';
import { JoinQrView } from './JoinQrView';

/** A caregiver created in this session — we hold the password so we can (re)show its QR. */
interface CreatedCaregiver {
  username: string;
  password: string;
}

/** How long "don't warn me again" silences the admin-grant warning. */
const STAFF_WARNING_SUPPRESS_MS = 15 * 60 * 1000;

/**
 * Module scope on purpose: reading the clock is impure, so it must not happen in
 * the component body. This is only ever called from an event handler.
 */
function isStaffWarningSuppressed(until: number | null): boolean {
  return until !== null && Date.now() < until;
}

/** A friendly, reasonably-unguessable default password for a new caregiver. */
function generatePassword(): string {
  const words = ['sun', 'moon', 'star', 'leaf', 'wave', 'pine', 'dawn', 'fern', 'rain', 'sky'];
  const w = () => words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${w()}-${w()}-${n}`;
}

/**
 * Admin-only caregiver sharing (Issue #34). Managing users drives Baby Buddy's
 * staff-only **web** pages, which authenticate by session cookie — so the screen
 * first re-authenticates the admin (username + password) to seat that cookie and
 * confirm staff status, then lists/creates users and builds join QR codes.
 *
 * The unlock state is in-memory only: closing the screen forgets it, and no
 * caregiver password is persisted anywhere.
 */
export function ShareInstanceScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const session = useAuthStore((s) => s.session);

  // 'checking' probes for an existing admin session cookie (from a password
  // app-login); 'ready' means we have one and can manage users; 'unlock' asks
  // for the password only when we don't (e.g. an API-key app-login has no cookie).
  const [phase, setPhase] = useState<'checking' | 'unlock' | 'ready'>('checking');
  const [adminUser, setAdminUser] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  // username -> API token, read from the Django admin authtoken page. Lets us
  // build a token QR for any existing user without knowing their password.
  const [tokens, setTokens] = useState<Record<string, string>>({});

  const [usersOpen, setUsersOpen] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  // Staff-grant warning: shown before creating an admin unless suppressed.
  const [staffWarnOpen, setStaffWarnOpen] = useState(false);
  const [staffWarnDontAsk, setStaffWarnDontAsk] = useState(false);
  const staffWarningHiddenUntil = useUiStore((s) => s.staffWarningHiddenUntil);
  const suppressStaffWarning = useUiStore((s) => s.suppressStaffWarning);
  const [newName, setNewName] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newStaff, setNewStaff] = useState(true);
  const [newPassword, setNewPassword] = useState(() => generatePassword());
  const [created, setCreated] = useState<CreatedCaregiver[]>([]);
  // The QR now opens in a modal; `payload` non-null means the modal is open.
  const [payload, setPayload] = useState<JoinPayload | null>(null);
  const [caption, setCaption] = useState('');
  // The user whose QR is currently shown, so its row can be marked.
  const [selected, setSelected] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mode the shared QR should carry, so the joining device connects the same way
  // (Baby Buddy vs Home Assistant) the sharer did. Offline can't reach here.
  const joinMode = toJoinMode(session?.mode ?? 'babybuddy');

  const refreshTokens = async () => {
    if (!session) return;
    try {
      const list = await listUserTokens(session);
      setTokens(Object.fromEntries(list.map((u) => [u.username, u.token])));
    } catch {
      // Admin-token access is a bonus (needs superuser); its absence just means
      // token QRs aren't offered for existing users. Not fatal.
    }
  };

  const refreshUsers = async () => {
    if (!session) return;
    try {
      setUsers(await listUsers(session));
    } catch {
      // A failed list isn't fatal to the add flow; leave the last-known list.
    }
    await refreshTokens();
  };

  // Skip the unlock ceremony when the app already holds a valid admin session
  // cookie (the common case after a username+password app-login): try the
  // staff-only user list, and only fall back to asking for the password if the
  // server bounces us (no cookie — e.g. an API-key login).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!session) return;
      try {
        const list = await listUsers(session);
        if (!cancelled) {
          setUsers(list);
          setPhase('ready');
          void refreshTokens();
        }
      } catch {
        if (!cancelled) setPhase('unlock');
      }
    })();
    return () => {
      cancelled = true;
    };
    // Probe once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unlock = async () => {
    if (!session) return;
    setError(null);
    const user = adminUser.trim();
    if (!user || !adminPassword) {
      setError(t('share.enterAdminCredentials'));
      return;
    }
    setBusy(true);
    try {
      const admin = await signInWithPassword(session.mode, session.baseUrl, user, adminPassword);
      if (!admin.isStaff) {
        setError(t('share.notAdmin'));
        return;
      }
      setPhase('ready');
      setAdminPassword('');
      await refreshUsers();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const shareOwnLogin = async () => {
    if (!session) return;
    setError(null);
    setBusy(true);
    try {
      // Read the real API key from /api/profile over the session cookie — the
      // stored session.token can be wrong (e.g. a URL pasted into the key field),
      // so never trust it for a QR that has to authenticate.
      const profile = await request(profileResponseSchema, {
        baseUrl: session.baseUrl,
        path: 'api/profile',
      });
      const token = profile.api_key ?? session.token;
      setSelected(null);
      setPayload({ kind: 'token', url: session.baseUrl, token, mode: joinMode });
      setCaption(t('share.qrCaptionOwn'));
    } catch {
      setSelected(null);
      setPayload({ kind: 'token', url: session.baseUrl, token: session.token, mode: joinMode });
      setCaption(t('share.qrCaptionOwn'));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Entry point for the Create button and the last field's "done" key. Granting
   * admin is the one irreversible-ish choice here, so it gets a confirmation
   * step — suppressible for 15 minutes when adding several caregivers at once.
   */
  const submitCaregiver = () => {
    if (newStaff && !isStaffWarningSuppressed(staffWarningHiddenUntil)) {
      setStaffWarnDontAsk(false);
      setStaffWarnOpen(true);
      return;
    }
    void addCaregiver();
  };

  const confirmStaffAndCreate = () => {
    if (staffWarnDontAsk) suppressStaffWarning(STAFF_WARNING_SUPPRESS_MS);
    setStaffWarnOpen(false);
    void addCaregiver();
  };

  const addCaregiver = async () => {
    if (!session) return;
    setError(null);
    const username = sanitizeUsername(newName);
    if (!username || !newPassword) {
      setError(t('share.enterCaregiver'));
      return;
    }
    const password = newPassword;
    setBusy(true);
    try {
      await createUser(session, {
        username,
        password,
        firstName: newFirstName.trim() || undefined,
        lastName: newLastName.trim() || undefined,
        isStaff: newStaff,
      });
      setCreated((prev) => [{ username, password }, ...prev.filter((c) => c.username !== username)]);

      // Force-create the user's API token so a token QR is possible immediately
      // (Baby Buddy would otherwise make it only on the user's first API call).
      // This is mandatory for Home Assistant, which can only join by token.
      let token: string | undefined;
      const list = await listUsers(session);
      setUsers(list);
      const createdUser = list.find((u) => u.username === username);
      if (createdUser) {
        try {
          await createToken(session, createdUser.id);
        } catch {
          // Non-fatal: the token may already exist, or we lack admin-add rights.
        }
      }
      const tokenList = await listUserTokens(session);
      const map = Object.fromEntries(tokenList.map((u) => [u.username, u.token]));
      setTokens(map);
      token = map[username];

      setNewName('');
      setNewFirstName('');
      setNewLastName('');
      setNewPassword(generatePassword());
      setAddOpen(false);
      setSelected(username);
      setCaption(t('share.qrCaptionCaregiver', { name: username }));

      if (token) {
        setPayload({ kind: 'token', url: session.baseUrl, token, mode: joinMode });
      } else if (joinMode === 'homeassistant') {
        // HA can't use a credentials QR — without a token we can't share.
        setSelected(null);
        setError(t('share.tokenCreateFailed'));
      } else {
        // Direct Baby Buddy can fall back to a credentials QR (password login works).
        setPayload({ kind: 'credentials', url: session.baseUrl, username, password, mode: joinMode });
      }
    } catch (err) {
      if (err instanceof NotAdminError) setError(t('share.notAdmin'));
      else if (err instanceof AdminWebError) setError(err.message);
      else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // QR for an existing user: a token QR from the admin authtoken page when
  // available, else a credentials QR for a caregiver we created this session
  // (whose password we still hold). Returns false when neither is possible.
  // A credentials QR is only usable on direct Baby Buddy (password login); Home
  // Assistant joins by token only, so there a user is shareable only with a token.
  const canShowQr = (username: string) =>
    Boolean(tokens[username]) ||
    (joinMode === 'babybuddy' && created.some((c) => c.username === username));

  const showUserQr = (username: string) => {
    if (!session) return;
    const token = tokens[username];
    if (token) {
      setPayload({ kind: 'token', url: session.baseUrl, token, mode: joinMode });
    } else if (joinMode === 'babybuddy') {
      const c = created.find((cc) => cc.username === username);
      if (!c) return;
      setPayload({
        kind: 'credentials',
        url: session.baseUrl,
        username,
        password: c.password,
        mode: joinMode,
      });
    } else {
      return;
    }
    setError(null);
    setSelected(username);
    setCaption(t('share.qrCaptionCaregiver', { name: username }));
  };

  // Closing the QR modal also clears the row highlight — the mark tracks "whose
  // QR is on screen", so it must not outlive the modal.
  const closeQr = () => {
    setPayload(null);
    setSelected(null);
  };

  // Return-key navigation. Declared after the submit handlers they call.
  // Add form: username → first → last → password → submit.
  const chain = useFieldChain(4, submitCaregiver);
  // Unlock form: username → password → unlock.
  const unlockChain = useFieldChain(2, () => void unlock());

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={() => navigation.goBack()}
          hitSlop={8}
        >
          <ChevronLeftGlyph size={24} color={colors.textPrimary} />
        </Pressable>
        <AppText size={fontSize.screenTitle} weight="800">
          {t('share.title')}
        </AppText>
      </View>

      {/* `padding` on Android too: with edge-to-edge the window doesn't always
          resize, which left the focused field behind the keyboard. */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          // Keeps the focused field visible as the keyboard opens.
          automaticallyAdjustKeyboardInsets
        >
          {phase === 'checking' ? (
            <Card style={styles.section}>
              <AppText size={fontSize.bodySm} weight="600" color={colors.textMuted}>
                {t('share.checking')}
              </AppText>
            </Card>
          ) : phase === 'unlock' ? (
            <Card style={styles.section}>
              <AppText size={fontSize.bodySm} weight="800">
                {t('share.unlockTitle')}
              </AppText>
              <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
                {t('share.unlockHint')}
              </AppText>
              <TextField
                {...unlockChain.fieldProps(0)}
                label={t('login.username')}
                autoCapitalize="none"
                autoCorrect={false}
                value={adminUser}
                onChangeText={setAdminUser}
              />
              <TextField
                {...unlockChain.fieldProps(1)}
                label={t('login.password')}
                placeholder={t('login.passwordPlaceholder')}
                secureTextEntry
                value={adminPassword}
                onChangeText={setAdminPassword}
              />
              <ActionButton
                label={busy ? t('login.connecting') : t('share.unlock')}
                fullWidth
                disabled={busy}
                onPress={() => void unlock()}
              />
            </Card>
          ) : (
            <>
              {/* 1. All existing users — the one whose QR is open is marked. */}
              <Card style={styles.section}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: usersOpen }}
                  onPress={() => setUsersOpen((o) => !o)}
                  android_ripple={{ color: colors.card }}
                  hitSlop={8}
                  style={styles.headerRow}
                >
                  <AppText size={fontSize.bodySm} weight="800">
                    {t('share.usersTitle')}
                  </AppText>
                  <AppText size={fontSize.body} weight="800" color={colors.accent}>
                    {usersOpen ? '–' : '+'}
                  </AppText>
                </Pressable>
                {!usersOpen ? null : users.length === 0 ? (
                  <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
                    {t('share.noUsers')}
                  </AppText>
                ) : (
                  users.map((u) => {
                    const hasQr = canShowQr(u.username);
                    const isSelected = selected === u.username;
                    return (
                      <Pressable
                        key={u.id}
                        accessibilityRole="button"
                        disabled={!hasQr}
                        onPress={() => showUserQr(u.username)}
                        style={styles.row}
                      >
                        <View style={styles.rowLeft}>
                          {isSelected ? <View style={styles.marker} /> : null}
                          <AppText size={fontSize.body} weight="700">
                            {u.username}
                          </AppText>
                        </View>
                        {hasQr ? (
                          <AppText size={fontSize.metaSm} weight="700" color={colors.accent}>
                            {t('share.showQr')}
                          </AppText>
                        ) : null}
                      </Pressable>
                    );
                  })
                )}
                {usersOpen ? (
                  <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
                    {t('share.usersTokenHint')}
                  </AppText>
                ) : null}
              </Card>

              {/* 2. Add a new user — collapsible form. */}
              <Card style={styles.section}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: addOpen }}
                  onPress={() => setAddOpen((o) => !o)}
                  android_ripple={{ color: colors.card }}
                  hitSlop={8}
                  style={styles.headerRow}
                >
                  <AppText size={fontSize.bodySm} weight="800">
                    {t('share.addTitle')}
                  </AppText>
                  <AppText size={fontSize.body} weight="800" color={colors.accent}>
                    {addOpen ? '–' : '+'}
                  </AppText>
                </Pressable>
                {addOpen ? (
                  <>
                    <TextField
                      {...chain.fieldProps(0)}
                      label={t('share.caregiverName')}
                      placeholder={t('share.caregiverNamePlaceholder')}
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={newName}
                      // Django usernames can't hold spaces — fold them to '_'
                      // as the caregiver types, so what they see is what is saved.
                      onChangeText={(text) => setNewName(text.replace(/\s+/g, '_'))}
                    />
                    <TextField
                      {...chain.fieldProps(1)}
                      label={t('share.caregiverFirstName')}
                      autoCapitalize="words"
                      autoCorrect={false}
                      value={newFirstName}
                      onChangeText={setNewFirstName}
                    />
                    <TextField
                      {...chain.fieldProps(2)}
                      label={t('share.caregiverLastName')}
                      autoCapitalize="words"
                      autoCorrect={false}
                      value={newLastName}
                      onChangeText={setNewLastName}
                    />
                    <TextField
                      {...chain.fieldProps(3)}
                      label={t('share.caregiverPassword')}
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={newPassword}
                      onChangeText={setNewPassword}
                    />
                    <View style={styles.row}>
                      <View style={styles.toggleText}>
                        <AppText size={fontSize.body} weight="700">
                          {t('share.staffToggle')}
                        </AppText>
                        <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
                          {t('share.staffHint')}
                        </AppText>
                      </View>
                      <ToggleSwitch
                        value={newStaff}
                        onValueChange={setNewStaff}
                        accessibilityLabel={t('share.staffToggle')}
                      />
                    </View>
                    <ActionButton
                      label={busy ? t('login.connecting') : t('share.addCaregiver')}
                      fullWidth
                      disabled={busy}
                      onPress={submitCaregiver}
                    />
                  </>
                ) : null}
              </Card>

              {/* 3. Share my own sign-in. */}
              <Card style={styles.section}>
                <AppText size={fontSize.bodySm} weight="800">
                  {t('share.ownLoginTitle')}
                </AppText>
                <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
                  {t('share.ownLoginHint')}
                </AppText>
                <ActionButton
                  label={t('share.showOwnQr')}
                  variant="neutral"
                  fullWidth
                  disabled={busy}
                  onPress={() => void shareOwnLogin()}
                />
              </Card>
            </>
          )}

          {error ? (
            <View style={styles.error}>
              <AppText size={fontSize.metaSm} weight="700" color={colors.danger}>
                {error}
              </AppText>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* QR shown in a modal so it's front-and-centre, not buried in the scroll. */}
      {/* Granting admin is rarely needed — confirm it, with an opt-out for the
          case where several admins are being added in one sitting. */}
      <Modal
        visible={staffWarnOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setStaffWarnOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setStaffWarnOpen(false)}>
          <Pressable onPress={() => {}} style={styles.modalCard}>
            <Card style={styles.section}>
              <AppText size={fontSize.bodySm} weight="800">
                {t('share.staffWarnTitle')}
              </AppText>
              <AppText size={fontSize.bodySm} weight="600" color={colors.textMuted}>
                {t('share.staffWarnBody')}
              </AppText>
              <View style={styles.row}>
                <View style={styles.toggleText}>
                  <AppText size={fontSize.metaSm} weight="700">
                    {t('share.staffWarnDontAsk')}
                  </AppText>
                </View>
                <ToggleSwitch
                  value={staffWarnDontAsk}
                  onValueChange={setStaffWarnDontAsk}
                  accessibilityLabel={t('share.staffWarnDontAsk')}
                />
              </View>
              <ActionButton
                label={t('share.staffWarnContinue')}
                fullWidth
                onPress={confirmStaffAndCreate}
              />
              <ActionButton
                label={t('common.cancel')}
                variant="neutral"
                fullWidth
                onPress={() => setStaffWarnOpen(false)}
              />
            </Card>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={payload !== null} transparent animationType="fade" onRequestClose={closeQr}>
        <Pressable style={styles.backdrop} onPress={closeQr}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {payload ? <JoinQrView payload={payload} caption={caption} /> : null}
            <ActionButton label={t('common.close')} variant="neutral" fullWidth onPress={closeQr} />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

type Props = NativeStackScreenProps<MainStackParamList, 'ShareInstance'>;

const makeStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flex: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      paddingHorizontal: spacing['2xl'],
      paddingTop: spacing.lg,
      paddingBottom: spacing.lg,
    },
    content: {
      padding: spacing['2xl'],
      gap: spacing['2xl'],
    },
    section: {
      gap: spacing.lg,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.lg,
      paddingVertical: spacing.xs,
    },
    // The whole collapsible header is the touch target, so give it real height.
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.lg,
      paddingVertical: spacing.sm,
    },
    toggleText: {
      flex: 1,
      gap: spacing.xs,
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flexShrink: 1,
    },
    marker: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.accent,
    },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing['2xl'],
    },
    modalCard: {
      width: '100%',
      maxWidth: 360,
      gap: spacing.lg,
    },
    error: {
      padding: spacing['2xl'],
      borderRadius: 12,
      backgroundColor: colors.card,
    },
  });
