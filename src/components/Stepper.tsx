import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { AppText } from './AppText';
import { ActionButton } from './ActionButton';
import { MinusGlyph, PlusGlyph } from './glyphs';
import { colors, fontSize, radii, spacing, weightFamily } from '../theme';
import { parseNumericInput, rampStep } from '../lib/stepper';

// Press-and-hold: after this delay the button starts auto-repeating, one step
// every `HOLD_INTERVAL_MS`. A quick tap releases well before the delay and just
// steps once by the fine unit. In `enhanced` mode the repeated step accelerates
// (see `rampStep`); otherwise it stays the fixed `step`.
const HOLD_DELAY_MS = 350;
const HOLD_INTERVAL_MS = 90;

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  /**
   * The fine, single-tap increment. A function is resolved from the current
   * `value` on each press, so the step can adapt as the value moves (e.g. finer
   * near zero). Under `enhanced` this is also the floor and precision for the
   * accelerating hold ramp.
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
  /**
   * Enhanced interactions (default). Tap the number to type a value; long-press
   * it to reset to the value it had before editing began; hold ±  to ramp by a
   * magnitude/duration-scaled amount. Set `false` to keep the plain stepper
   * (fixed-step hold, no manual entry) — used where the extra affordances add
   * nothing, e.g. the 1–10 diaper amount.
   */
  enhanced?: boolean;
}

/**
 * ± stepper. The caller's `step` prop is the fine single-tap increment, so each
 * usage picks its own: ±1 ml/g amount, ±0.1 dose/°, ±1 min duration, ±1 hour,
 * etc. Tap ±  to step by that unit; press-and-hold to accelerate (see
 * `rampStep`).
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
  enhanced = true,
}: StepperProps) {
  const { t } = useTranslation();
  // The value "before we started changing it": captured once at mount, this is
  // the target for both the long-press reset and the reset-on-invalid-entry.
  const defaultValue = useRef(value).current;
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');

  const stepAt = (v: number) => (typeof step === 'function' ? step(v) : step);
  const round = (n: number, s: number) => {
    const p = Math.pow(10, Math.max(decimals, countDecimals(s)));
    return Math.round(n * p) / p;
  };
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  // Apply one increment. `heldMs === null` is a single tap (fine unit); a number
  // is a hold tick, which ramps only when enhanced.
  const applyDelta = useCallback(
    (dir: 1 | -1, heldMs: number | null) => {
      if (disabled) return;
      const s =
        enhanced && heldMs != null
          ? rampStep(value, stepAt(value), heldMs, min, max)
          : stepAt(value);
      const next = clamp(dir > 0 ? value + s : value - s);
      onChange(round(next, s));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value, disabled, enhanced, min, max, onChange, step, decimals],
  );

  const resetToDefault = () => {
    if (!disabled) onChange(defaultValue);
  };

  const openEditor = () => {
    if (disabled) return;
    setEditText(decimals > 0 ? value.toFixed(decimals) : String(Math.round(value)));
    setEditing(true);
  };

  const commitEditor = () => {
    setEditing(false);
    const parsed = parseNumericInput(editText);
    if (parsed == null || parsed < min || parsed > max) {
      // Invalid or out of range: tell the user and restore `defaultValue` — the
      // value captured at mount, same target as the long-press reset.
      onChange(defaultValue);
      Alert.alert(t('stepper.invalidTitle'), rangeMessage(t, min, max));
      return;
    }
    onChange(round(parsed, stepAt(parsed)));
  };

  // Fixed precision keeps float drift out; `trimZeros` then drops "37.0" → "37".
  const fixed = value.toFixed(decimals);
  const display = format ? format(value) : trimZeros ? String(Number(fixed)) : fixed;
  const valueLabel = (
    <AppText size={fontSize.cardTitle} weight="800">
      {display}
      {format ? '' : suffix}
    </AppText>
  );

  return (
    <View style={[styles.row, disabled && styles.disabled]}>
      <StepButton
        onStep={(heldMs) => applyDelta(-1, heldMs)}
        disabled={disabled || value <= min}
        kind="minus"
        label={t('stepper.decrease')}
      />

      {enhanced ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('stepper.editValue')}
          accessibilityHint={t('stepper.resetHint')}
          disabled={disabled}
          onPress={openEditor}
          onLongPress={resetToDefault}
          delayLongPress={500}
          style={styles.valueBox}
        >
          {valueLabel}
        </Pressable>
      ) : (
        <View style={styles.valueBox}>{valueLabel}</View>
      )}

      <StepButton
        onStep={(heldMs) => applyDelta(1, heldMs)}
        disabled={disabled || value >= max}
        kind="plus"
        label={t('stepper.increase')}
      />

      {enhanced ? (
        <Modal
          visible={editing}
          transparent
          animationType="fade"
          onRequestClose={() => setEditing(false)}
        >
          <Pressable style={styles.backdrop} onPress={() => setEditing(false)}>
            {/* Inner Pressable swallows taps so they don't dismiss the dialog. */}
            <Pressable style={styles.dialog} onPress={() => {}}>
              <AppText size={fontSize.cardTitle} weight="800">
                {t('stepper.editTitle')}
              </AppText>
              <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
                {rangeMessage(t, min, max)}
              </AppText>
              <TextInput
                value={editText}
                onChangeText={setEditText}
                keyboardType={decimals > 0 ? 'decimal-pad' : 'number-pad'}
                autoFocus
                selectTextOnFocus
                onSubmitEditing={commitEditor}
                returnKeyType="done"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
              <View style={styles.dialogButtons}>
                <ActionButton
                  label={t('common.cancel')}
                  variant="neutral"
                  flex={1}
                  onPress={() => setEditing(false)}
                />
                <ActionButton
                  label={t('common.ok')}
                  variant="accent"
                  flex={1}
                  onPress={commitEditor}
                />
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

