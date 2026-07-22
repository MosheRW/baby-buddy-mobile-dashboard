import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ActionButton, AppText, Card, Chip, Stepper, ToggleSwitch } from '../../components';
import { ChevronLeftGlyph } from '../../components/glyphs';
import { avatarTint, colors, fontSize, spacing } from '../../theme';
import type { MainStackParamList } from '../../navigation/types';
import { useAuthStore, useKidsStore, useLocaleStore, useSettingsStore } from '../../stores';
import { useEffectiveLanguage } from '../../hooks/useAppLanguage';
import { SUPPORTED_LANGUAGES, type AppLanguage } from '../../i18n';
import { useDashboardData } from '../../data/queries';

const LANGUAGE_LABEL_KEY: Record<AppLanguage, string> = {
  en: 'settings.languageEnglish',
  he: 'settings.languageHebrew',
};

type Props = NativeStackScreenProps<MainStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);
  const { children } = useDashboardData();
  const defaults = useSettingsStore((s) => s.defaultFoodMl);
  const setDefaultFoodMl = useSettingsStore((s) => s.setDefaultFoodMl);
  const excludeInactiveDays = useSettingsStore((s) => s.excludeInactiveDays);
  const setExcludeInactiveDays = useSettingsStore((s) => s.setExcludeInactiveDays);
  const hidden = useKidsStore((s) => s.hidden);
  const setHidden = useKidsStore((s) => s.setHidden);
  const setLanguage = useLocaleStore((s) => s.setLanguage);
  const activeLanguage = useEffectiveLanguage();

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
          <ChevronLeftGlyph size={24} />
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

        <Card style={styles.section}>
          <AppText size={fontSize.bodySm} weight="800">
            {t('settings.children')}
          </AppText>
          {children.map((child) => {
            const tint = avatarTint(child.hue);
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

/** Last four characters only — enough to tell two tokens apart, and no more. */
function maskToken(token: string): string {
  return `••••${token.slice(-4)}`;
}

const styles = StyleSheet.create({
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
