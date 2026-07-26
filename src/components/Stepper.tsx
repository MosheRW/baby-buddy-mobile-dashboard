import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { AppText } from './AppText';
import { ActionButton } from './ActionButton';
import { MinusGlyph, PlusGlyph } from './glyphs';
import {
  fontSize,
  radii,
  spacing,
  useTheme,
  useThemedStyles,
  weightFamily,
  type AppTheme,
} from '../theme';
import { parseNumericInput } from '../lib/stepper';

// Press-and-hold: after this delay the button starts auto-repeating, one step
// every `HOLD_INTERVAL_MS`. Every tick moves by the same fixed `step` a single
// tap does — holding is faster, never coarser.
const HOLD_DELAY_MS = 350;
const HOLD_INTERVAL_MS = 90;

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  /** The increment applied by one tap — and by each press-and-hold tick. */
  step: number;
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
   * Manual entry (default). Tap the number to type an exact value; long-press
   * it to reset to the value it had before editing began. Set `false` where the
   * affordance adds nothing, e.g. the 1–10 diaper amount.
   */
  enhanced?: boolean;
}

/**
 * ± stepper. The caller's `step` prop is the increment, so each usage picks its
 * own: ±1 ml/g amount, ±0.1 dose/°, ±1 min duration, ±1 hour, etc. Tap ±  to
 * step by that amount; press-and-hold to repeat it — the increment never grows
 * or shrinks, so a hold stays predictable and typing is how you get somewhere
 * far away fast.
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
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  // The value "before we started changing it": captured once at mount, this is
  // the target for both the long-press reset and the reset-on-invalid-entry.
  const defaultValue = useRef(value).current;
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');

  const round = (n: number) => {
    const p = Math.pow(10, Math.max(decimals, countDecimals(step)));
    return Math.round(n * p) / p;
  };
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  // One increment, the same for a tap and for every auto-repeat tick.
  const applyDelta = useCallback(
    (dir: 1 | -1) => {
      if (disabled) return;
      const next = clamp(dir > 0 ? value + step : value - step);
      onChange(round(next));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value, disabled, min, max, onChange, step, decimals],
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
    onChange(round(parsed));
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
        onStep={() => applyDelta(-1)}
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
        onStep={() => applyDelta(1)}
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
  onStep: () => void;
  disabled: boolean;
  kind: 'plus' | 'minus';
  label: string;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
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
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPressIn={startHold}
      onPressOut={stopHold}
      onPress={() => {
        // A hold already applied its steps via the interval; only a real tap
        // (no repeat) steps here. This also serves screen-reader activation.
        if (!repeated.current) stepRef.current();
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

const makeStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
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
      backgroundColor: colors.scrim,
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
