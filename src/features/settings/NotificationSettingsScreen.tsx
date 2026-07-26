import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ActionButton, AppText, Card, Chip, Stepper, ToggleSwitch } from '../../components';
import { ChevronLeftGlyph } from '../../components/glyphs';
import { fontSize, spacing, useTheme, useThemedStyles, type AppTheme } from '../../theme';
import type { MainStackParamList } from '../../navigation/types';
import { useNotificationStore } from '../../stores';
import {
  DEFAULT_DIAPER_INTERVAL_MINUTES,
  DEFAULT_FOOD_INTERVAL_MINUTES,
  type TimingPrefs,
} from '../../lib/notifications';
import { countdownLabel } from '../../lib/medication';
import { useDashboardData } from '../../data/queries';
import * as service from '../../notifications/service';

/** A minute count rendered as a friendly, localized duration ("3h 30m"). */
const formatMinutes = (minutes: number) => countdownLabel(minutes * 60_000);

type Props = NativeStackScreenProps<MainStackParamList, 'Notifications'>;

export function NotificationSettingsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { children } = useDashboardData();
  const masterEnabled = useNotificationStore((s) => s.masterEnabled);
  const permissionStatus = useNotificationStore((s) => s.permissionStatus);
  const scheduledMeds = useNotificationStore((s) => s.scheduledMeds);
  const medEligibility = useNotificationStore((s) => s.medEligibility);
  const forgottenTimer = useNotificationStore((s) => s.forgottenTimer);
  const liveTimer = useNotificationStore((s) => s.liveTimer);
  const diaperInterval = useNotificationStore((s) => s.diaperInterval);
  const foodMin = useNotificationStore((s) => s.foodMin);
  const weeklySummary = useNotificationStore((s) => s.weeklySummary);
  const perChild = useNotificationStore((s) => s.perChild);

  const setMasterEnabled = useNotificationStore((s) => s.setMasterEnabled);
  const setPermissionStatus = useNotificationStore((s) => s.setPermissionStatus);
  const setCaseEnabled = useNotificationStore((s) => s.setCaseEnabled);
  const updateTiming = useNotificationStore((s) => s.updateTiming);
  const setForgottenTimerEnabled = useNotificationStore((s) => s.setForgottenTimerEnabled);
  const setForgottenTimerMinutes = useNotificationStore((s) => s.setForgottenTimerMinutes);
  const setForgottenTimerSleepMinutes = useNotificationStore(
    (s) => s.setForgottenTimerSleepMinutes,
  );
  const setLiveTimerEnabled = useNotificationStore((s) => s.setLiveTimerEnabled);
  const setIntervalCaseEnabled = useNotificationStore((s) => s.setIntervalCaseEnabled);
  const setPerChildThreshold = useNotificationStore((s) => s.setPerChildThreshold);
  const updateWeeklySummary = useNotificationStore((s) => s.updateWeeklySummary);

  const onToggleMaster = async (next: boolean) => {
    setMasterEnabled(next);
    if (next) {
      // Ask for permission on enable; the note below reflects a refusal.
      setPermissionStatus(await service.ensurePermissionsAsync());
    }
  };

  const timingLabels: TimingLabels = {
    before: t('notifications.before'),
    atTime: t('notifications.atTime'),
    after: t('notifications.after'),
    minSuffix: t('notifications.minSuffix'),
  };

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
          {t('notifications.title')}
        </AppText>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <AppText size={fontSize.bodySm} weight="800">
                {t('notifications.enable')}
              </AppText>
              <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
                {t('notifications.enableHint')}
              </AppText>
            </View>
            <ToggleSwitch value={masterEnabled} onValueChange={onToggleMaster} />
          </View>
          {masterEnabled && permissionStatus === 'denied' ? (
            <AppText size={fontSize.metaSm} weight="600" color={colors.danger}>
              {t('notifications.blocked')}
            </AppText>
          ) : null}
          {masterEnabled && permissionStatus === 'unsupported' ? (
            <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
              {t('notifications.unsupported')}
            </AppText>
          ) : null}
        </Card>

        <CaseCard
          title={t('notifications.scheduledMedsTitle')}
          subtitle={t('notifications.scheduledMedsHint')}
          enabled={scheduledMeds.enabled}
          timing={scheduledMeds.timing}
          disabled={!masterEnabled}
          labels={timingLabels}
          onToggle={(v) => setCaseEnabled('scheduledMeds', v)}
          onTiming={(patch) => updateTiming('scheduledMeds', patch)}
        />

        <CaseCard
          title={t('notifications.eligibilityTitle')}
          subtitle={t('notifications.eligibilityHint')}
          enabled={medEligibility.enabled}
          timing={medEligibility.timing}
          disabled={!masterEnabled}
          labels={timingLabels}
          onToggle={(v) => setCaseEnabled('medEligibility', v)}
          onTiming={(patch) => updateTiming('medEligibility', patch)}
        />

        <Card style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <AppText size={fontSize.bodySm} weight="800">
                {t('notifications.forgottenTitle')}
              </AppText>
              <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
                {t('notifications.forgottenHint')}
              </AppText>
            </View>
            <ToggleSwitch
              value={forgottenTimer.enabled}
              onValueChange={setForgottenTimerEnabled}
              disabled={!masterEnabled}
            />
          </View>
          {masterEnabled && forgottenTimer.enabled ? (
            <View style={styles.childBlock}>
              <View style={styles.field}>
                <AppText size={fontSize.metaSm} weight="700" color={colors.textSecondary}>
                  {t('notifications.forgottenGeneralLabel')}
                </AppText>
                <Stepper
                  value={forgottenTimer.thresholdMinutes}
                  onChange={setForgottenTimerMinutes}
                  step={1}
                  min={5}
                  format={formatMinutes}
                />
              </View>
              <View style={styles.field}>
                <AppText size={fontSize.metaSm} weight="700" color={colors.textSecondary}>
                  {t('notifications.forgottenSleepLabel')}
                </AppText>
                <Stepper
                  value={forgottenTimer.sleepThresholdMinutes}
                  onChange={setForgottenTimerSleepMinutes}
                  step={1}
                  min={5}
                  format={formatMinutes}
                />
              </View>
            </View>
          ) : null}
        </Card>

        <Card style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <AppText size={fontSize.bodySm} weight="800">
                {t('notifications.liveTitle')}
              </AppText>
              <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
                {t('notifications.liveHint')}
              </AppText>
            </View>
            <ToggleSwitch
              value={liveTimer.enabled}
              onValueChange={setLiveTimerEnabled}
              disabled={!masterEnabled}
            />
          </View>
        </Card>

        <Card style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <AppText size={fontSize.bodySm} weight="800">
                {t('notifications.diaperTitle')}
              </AppText>
              <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
                {t('notifications.diaperHint')}
              </AppText>
            </View>
            <ToggleSwitch
              value={diaperInterval.enabled}
              onValueChange={(v) => setIntervalCaseEnabled('diaperInterval', v)}
              disabled={!masterEnabled}
            />
          </View>
          {masterEnabled && diaperInterval.enabled
            ? children.map((child) => (
                <View key={child.id} style={styles.childBlock}>
                  <AppText size={fontSize.body} weight="700">
                    {child.name}
                  </AppText>
                  <View style={styles.field}>
                    <AppText size={fontSize.metaSm} weight="700" color={colors.textSecondary}>
                      {t('notifications.maxGap')}
                    </AppText>
                    <Stepper
                      value={
                        perChild[child.id]?.diaperIntervalMinutes ?? DEFAULT_DIAPER_INTERVAL_MINUTES
                      }
                      onChange={(v) => setPerChildThreshold(child.id, { diaperIntervalMinutes: v })}
                      step={1}
                      min={30}
                      format={formatMinutes}
                    />
                  </View>
                </View>
              ))
            : null}
        </Card>

        {/* Always editable — the feeding interval also drives the dashboard
            food-total window, so it stays reachable even with notifications off. */}
        <Card style={styles.section}>
          <View style={styles.rowText}>
            <AppText size={fontSize.bodySm} weight="800">
              {t('notifications.feedingScheduleTitle')}
            </AppText>
            <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
              {t('notifications.feedingScheduleHint')}
            </AppText>
          </View>
          {children.map((child) => (
            <View key={child.id} style={styles.childBlock}>
              <AppText size={fontSize.body} weight="700">
                {child.name}
              </AppText>
              <View style={styles.field}>
                <AppText size={fontSize.metaSm} weight="700" color={colors.textSecondary}>
                  {t('notifications.feedingInterval')}
                </AppText>
                <Stepper
                  value={
                    perChild[child.id]?.foodMinIntervalMinutes ?? DEFAULT_FOOD_INTERVAL_MINUTES
                  }
                  onChange={(v) => setPerChildThreshold(child.id, { foodMinIntervalMinutes: v })}
                  step={1}
                  min={30}
                  format={formatMinutes}
                />
              </View>
            </View>
          ))}
        </Card>

        <Card style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <AppText size={fontSize.bodySm} weight="800">
                {t('notifications.foodTitle')}
              </AppText>
              <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
                {t('notifications.foodHint')}
              </AppText>
            </View>
            <ToggleSwitch
              value={foodMin.enabled}
              onValueChange={(v) => setIntervalCaseEnabled('foodMin', v)}
              disabled={!masterEnabled}
            />
          </View>
          {masterEnabled && foodMin.enabled
            ? children.map((child) => (
                <View key={child.id} style={styles.childBlock}>
                  <AppText size={fontSize.body} weight="700">
                    {child.name}
                  </AppText>
                  <View style={styles.field}>
                    <AppText size={fontSize.metaSm} weight="700" color={colors.textSecondary}>
                      {t('notifications.targetAmount')}
                    </AppText>
                    <Stepper
                      value={perChild[child.id]?.foodMinMl ?? 0}
                      onChange={(v) => setPerChildThreshold(child.id, { foodMinMl: v })}
                      step={1}
                      min={0}
                      suffix={t('settings.mlSuffix')}
                    />
                  </View>
                </View>
              ))
            : null}
        </Card>

        <Card style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <AppText size={fontSize.bodySm} weight="800">
                {t('notifications.weeklyTitle')}
              </AppText>
              <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
                {t('notifications.weeklyHint')}
              </AppText>
            </View>
            <ToggleSwitch
              value={weeklySummary.enabled}
              onValueChange={(v) => updateWeeklySummary({ enabled: v })}
              disabled={!masterEnabled}
            />
          </View>
          {masterEnabled && weeklySummary.enabled ? (
            <View style={styles.childBlock}>
              <View style={styles.field}>
                <AppText size={fontSize.metaSm} weight="700" color={colors.textSecondary}>
                  {t('notifications.weeklyDay')}
                </AppText>
                <View style={styles.dayRow}>
                  {WEEKDAYS.map((d) => (
                    <Chip
                      key={d}
                      label={t(`notifications.weekdayShort.${d}`)}
                      active={weeklySummary.weekday === d}
                      onPress={() => updateWeeklySummary({ weekday: d })}
                      style={styles.dayChip}
                    />
                  ))}
                </View>
              </View>
              <View style={styles.field}>
                <AppText size={fontSize.metaSm} weight="700" color={colors.textSecondary}>
                  {t('notifications.weeklyTime')}
                </AppText>
                <Stepper
                  value={weeklySummary.hour}
                  onChange={(v) => updateWeeklySummary({ hour: v })}
                  step={1}
                  min={0}
                  max={23}
                  suffix={t('notifications.weeklyHourSuffix')}
                />
              </View>
            </View>
          ) : null}
          {/* Outside the enabled/master gates on purpose: reading the recap is a
              local calculation, so it stays available even with notifications
              off or permission denied. */}
          <ActionButton
            label={t('contribution.viewNow')}
            variant="neutral"
            onPress={() => navigation.navigate('Contribution')}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Sunday-first, matching the store's 0=Sunday..6=Saturday weekday. */
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

