import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActionButton, AppText, SegmentedToggle, TextField } from '../../components';
import { fontSize, radii, spacing, useTheme, useThemedStyles, type AppTheme } from '../../theme';
import type { MainStackParamList } from '../../navigation/types';
import type { LoginMode } from '../../api/types';
import { useAuthStore } from '../../stores';
import { useLocalDataStore } from '../../data/localDataStore';
import { PasswordLoginUnavailable, signInWithPassword, signInWithToken } from '../../api/auth';
import { errorMessage, normalizeBaseUrl } from '../../api/client';
import { USE_MOCK_DATA } from '../../data/dataSource';
import { useFieldChain } from '../../hooks/useFieldChain';
import { DateTimeField } from '../logEntry/DateTimeField';

/** Author name stamped on entries logged in offline mode (single-user). */
const LOCAL_USER = 'Me';

/**
 * Sign-in. Baby Buddy exposes no password→token endpoint, so the password
 * fields drive a web-session bootstrap that reads the user's API key off
 * `/api/profile`. Whenever that path can't work — an unexpected login page, a
 * server that won't return the key, or the web build where cookies are blocked
 * cross-origin — the screen falls back to asking for the key directly.
 */
export function LoginScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const signIn = useAuthStore((s) => s.signIn);
  const localChildren = useLocalDataStore((s) => s.children);
  const localHydrated = useLocalDataStore((s) => s.hydrated);
  const addChild = useLocalDataStore((s) => s.addChild);
  const [mode, setMode] = useState<LoginMode>('babybuddy');

  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');

  // Offline setup: a first child's name and birth date, only asked for when
  // there's no local data yet.
  const [babyName, setBabyName] = useState('');
  const [babyBirth, setBabyBirth] = useState(() => new Date().toISOString());

  const [useApiKey, setUseApiKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHa = mode === 'homeassistant';
  const isLocal = mode === 'local';
  const hasLocalData = localChildren.length > 0;

  const submitLocal = () => {
    setError(null);
    // The local store rehydrates asynchronously; acting before it finishes could
    // read an empty `children` and seed a duplicate first child. The CTA is
    // disabled until then, and this re-reads the count straight from the store
    // (not the render snapshot) as a second guard against that race.
    if (!localHydrated) return;
    const hasChildren = useLocalDataStore.getState().children.length > 0;
    // First time in offline mode: seed the child the caregiver just described.
    // On a later sign-in the existing on-device data is simply reopened.
    if (!hasChildren) {
      const name = babyName.trim();
      if (!name) {
        setError(t('login.enterBabyName'));
        return;
      }
      addChild({ name, birthDate: babyBirth });
    }
    signIn({ mode: 'local', baseUrl: 'local', token: 'local', userName: LOCAL_USER });
  };

  const submit = async () => {
    if (isLocal) {
      submitLocal();
      return;
    }

    const baseUrl = normalizeBaseUrl(serverUrl);
    if (!baseUrl) {
      setError(t('login.enterServerUrl'));
      return;
    }

    if (USE_MOCK_DATA) {
      // Fixture mode: there's no server to authenticate against.
      signIn({ mode, baseUrl, token: 'mock', userName: 'Sarah' });
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const session =
        useApiKey || isHa
          ? await signInWithToken(mode, baseUrl, apiKey.trim())
          : await signInWithPassword(mode, baseUrl, username.trim(), password);
      signIn(session);
    } catch (err) {
      if (err instanceof PasswordLoginUnavailable) {
        // Offer the supported path instead of leaving the user stuck.
        setUseApiKey(true);
        setError(t('login.passwordFallback', { message: err.message }));
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const showKeyField = useApiKey || isHa;

  // Return-key navigation: username → password → submit.
  const credentialsChain = useFieldChain(2, () => void submit());

  const ctaLabel = () => {
    if (busy) return t('login.connecting');
    if (isLocal) return hasLocalData ? t('login.continueOffline') : t('login.startOffline');
    return isHa ? t('login.connect') : t('login.logIn');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* `padding` on Android too — see ShareInstanceScreen. */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <View style={styles.logo} />
          <AppText size={fontSize.screenTitle} weight="800" style={styles.title}>
            {t('login.title')}
          </AppText>
          <AppText
            size={fontSize.bodySm}
            weight="600"
            color={colors.textMuted}
            style={styles.subtitle}
          >
            {isLocal ? t('login.subtitleLocal') : t('login.subtitle')}
          </AppText>

          <View style={styles.toggle}>
            <SegmentedToggle
              value={mode}
              onChange={(m) => {
                setMode(m);
                setError(null);
              }}
              options={[
                { value: 'babybuddy', label: t('login.modeBabyBuddy') },
                { value: 'homeassistant', label: t('login.modeHomeAssistant') },
                { value: 'local', label: t('login.modeLocal') },
              ]}
            />
          </View>

          {isLocal ? (
            <View style={styles.fields}>
              {hasLocalData ? (
                <AppText size={fontSize.bodySm} weight="600" color={colors.textMuted}>
                  {t('login.offlineExistingData', {
                    names: localChildren.map((c) => c.name).join(', '),
                  })}
                </AppText>
              ) : (
                <>
                  <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
                    {t('login.offlineHint')}
                  </AppText>
                  <TextField
                    label={t('login.babyName')}
                    placeholder={t('login.babyNamePlaceholder')}
                    autoCapitalize="words"
                    value={babyName}
                    onChangeText={setBabyName}
                  />
                  <DateTimeField
                    label={t('login.babyBirthDate')}
                    value={babyBirth}
                    onChange={setBabyBirth}
                  />
                </>
              )}
            </View>
          ) : (
            <View style={styles.fields}>
              <TextField
                label={isHa ? t('login.addOnUrl') : t('login.serverUrl')}
                placeholder={
                  isHa ? t('login.addOnUrlPlaceholder') : t('login.serverUrlPlaceholder')
                }
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                value={serverUrl}
                onChangeText={setServerUrl}
              />

              {showKeyField ? (
              <TextField
                label={t('login.apiKey')}
                placeholder={t('login.apiKeyPlaceholder')}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                value={apiKey}
                onChangeText={setApiKey}
              />
            ) : (
              <>
                <TextField
                  {...credentialsChain.fieldProps(0)}
                  label={t('login.username')}
                  placeholder={t('login.usernamePlaceholder')}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={username}
                  onChangeText={setUsername}
                />
                <TextField
                  {...credentialsChain.fieldProps(1)}
                  label={t('login.password')}
                  placeholder={t('login.passwordPlaceholder')}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </>
            )}

              {isHa ? (
                <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
                  {t('login.haHint')}
                </AppText>
              ) : null}
            </View>
          )}

          {error ? (
            <View style={styles.error}>
              <AppText size={fontSize.metaSm} weight="700" color={colors.danger}>
                {error}
              </AppText>
            </View>
          ) : null}

          <View style={styles.cta}>
            <ActionButton
              label={ctaLabel()}
              fullWidth
              disabled={busy || (isLocal && !localHydrated)}
              onPress={() => void submit()}
            />
          </View>

          {!isHa && !isLocal ? (
            <View style={styles.switcher}>
              <ActionButton
                label={showKeyField ? t('login.useUsernamePassword') : t('login.useApiKey')}
                variant="neutral"
                fullWidth
                disabled={busy}
                onPress={() => {
                  setUseApiKey((v) => !v);
                  setError(null);
                }}
              />
            </View>
          ) : null}

          {!isLocal ? (
            <View style={styles.switcher}>
              <ActionButton
                label={t('login.scanQr')}
                variant="neutral"
                fullWidth
                disabled={busy}
                onPress={() => navigation.navigate('ScanLogin')}
              />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type Props = NativeStackScreenProps<MainStackParamList, 'Login'>;

const makeStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flex: {
      flex: 1,
    },
    content: {
      paddingTop: 44,
      paddingHorizontal: 22,
      paddingBottom: spacing['7xl'],
      alignItems: 'stretch',
    },
    logo: {
      width: 64,
      height: 64,
      borderRadius: 20,
      backgroundColor: colors.accent,
      alignSelf: 'center',
      marginBottom: spacing['5xl'],
    },
    title: {
      textAlign: 'center',
    },
    subtitle: {
      textAlign: 'center',
      marginTop: spacing.xs,
      marginBottom: spacing['6xl'],
    },
    toggle: {
      marginBottom: spacing['5xl'],
    },
    fields: {
      gap: spacing['2xl'],
    },
    error: {
      marginTop: spacing['2xl'],
      padding: spacing['2xl'],
      borderRadius: radii.control,
      backgroundColor: colors.card,
    },
    cta: {
      marginTop: spacing['6xl'],
    },
    switcher: {
      marginTop: spacing.lg,
    },
  });
