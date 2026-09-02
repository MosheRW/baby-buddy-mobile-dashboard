import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { AppText, Card, Chip, Stepper, ToggleSwitch } from '../../components';
import { ChevronLeftGlyph } from '../../components/glyphs';
import { fontSize, spacing, useTheme, useThemedStyles, type AppTheme } from '../../theme';
import { useDynamicColorSupported } from '../../theme/dynamicColor';
import type { MainStackParamList } from '../../navigation/types';
import { useKidsStore, useNotificationStore, useSettingsStore } from '../../stores';
import {
  DEFAULT_DIAPER_INTERVAL_MINUTES,
  DEFAULT_FOOD_INTERVAL_MINUTES,
} from '../../lib/notifications';
import { countdownLabel } from '../../lib/medication';
import { useDashboardData } from '../../data/queries';
import { AccentPicker } from './AccentPicker';
import { ScheduleEditor } from './ScheduleEditor';

type Props = NativeStackScreenProps<MainStackParamList, 'KidEditor'>;

export function KidEditorScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { childId } = route.params;
  const { children } = useDashboardData();
  const child = children.find((c) => c.id === childId);
  const dynamicSupported = useDynamicColorSupported();

  const hidden = useKidsStore((s) => s.hidden);
  const setHidden = useKidsStore((s) => s.setHidden);
  const childAccent = useKidsStore((s) => s.childAccent);
  const setChildAccent = useKidsStore((s) => s.setChildAccent);
  const childGroupId = useKidsStore((s) => s.childGroupId);
  const setChildGroup = useKidsStore((s) => s.setChildGroup);
  const childSchedule = useKidsStore((s) => s.childSchedule);
  const setChildSchedule = useKidsStore((s) => s.setChildSchedule);
  const groups = useKidsStore((s) => s.groups);

  const defaults = useSettingsStore((s) => s.defaultFoodMl);
  const setDefaultFoodMl = useSettingsStore((s) => s.setDefaultFoodMl);
  // Subscribing keeps the interval labels in step with the time-format
  // preference (set on the parent Settings screen).
  const timeFormat = useSettingsStore((s) => s.timeFormat);
  const formatMinutes = (minutes: number) => countdownLabel(minutes * 60_000, timeFormat);
  const perChild = useNotificationStore((s) => s.perChild);
  const setPerChildThreshold = useNotificationStore((s) => s.setPerChildThreshold);

  const groupList = Object.values(groups).sort((a, b) => a.order - b.order);
  const currentGroup = childGroupId[childId] ?? null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={() => navigation.goBack()}
          hitSlop={10}
        >
          <ChevronLeftGlyph size={24} color={colors.textPrimary} />
        </Pressable>
        <AppText size={fontSize.screenTitle} weight="800">
          {child?.name ?? t('advanced.kids')}
        </AppText>
      </View>

      {child ? (
        <ScrollView contentContainerStyle={styles.content}>
          <Card style={styles.section}>
            <View style={styles.toggleRow}>
              <AppText size={fontSize.body} weight="700">
                {t('advanced.kidVisibility')}
              </AppText>
              <ToggleSwitch
                value={!hidden[childId]}
                onValueChange={(visible) => setHidden(childId, !visible)}
                accessibilityLabel={t('settings.visibilityToggle', { name: child.name })}
              />
            </View>
          </Card>

          <Card style={styles.section}>
            <AppText size={fontSize.bodySm} weight="800">
              {t('settings.defaultFood')}
            </AppText>
            <Stepper
              value={defaults[childId] ?? child.defaultFoodMl}
              onChange={(v) => setDefaultFoodMl(childId, v)}
              step={1}
              min={0}
              suffix={t('settings.mlSuffix')}
            />
          </Card>

          <Card style={styles.section}>
            <AppText size={fontSize.bodySm} weight="800">
              {t('advanced.accentColor')}
            </AppText>
            <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
              {t('advanced.accentKidHint')}
            </AppText>
            <AccentPicker
              value={childAccent[childId] ?? null}
              onChange={(hue) => setChildAccent(childId, hue)}
              autoLabel={t('advanced.accentAuto')}
              matchPhoneLabel={dynamicSupported ? t('advanced.accentMatchPhone') : undefined}
            />
          </Card>

          <Card style={styles.section}>
            <AppText size={fontSize.bodySm} weight="800">
              {t('advanced.group')}
            </AppText>
            <View style={styles.chipWrap}>
              <Chip
                label={t('advanced.groupNone')}
                active={currentGroup == null}
                onPress={() => setChildGroup(childId, null)}
              />
              {groupList.map((group) => (
                <Chip
                  key={group.id}
                  label={group.name}
                  active={currentGroup === group.id}
                  onPress={() => setChildGroup(childId, group.id)}
                />
              ))}
            </View>
          </Card>

          {/* Per-child reminder thresholds. The on/off switches for these
              reminders live on the Notifications screen; these numbers are the
              child-specific part of that config, so they belong with the child.
              The feeding interval also drives the dashboard food-total window. */}
          <Card style={styles.section}>
            <AppText size={fontSize.bodySm} weight="800">
              {t('advanced.kidReminders')}
            </AppText>
            <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
              {t('advanced.kidRemindersHint')}
            </AppText>
            <View style={styles.field}>
              <AppText size={fontSize.metaSm} weight="700" color={colors.textSecondary}>
                {t('notifications.feedingInterval')}
              </AppText>
              <Stepper
                value={perChild[childId]?.foodMinIntervalMinutes ?? DEFAULT_FOOD_INTERVAL_MINUTES}
                onChange={(v) => setPerChildThreshold(childId, { foodMinIntervalMinutes: v })}
                step={1}
                min={30}
                format={formatMinutes}
                hoursMinutes
              />
            </View>
            <View style={styles.field}>
              <AppText size={fontSize.metaSm} weight="700" color={colors.textSecondary}>
                {t('notifications.maxGap')}
              </AppText>
              <Stepper
                value={perChild[childId]?.diaperIntervalMinutes ?? DEFAULT_DIAPER_INTERVAL_MINUTES}
                onChange={(v) => setPerChildThreshold(childId, { diaperIntervalMinutes: v })}
                step={1}
                min={30}
                format={formatMinutes}
                hoursMinutes
              />
            </View>
            <View style={styles.field}>
              <AppText size={fontSize.metaSm} weight="700" color={colors.textSecondary}>
                {t('notifications.targetAmount')}
              </AppText>
              <Stepper
                value={perChild[childId]?.foodMinMl ?? 0}
                onChange={(v) => setPerChildThreshold(childId, { foodMinMl: v })}
                step={1}
                min={0}
                suffix={t('settings.mlSuffix')}
              />
            </View>
          </Card>

          <Card style={styles.section}>
            <ScheduleEditor
              value={childSchedule[childId] ?? null}
              onChange={(schedule) => setChildSchedule(childId, schedule)}
            />
          </Card>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
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
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.lg,
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    field: {
      gap: spacing.sm,
    },
  });