/** Localized guidance for the manual-entry dialog and invalid-value alert. */
function rangeMessage(t: TFunction, min: number, max: number): string {
  const hasMin = Number.isFinite(min);
  const hasMax = Number.isFinite(max);
  if (hasMin && hasMax) return t('stepper.rangeBoth', { min, max });
  if (hasMin) return t('stepper.rangeMin', { min });
  if (hasMax) return t('stepper.rangeMax', { max });
  return t('stepper.rangeAny');
}

function StepButton({
  onStep,
  disabled,
  kind,
  label,
}: {
  onStep: (heldMs: number | null) => void;
  disabled: boolean;
  kind: 'plus' | 'minus';
  label: string;
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
  // When the current hold began, so each repeat tick can report how long it has
  // been held (drives the ramp acceleration).
  const holdStart = useRef(0);

  const stopHold = useCallback(() => {
    if (delay.current) clearTimeout(delay.current);
    if (repeat.current) clearInterval(repeat.current);
    delay.current = null;
    repeat.current = null;
  }, []);

  const startHold = useCallback(() => {
    repeated.current = false;
    holdStart.current = Date.now();
    delay.current = setTimeout(() => {
      repeated.current = true;
      repeat.current = setInterval(
        () => stepRef.current(Date.now() - holdStart.current),
        HOLD_INTERVAL_MS,
      );
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
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPressIn={startHold}
      onPressOut={stopHold}
      onPress={() => {
        // A hold already applied its steps via the interval; only a real tap
        // (no repeat) steps here. This also serves screen-reader activation.
        if (!repeated.current) stepRef.current(null);
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
    justifyContent: 'center',
    alignSelf: 'stretch',
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: spacing['5xl'],
  },
  dialog: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: spacing['4xl'],
    gap: spacing.lg,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: radii.control,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing['2xl'],
    fontFamily: weightFamily['800'],
    fontSize: fontSize.cardTitle,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  dialogButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