// --- Case card + timing controls -------------------------------------------

/** Pre-translated labels threaded down to the module-level sub-components. */
interface TimingLabels {
  before: string;
  atTime: string;
  after: string;
  minSuffix: string;
}

interface CaseCardProps {
  title: string;
  subtitle: string;
  enabled: boolean;
  timing: TimingPrefs;
  disabled: boolean;
  labels: TimingLabels;
  onToggle: (value: boolean) => void;
  onTiming: (patch: Partial<TimingPrefs>) => void;
}

function CaseCard({
  title,
  subtitle,
  enabled,
  timing,
  disabled,
  labels,
  onToggle,
  onTiming,
}: CaseCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Card style={styles.section}>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <AppText size={fontSize.bodySm} weight="800">
            {title}
          </AppText>
          <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
            {subtitle}
          </AppText>
        </View>
        <ToggleSwitch value={enabled} onValueChange={onToggle} disabled={disabled} />
      </View>
      {!disabled && enabled ? (
        <TimingControls timing={timing} labels={labels} onChange={onTiming} />
      ) : null}
    </Card>
  );
}

function TimingControls({
  timing,
  labels,
  onChange,
}: {
  timing: TimingPrefs;
  labels: TimingLabels;
  onChange: (patch: Partial<TimingPrefs>) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.timing}>
      <ToggleRow
        label={labels.before}
        value={timing.before}
        onValueChange={(v) => onChange({ before: v })}
      />
      {timing.before ? (
        <Stepper
          value={timing.beforeMinutes}
          onChange={(v) => onChange({ beforeMinutes: v })}
          step={1}
          min={5}
          suffix={labels.minSuffix}
        />
      ) : null}
      <ToggleRow
        label={labels.atTime}
        value={timing.at}
        onValueChange={(v) => onChange({ at: v })}
      />
      <ToggleRow
        label={labels.after}
        value={timing.after}
        onValueChange={(v) => onChange({ after: v })}
      />
      {timing.after ? (
        <Stepper
          value={timing.afterMinutes}
          onChange={(v) => onChange({ afterMinutes: v })}
          step={1}
          min={5}
          suffix={labels.minSuffix}
        />
      ) : null}
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      <AppText size={fontSize.body} weight="700">
        {label}
      </AppText>
      <ToggleSwitch value={value} onValueChange={onValueChange} />
    </View>
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
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.lg,
    },
    rowText: {
      flex: 1,
      gap: spacing.xs,
    },
    timing: {
      gap: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.neutral,
      paddingTop: spacing.lg,
    },
    field: {
      gap: spacing.sm,
    },
    childBlock: {
      gap: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.neutral,
      paddingTop: spacing.lg,
    },
    dayRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    dayChip: {
      paddingHorizontal: spacing.lg,
    },
  });
