import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ActionButton, AppText, FieldLabel } from '../../components';
import { colors, fontSize, radii, spacing } from '../../theme';
import { elapsedClock, type TimerType } from '../../lib/timers';
import { useTimerActions } from '../../hooks/useTimers';
import { useTimerStore } from '../../stores';
import { DateTimeField } from './DateTimeField';

interface TimerControlProps {
  type: TimerType;
  childId: string;
  /** 1-second tick value driving the live elapsed display. */
  now: number;
  /** Label for the end-time picker shown while running ("Woke up at" for sleep). */
  endTimeLabel: string;
  endTime: string | null;
  onEndTimeChange: (iso: string) => void;
  /** Called when the timer stops, with the span it measured. */
  onStop: (startedAt: number, endedAt: number) => void;
}

/**
 * Start / live-elapsed / Stop control shared by feeding, sleep, and tummy time.
 *
 * The running timer lives in the global timerStore, not in this component, so
 * closing the form doesn't stop it — reopening the form for the same
 * (type, child) resumes showing the live elapsed time.
 */
export function TimerControl({
  type,
  childId,
  now,
  endTimeLabel,
  endTime,
  onEndTimeChange,
  onStop,
}: TimerControlProps) {
  const timer = useTimerStore((s) => s.timers.find((t) => t.type === type && t.childId === childId));
  const { start, stop: stopTimer } = useTimerActions();

  if (!timer) {
    return (
      <View>
        <FieldLabel>Timer</FieldLabel>
        <ActionButton
          label="Start timer"
          variant="neutral"
          fullWidth
          onPress={() => start(type, childId)}
        />
      </View>
    );
  }

  const stop = () => {
    const span = stopTimer(type, childId);
    if (span) onStop(span.startedAt, span.endedAt);
  };

  return (
    <View style={styles.running}>
      <View>
        <FieldLabel>Elapsed</FieldLabel>
        <View style={styles.clock}>
          <AppText size={fontSize.screenTitle} weight="800" color={colors.accent}>
            {elapsedClock(timer.startedAt, now)}
          </AppText>
        </View>
      </View>

      <DateTimeField
        label={endTimeLabel}
        value={endTime ?? new Date(now).toISOString()}
        onChange={onEndTimeChange}
      />

      <ActionButton label="Stop timer" variant="danger" fullWidth onPress={stop} />
    </View>
  );
}

const styles = StyleSheet.create({
  running: {
    gap: spacing['3xl'],
  },
  clock: {
    backgroundColor: colors.card,
    borderRadius: radii.control,
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
  },
});
