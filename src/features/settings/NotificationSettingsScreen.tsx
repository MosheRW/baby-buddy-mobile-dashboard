import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText, Card, Stepper, ToggleSwitch } from '../../components';
import { ChevronLeftGlyph } from '../../components/glyphs';
import { colors, fontSize, spacing } from '../../theme';
import type { MainStackParamList } from '../../navigation/types';
import { useNotificationStore } from '../../stores';
import type { TimingPrefs } from '../../lib/notifications';
import * as service from '../../notifications/service';

type Props = NativeStackScreenProps<MainStackParamList, 'Notifications'>;

export function NotificationSettingsScreen({ navigation }: Props) {
  const masterEnabled = useNotificationStore((s) => s.masterEnabled);
  const permissionStatus = useNotificationStore((s) => s.permissionStatus);
  const scheduledMeds = useNotificationStore((s) => s.scheduledMeds);
  const medEligibility = useNotificationStore((s) => s.medEligibility);
  const forgottenTimer = useNotificationStore((s) => s.forgottenTimer);

  const setMasterEnabled = useNotificationStore((s) => s.setMasterEnabled);
  const setPermissionStatus = useNotificationStore((s) => s.setPermissionStatus);
  const setCaseEnabled = useNotificationStore((s) => s.setCaseEnabled);
  const updateTiming = useNotificationStore((s) => s.updateTiming);
  const setForgottenTimerEnabled = useNotificationStore((s) => s.setForgottenTimerEnabled);
  const setForgottenTimerMinutes = useNotificationStore((s) => s.setForgottenTimerMinutes);

  const onToggleMaster = async (next: boolean) => {
    setMasterEnabled(next);
    if (next) {
      // Ask for permission on enable; the note below reflects a refusal.
      setPermissionStatus(await service.ensurePermissionsAsync());
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          hitSlop={8}
        >
          <ChevronLeftGlyph size={24} />
        </Pressable>
        <AppText size={fontSize.screenTitle} weight="800">
          Notifications
        </AppText>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <AppText size={fontSize.bodySm} weight="800">
                Enable notifications
              </AppText>
              <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
                Local reminders, scheduled on this device.
              </AppText>
            </View>
            <ToggleSwitch value={masterEnabled} onValueChange={onToggleMaster} />
          </View>
          {masterEnabled && permissionStatus === 'denied' ? (
            <AppText size={fontSize.metaSm} weight="600" color={colors.danger}>
              Notifications are blocked. Turn them on for Baby Buddy in your device settings.
            </AppText>
          ) : null}
          {masterEnabled && permissionStatus === 'unsupported' ? (
            <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
              Notifications aren&apos;t available on this platform.
            </AppText>
          ) : null}
        </Card>

        <CaseCard
          title="Scheduled medications"
          subtitle="Remind me when a scheduled dose is due."
          enabled={scheduledMeds.enabled}
          timing={scheduledMeds.timing}
          disabled={!masterEnabled}
          onToggle={(v) => setCaseEnabled('scheduledMeds', v)}
          onTiming={(patch) => updateTiming('scheduledMeds', patch)}
        />

        <CaseCard
          title="Medication eligibility"
          subtitle="Remind me when an as-needed medicine can be given again, or its 24h limit frees up."
          enabled={medEligibility.enabled}
          timing={medEligibility.timing}
          disabled={!masterEnabled}
          onToggle={(v) => setCaseEnabled('medEligibility', v)}
          onTiming={(patch) => updateTiming('medEligibility', patch)}
        />

        <Card style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <AppText size={fontSize.bodySm} weight="800">
                Forgotten timers
              </AppText>
              <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
                Warn me when a timer has been running unusually long.
              </AppText>
            </View>
            <ToggleSwitch
              value={forgottenTimer.enabled}
              onValueChange={setForgottenTimerEnabled}
              disabled={!masterEnabled}
            />
          </View>
          {masterEnabled && forgottenTimer.enabled ? (
            <View style={styles.field}>
              <AppText size={fontSize.metaSm} weight="700" color={colors.textSecondary}>
                After
              </AppText>
              <Stepper
                value={forgottenTimer.thresholdMinutes}
                onChange={setForgottenTimerMinutes}
                step={5}
                min={5}
                suffix=" min"
              />
            </View>
          ) : null}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Case card + timing controls -------------------------------------------

interface CaseCardProps {
  title: string;
  subtitle: string;
  enabled: boolean;
  timing: TimingPrefs;
  disabled: boolean;
  onToggle: (value: boolean) => void;
  onTiming: (patch: Partial<TimingPrefs>) => void;
}

function CaseCard({ title, subtitle, enabled, timing, disabled, onToggle, onTiming }: CaseCardProps) {
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
      {!disabled && enabled ? <TimingControls timing={timing} onChange={onTiming} /> : null}
    </Card>
  );
}

function TimingControls({
  timing,
  onChange,
}: {
  timing: TimingPrefs;
  onChange: (patch: Partial<TimingPrefs>) => void;
}) {
  return (
    <View style={styles.timing}>
      <ToggleRow label="Before" value={timing.before} onValueChange={(v) => onChange({ before: v })} />
      {timing.before ? (
        <Stepper
          value={timing.beforeMinutes}
          onChange={(v) => onChange({ beforeMinutes: v })}
          step={5}
          min={5}
          suffix=" min"
        />
      ) : null}
      <ToggleRow label="At the time" value={timing.at} onValueChange={(v) => onChange({ at: v })} />
      <ToggleRow label="After" value={timing.after} onValueChange={(v) => onChange({ after: v })} />
      {timing.after ? (
        <Stepper
          value={timing.afterMinutes}
          onChange={(v) => onChange({ afterMinutes: v })}
          step={5}
          min={5}
          suffix=" min"
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
  return (
    <View style={styles.row}>
      <AppText size={fontSize.body} weight="700">
        {label}
      </AppText>
      <ToggleSwitch value={value} onValueChange={onValueChange} />
    </View>
  );
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
});
