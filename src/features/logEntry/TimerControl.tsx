import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../../components';
import { colors, fontSize, radii, spacing, tints } from '../../theme';
import { elapsedClock, type TimerType } from '../../lib/timers';
import { useTimerActions } from '../../hooks/useTimers';
import { useTimerStore } from '../../stores';

/**
 * Timer UI for feeding, sleep, and tummy time. The prototype splits it into
 * three pieces rather than one block:
 *  - a compact "Timer running" strip at the top of the form (RunningTimerStrip),
 *  - the editable end-time field (rendered by the screen shell), and
 *  - a small "Start timer" button at the bottom of the type's fields.
 *
 * The running timer lives in the global timerStore, not in these components, so
 * closing the form doesn't stop it — reopening for the same (type, child)
 * resumes showing the live elapsed time.
 */

interface StartTimerButtonProps {
  type: TimerType;
  childId: string;
}

/** Soft peach pill with a play triangle — starts the (type, child) timer. */
export function StartTimerButton({ type, childId }: StartTimerButtonProps) {
  const { start } = useTimerActions();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Start timer"
      onPress={() => start(type, childId)}
      style={({ pressed }) => [styles.startButton, pressed && styles.pressed]}
    >
      <View style={[styles.playTriangle, { borderLeftColor: tints.suggestion.fg }]} />
      <AppText size={fontSize.metaSm} weight="800" color={tints.suggestion.fg}>
        Start timer
      </AppText>
    </Pressable>
  );
}

interface RunningTimerStripProps {
  type: TimerType;
  childId: string;
  /** 1-second tick value driving the live elapsed display. */
  now: number;
  /** Stops the timer and fills the draft with the measured span. */
  onStop: () => void;
}

/** Compact "● Timer running m:ss [Stop]" pill shown at the top of the form. */
export function RunningTimerStrip({ type, childId, now, onStop }: RunningTimerStripProps) {
  const timer = useTimerStore((s) => s.timers.find((t) => t.type === type && t.childId === childId));
  if (!timer) return null;

  return (
    <View style={styles.strip}>
      <View style={styles.dot} />
      <AppText size={fontSize.metaSm} weight="700" color={colors.textPrimary}>
        Timer running
      </AppText>
      <AppText size={fontSize.body} weight="800" color={colors.accent}>
        {elapsedClock(timer.startedAt, now)}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Stop timer"
        onPress={onStop}
        style={({ pressed }) => [styles.stopButton, pressed && styles.pressed]}
      >
        <AppText size={fontSize.metaSm} weight="800" color={colors.onAccent}>
          Stop
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: tints.suggestion.bg,
    borderRadius: radii.control,
    paddingVertical: spacing.lg,
  },
  playTriangle: {
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderLeftWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  strip: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    paddingLeft: spacing.lg,
    paddingRight: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  stopButton: {
    backgroundColor: colors.danger,
    borderRadius: radii.chipSmall,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  pressed: {
    opacity: 0.85,
  },
});
