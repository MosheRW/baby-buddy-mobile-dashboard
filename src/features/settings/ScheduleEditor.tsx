/**
 * Edits a recurring daily hide window (a `VisibilitySchedule`). Off → the target
 * has no schedule (`null`); on → a from/to time plus the days it applies to. An
 * empty day selection means every day, matching `isScheduleActive`.
 *
 * Time is stored as minutes-from-midnight; the two Steppers edit hours and
 * minutes independently. A window whose start is after its end simply wraps past
 * midnight (handled by the pure logic), so no ordering is enforced here.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, Chip, Stepper, ToggleSwitch } from '../../components';
import { colors, fontSize, spacing } from '../../theme';
import type { VisibilitySchedule, Weekday } from '../../lib/visibility';

interface ScheduleEditorProps {
  value: VisibilitySchedule | null;
  onChange: (schedule: VisibilitySchedule | null) => void;
}

const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
const DEFAULT_SCHEDULE: VisibilitySchedule = {
  startMinute: 8 * 60,
  endMinute: 17 * 60,
  weekdays: [],
};

const pad2 = (n: number) => String(n).padStart(2, '0');

export function ScheduleEditor({ value, onChange }: ScheduleEditorProps) {
  const { t } = useTranslation();
  const enabled = value != null;
  const schedule = value ?? DEFAULT_SCHEDULE;

  const setStart = (minute: number) => onChange({ ...schedule, startMinute: minute });
  const setEnd = (minute: number) => onChange({ ...schedule, endMinute: minute });

  const toggleDay = (day: Weekday) => {
    const weekdays = schedule.weekdays.includes(day)
      ? schedule.weekdays.filter((d) => d !== day)
      : [...schedule.weekdays, day].sort((a, b) => a - b);
    onChange({ ...schedule, weekdays });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.toggleRow}>
        <View style={styles.toggleText}>
          <AppText size={fontSize.bodySm} weight="800">
            {t('schedule.title')}
          </AppText>
          <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
            {t('schedule.hint')}
          </AppText>
        </View>
        <ToggleSwitch
          value={enabled}
          onValueChange={(on) => onChange(on ? DEFAULT_SCHEDULE : null)}
          accessibilityLabel={t('schedule.title')}
        />
      </View>

      {enabled ? (
        <>
          <TimeRow label={t('schedule.from')} minute={schedule.startMinute} onChange={setStart} />
          <TimeRow label={t('schedule.to')} minute={schedule.endMinute} onChange={setEnd} />

          <AppText size={fontSize.metaSm} weight="700" color={colors.textSecondary}>
            {t('schedule.days')}
          </AppText>
          <View style={styles.dayRow}>
            {WEEKDAYS.map((day) => (
              <Chip
                key={day}
                label={t(`notifications.weekdayShort.${day}`)}
                active={schedule.weekdays.includes(day)}
                onPress={() => toggleDay(day)}
              />
            ))}
          </View>
          <AppText size={fontSize.micro} weight="600" color={colors.textMuted}>
            {schedule.weekdays.length === 0 ? t('schedule.everyDay') : t('schedule.selectedDays')}
          </AppText>
        </>
      ) : null}
    </View>
  );
}

/** One from/to time as an hour Stepper + a minute Stepper. */
function TimeRow({
  label,
  minute,
  onChange,
}: {
  label: string;
  minute: number;
  onChange: (minute: number) => void;
}) {
  const hours = Math.floor(minute / 60);
  const mins = minute % 60;
  return (
    <View style={styles.timeRow}>
      <AppText size={fontSize.body} weight="700" style={styles.timeLabel}>
        {label}
      </AppText>
      <View style={styles.timeStepper}>
        <Stepper
          value={hours}
          onChange={(h) => onChange(((h + 24) % 24) * 60 + mins)}
          step={1}
          min={0}
          max={23}
          format={pad2}
        />
      </View>
      <View style={styles.timeStepper}>
        <Stepper
          value={mins}
          onChange={(m) => onChange(hours * 60 + ((m + 60) % 60))}
          step={5}
          min={0}
          max={55}
          format={pad2}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.lg,
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
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  timeLabel: {
    flex: 1,
  },
  timeStepper: {
    width: 108,
  },
  dayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
