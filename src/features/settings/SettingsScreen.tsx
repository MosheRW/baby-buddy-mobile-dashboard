import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ActionButton, AppText, Card, Chip, Stepper, TextField, ToggleSwitch } from '../../components';
import { ChevronLeftGlyph } from '../../components/glyphs';
import {
  avatarTint,
  fontSize,
  spacing,
  useTheme,
  useThemedStyles,
  type AppTheme,
} from '../../theme';
import type { Child } from '../../api/types';
import type { MainStackParamList } from '../../navigation/types';
import {
  THEME_PREFERENCES,
  useAuthStore,
  useKidsStore,
  useLocaleStore,
  useSettingsStore,
  useThemeStore,
  type ThemePreference,
} from '../../stores';
import { useLocalDataStore } from '../../data/localDataStore';
import { useEffectiveLanguage } from '../../hooks/useAppLanguage';
import { SUPPORTED_LANGUAGES, type AppLanguage } from '../../i18n';
import { queryKeys, useDashboardData } from '../../data/queries';
import { DateTimeField } from '../logEntry/DateTimeField';
import type { TimeFormat } from '../../lib/timeFormat';

const LANGUAGE_LABEL_KEY: Record<AppLanguage, string> = {
  en: 'settings.languageEnglish',
  he: 'settings.languageHebrew',
};

const APPEARANCE_LABEL_KEY: Record<ThemePreference, string> = {
  system: 'settings.appearanceSystem',
  light: 'settings.appearanceLight',
  dark: 'settings.appearanceDark',
};

const TIME_FORMATS: TimeFormat[] = ['text', 'digital'];
const TIME_FORMAT_LABEL_KEY: Record<TimeFormat, string> = {
  text: 'settings.timeFormatText',
  digital: 'settings.timeFormatDigital',
};

