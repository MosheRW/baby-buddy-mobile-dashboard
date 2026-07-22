import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { MinusGlyph, PlusGlyph } from './glyphs';
import { colors, fontSize, radii, spacing } from '../theme';

// Press-and-hold: after this delay the button starts auto-repeating, one step
// every `HOLD_INTERVAL_MS`, so a long value (200ml at 1ml steps) doesn't need
// 200 taps. A quick tap releases well before the delay and just steps once.
const HOLD_DELAY_MS = 350;
const HOLD_INTERVAL_MS = 80;

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  /**
   * Increment size. A function is resolved from the current `value` on each
   * press, so the step can adapt as the value moves (e.g. finer near zero,
   * coarser once it's large) — see `intervalStep` in `lib/notifications`.
   */
  step: number | ((value: number) => number);
  min?: number;
  max?: number;
  /** Digits after the decimal point when displaying (0 for integers). */
  decimals?: number;
  /** Suffix appended to the value, e.g. " ml", "°C", " min". */
  suffix?: string;
  /**
   * Render the whole label from the value, replacing the numeric display (and
   * `suffix`). Lets a minute count read as "3h 30m" via `countdownLabel`.
   */
  format?: (value: number) => string;
  /**
   * Drop trailing fractional zeros from the display, so a 0.1-step temperature
   * reads "37°C" at a whole degree and "37.4°C" between. The stored value keeps
   * full precision — only the label is trimmed.
   */
  trimZeros?: boolean;
  disabled?: boolean;
}

/**
 * ± stepper. Handles all handoff cases via props:
 *  ±5 min duration, ±1 ml/g amount, ±0.5 decimal dose, ±0.1° temperature.
 * Press-and-hold either button to auto-repeat (see `StepButton`).
 * Rounds to a stable number of decimals to avoid float drift (0.1 + 0.2 etc).
 */
export function Stepper({
  value,
  onChange,
  step,
  min = -Infinity,
  max = Infinity,
  decimals = 0,
  suffix = '',
  format,
  trimZeros = false,
  disabled = false,
}: StepperProps) {
  const stepAt = (v: number) => (typeof step === 'function' ? step(v) : step);
  const round = (n: number, s: number) => {
    const p = Math.pow(10, Math.max(decimals, countDecimals(s)));
    return Math.round(n * p) / p;
  };
  const dec = () => {
    if (disabled) return;
    const s = stepAt(value);
    onChange(round(Math.max(min, value - s), s));
  };
  const inc = () => {
    if (disabled) return;
    const s = stepAt(value);
    onChange(round(Math.min(max, value + s), s));
  };
  // Fixed precision keeps float drift out; `trimZeros` then drops "37.0" → "37".
  const fixed = value.toFixed(decimals);
  const display = format ? format(value) : trimZeros ? String(Number(fixed)) : fixed;

  return (
    <View style={[styles.row, disabled && styles.disabled]}>
      <StepButton onStep={dec} disabled={disabled || value <= min} kind="minus" />
      <View style={styles.valueBox}>
        <AppText size={fontSize.cardTitle} weight="800">
          {display}
          {format ? '' : suffix}
        </AppText>
      </View>
      <StepButton onStep={inc} disabled={disabled || value >= max} kind="plus" />
    </View>
  );
}

function StepButton({
  onStep,
  disabled,
  kind,
}: {
  onStep: () => void;
  disabled: boolean;
  kind: 'plus' | 'minus';
}) {
  // The latest step handler, read by the repeat timer so it always steps from
  // the current value rather than a value captured when the hold began.
  const stepRef = useRef(onStep);
  useEffect(() => {
    stepRef.current = onStep;
  }, [onStep]);

  const delay = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null);
  // True once auto-repeat has fired, so the release tap (`onPress`) doesn't add
  // one extra step on top of the ones the hold already applied.
  const repeated = useRef(false);

  const stopHold = useCallback(() => {
    if (delay.current) clearTimeout(delay.current);
    if (repeat.current) clearInterval(repeat.current);
    delay.current = null;
    repeat.current = null;
  }, []);

  const startHold = useCallback(() => {
    repeated.current = false;
    delay.current = setTimeout(() => {
      repeated.current = true;
      repeat.current = setInterval(() => stepRef.current(), HOLD_INTERVAL_MS);
    }, HOLD_DELAY_MS);
  }, []);

  // Cancel any pending timers if the button unmounts mid-hold.
  useEffect(() => stopHold, [stopHold]);

  // A hold that drives the value to its min/max disables the button; RN may then
  // not deliver onPressOut, so stop the repeat here rather than let it spin.
  useEffect(() => {
    if (disabled) stopHold();
  }, [disabled, stopHold]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={kind === 'plus' ? 'Increase' : 'Decrease'}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPressIn={startHold}
      onPressOut={stopHold}
      onPress={() => {
        // A hold already applied its steps via the interval; only a real tap
        // (no repeat) steps here. This also serves screen-reader activation.
        if (!repeated.current) onStep();
      }}
      hitSlop={8}
      style={({ pressed }) => [styles.btn, pressed && !disabled && styles.pressed]}
    >
      {kind === 'plus' ? (
        <PlusGlyph size={18} color={disabled ? colors.textMuted : colors.textPrimary} />
      ) : (
        <MinusGlyph size={18} color={disabled ? colors.textMuted : colors.textPrimary} />
      )}
    </Pressable>
  );
}

function countDecimals(n: number): number {
  if (Number.isInteger(n)) return 0;
  const s = n.toString();
  const i = s.indexOf('.');
  return i === -1 ? 0 : s.length - i - 1;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radii.control,
    padding: spacing.xs,
    gap: spacing.sm,
  },
  disabled: {
    opacity: 0.5,
  },
  valueBox: {
    flex: 1,
    alignItems: 'center',
  },
  btn: {
    width: 40,
    height: 40,
    borderRadius: radii.chipSmall,
    backgroundColor: colors.neutral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