type Props = NativeStackScreenProps<MainStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { scheme, colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);
  const isLocal = session?.mode === 'local';
  const { children } = useDashboardData();
  const defaults = useSettingsStore((s) => s.defaultFoodMl);
  const setDefaultFoodMl = useSettingsStore((s) => s.setDefaultFoodMl);
  const excludeInactiveDays = useSettingsStore((s) => s.excludeInactiveDays);
  const setExcludeInactiveDays = useSettingsStore((s) => s.setExcludeInactiveDays);
  const timeFormat = useSettingsStore((s) => s.timeFormat);
  const setTimeFormat = useSettingsStore((s) => s.setTimeFormat);
  const hidden = useKidsStore((s) => s.hidden);
  const setHidden = useKidsStore((s) => s.setHidden);
  const setLanguage = useLocaleStore((s) => s.setLanguage);
  const activeLanguage = useEffectiveLanguage();
  const themePreference = useThemeStore((s) => s.preference);
  const setThemePreference = useThemeStore((s) => s.setPreference);

  const defaultMl = (id: string, fallback: number) => defaults[id] ?? fallback;

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
          {t('settings.title')}
        </AppText>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('notifications.navTitle')}
          onPress={() => navigation.navigate('Notifications')}
        >
          <Card style={styles.navRow}>
            <View style={styles.navText}>
              <AppText size={fontSize.bodySm} weight="800">
                {t('notifications.navTitle')}
              </AppText>
              <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
                {t('notifications.navHint')}
              </AppText>
            </View>
            <View style={styles.chevron}>
              <ChevronLeftGlyph size={20} color={colors.textMuted} />
            </View>
          </Card>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('advanced.navTitle')}
          onPress={() => navigation.navigate('AdvancedSettings')}
        >
          <Card style={styles.navRow}>
            <View style={styles.navText}>
              <AppText size={fontSize.bodySm} weight="800">
                {t('advanced.navTitle')}
              </AppText>
              <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
                {t('advanced.navHint')}
              </AppText>
            </View>
            <View style={styles.chevron}>
              <ChevronLeftGlyph size={20} color={colors.textMuted} />
            </View>
          </Card>
        </Pressable>

        <Card style={styles.section}>
          <AppText size={fontSize.bodySm} weight="800">
            {t('settings.appearance')}
          </AppText>
          <View style={styles.windowRow}>
            {THEME_PREFERENCES.map((preference) => (
              <Chip
                key={preference}
                label={t(APPEARANCE_LABEL_KEY[preference])}
                active={themePreference === preference}
                onPress={() => setThemePreference(preference)}
              />
            ))}
          </View>
          {/* Only "System" needs explaining — the other two say what they do. */}
          {themePreference === 'system' ? (
            <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
              {t('settings.appearanceSystemHint')}
            </AppText>
          ) : null}
        </Card>

        <Card style={styles.section}>
          <AppText size={fontSize.bodySm} weight="800">
            {t('settings.timeFormat')}
          </AppText>
          <View style={styles.windowRow}>
            {TIME_FORMATS.map((format) => (
              <Chip
                key={format}
                label={t(TIME_FORMAT_LABEL_KEY[format])}
                active={timeFormat === format}
                onPress={() => setTimeFormat(format)}
              />
            ))}
          </View>
          <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
            {t('settings.timeFormatHint')}
          </AppText>
        </Card>

        <Card style={styles.section}>
          <AppText size={fontSize.bodySm} weight="800">
            {t('settings.language')}
          </AppText>
          <View style={styles.windowRow}>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <Chip
                key={lang}
                label={t(LANGUAGE_LABEL_KEY[lang])}
                active={activeLanguage === lang}
                onPress={() => setLanguage(lang)}
              />
            ))}
          </View>
        </Card>

        <Card style={styles.section}>
          <AppText size={fontSize.bodySm} weight="800">
            {t('settings.stats')}
          </AppText>
          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <AppText size={fontSize.body} weight="700">
                {t('settings.excludeInactiveDays')}
              </AppText>
              <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
                {t('settings.excludeInactiveDaysHint')}
              </AppText>
            </View>
            <ToggleSwitch value={excludeInactiveDays} onValueChange={setExcludeInactiveDays} />
          </View>
        </Card>

        {isLocal ? (
          <LocalChildrenCard childList={children} />
        ) : (
        <Card style={styles.section}>
          <AppText size={fontSize.bodySm} weight="800">
            {t('settings.children')}
          </AppText>
          {children.map((child) => {
            const tint = avatarTint(child.hue, scheme);
            const isVisible = !hidden[child.id];
            return (
              <View key={child.id} style={styles.childRow}>
                <View style={styles.childInfo}>
                  <View style={[styles.avatar, { backgroundColor: tint.bg }]}>
                    <AppText size={fontSize.body} weight="800" color={tint.fg}>
                      {child.initial}
                    </AppText>
                  </View>
                  <AppText size={fontSize.body} weight="700">
                    {child.name}
                  </AppText>
                </View>
                <View style={styles.childControls}>
                  <ToggleSwitch
                    value={isVisible}
                    onValueChange={(visible) => setHidden(child.id, !visible)}
                    accessibilityLabel={t('settings.visibilityToggle', { name: child.name })}
                  />
                  <View style={styles.stepperWrap}>
                    <Stepper
                      value={defaultMl(child.id, child.defaultFoodMl)}
                      onChange={(v) => setDefaultFoodMl(child.id, v)}
                      step={1}
                      min={0}
                      suffix={t('settings.mlSuffix')}
                    />
                  </View>
                </View>
              </View>
            );
          })}
        </Card>
        )}

        {isLocal ? (
          <Card style={styles.section}>
            <AppText size={fontSize.bodySm} weight="800">
              {t('settings.offlineTitle')}
            </AppText>
            <AppText size={fontSize.bodySm} weight="600" color={colors.textMuted}>
              {t('settings.offlineHint')}
            </AppText>
          </Card>
        ) : (
          <Card style={styles.section}>
            <AppText size={fontSize.bodySm} weight="800">
              {session?.mode === 'homeassistant'
                ? t('settings.serverHomeAssistant')
                : t('settings.serverBabyBuddy')}
            </AppText>
            <AppText size={fontSize.bodySm} weight="600" color={colors.textMuted}>
              {session?.baseUrl ?? '—'}
            </AppText>
            {/* The HA path authenticates with a pasted token and never learns a
                username, so it shows the (masked) token instead. */}
            {session?.userName ? (
              <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
                {t('settings.loggedInAs', { name: session.userName })}
              </AppText>
            ) : session?.token ? (
              <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
                {t('settings.accessToken', { token: maskToken(session.token) })}
              </AppText>
            ) : null}
          </Card>
        )}

        <ActionButton
          label={t('settings.logOut')}
          variant="danger"
          fullWidth
          onPress={() => {
            signOut();
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Offline-mode children card: unlike the server-backed card, there's no server
 * to create children, so this one is a full editor — rename, re-date, add and
 * remove children stored on the device. Child writes invalidate the children
 * query so the dashboard reflects them immediately.
 */
function LocalChildrenCard({ childList }: { childList: Child[] }) {
  const { t } = useTranslation();
  const { scheme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const addChild = useLocalDataStore((s) => s.addChild);
  const updateChild = useLocalDataStore((s) => s.updateChild);
  const removeChild = useLocalDataStore((s) => s.removeChild);
  const hidden = useKidsStore((s) => s.hidden);
  const setHidden = useKidsStore((s) => s.setHidden);
  const defaults = useSettingsStore((s) => s.defaultFoodMl);
  const setDefaultFoodMl = useSettingsStore((s) => s.setDefaultFoodMl);
  const queryClient = useQueryClient();
  const refreshChildren = () =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.children });
  // Removing a child cascades to its entries and timers in the store, so the
  // feed and timer caches must be dropped too — invalidating only children
  // would leave the deleted child's entries on screen until the next refetch.
  const refreshAfterRemove = () => {
    refreshChildren();
    void queryClient.invalidateQueries({ queryKey: queryKeys.entries });
    void queryClient.invalidateQueries({ queryKey: queryKeys.timers });
  };

  return (
    <Card style={styles.section}>
      <AppText size={fontSize.bodySm} weight="800">
        {t('settings.children')}
      </AppText>
      {childList.map((child) => {
        const tint = avatarTint(child.hue, scheme);
        return (
          <View key={child.id} style={styles.localChild}>
            <View style={styles.localChildHead}>
              <View style={[styles.avatar, { backgroundColor: tint.bg }]}>
                <AppText size={fontSize.body} weight="800" color={tint.fg}>
                  {child.initial}
                </AppText>
              </View>
              <View style={styles.localChildName}>
                <TextField
                  label={t('settings.childName')}
                  defaultValue={child.name}
                  autoCapitalize="words"
                  onEndEditing={(e) => {
                    const name = e.nativeEvent.text.trim();
                    if (name && name !== child.name) {
                      updateChild(child.id, { name });
                      refreshChildren();
                    }
                  }}
                />
              </View>
            </View>
            <DateTimeField
              label={t('settings.childBirthDate')}
              value={child.birthDate}
              onChange={(iso) => {
                updateChild(child.id, { birthDate: iso });
                refreshChildren();
              }}
            />
            <View style={styles.toggleRow}>
              <AppText size={fontSize.body} weight="700">
                {t('settings.showOnDashboard')}
              </AppText>
              <ToggleSwitch
                value={!hidden[child.id]}
                onValueChange={(visible) => setHidden(child.id, !visible)}
                accessibilityLabel={t('settings.visibilityToggle', { name: child.name })}
              />
            </View>
            <View style={styles.toggleRow}>
              <AppText size={fontSize.body} weight="700">
                {t('settings.defaultFood')}
              </AppText>
              <View style={styles.stepperWrap}>
                <Stepper
                  value={defaults[child.id] ?? child.defaultFoodMl}
                  onChange={(v) => setDefaultFoodMl(child.id, v)}
                  step={1}
                  min={0}
                  suffix={t('settings.mlSuffix')}
                />
              </View>
            </View>
            {/* Keep at least one child — offline logging needs something to log against. */}
            {childList.length > 1 ? (
              <ActionButton
                label={t('settings.removeChild', { name: child.name })}
                variant="danger"
                fullWidth
                onPress={() => {
                  removeChild(child.id);
                  refreshAfterRemove();
                }}
              />
            ) : null}
          </View>
        );
      })}
      <ActionButton
        label={t('settings.addChild')}
        variant="neutral"
        fullWidth
        onPress={() => {
          addChild({ name: t('settings.newChildDefault'), birthDate: new Date().toISOString() });
          refreshChildren();
        }}
      />
    </Card>
  );
}

/** Last four characters only — enough to tell two tokens apart, and no more. */
function maskToken(token: string): string {
  return `••••${token.slice(-4)}`;
}

const makeStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
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
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.lg,
    },
    navText: {
      flex: 1,
      gap: spacing.xs,
    },
    chevron: {
      // The only chevron glyph points left; flip it to point into the sub-screen.
      transform: [{ rotate: '180deg' }],
    },
    windowRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    childRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.lg,
    },
    localChild: {
      gap: spacing.lg,
      paddingTop: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.background,
    },
    localChildHead: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.lg,
    },
    localChildName: {
      flex: 1,
    },
    childInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      flexShrink: 1,
    },
    childControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
    },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperWrap: {
      width: 150,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.lg,
    },
    toggleText: {
      flex: 1,
      gap: spacing.xs,
    },
  });
