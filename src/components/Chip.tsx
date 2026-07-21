import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { colors, fontSize, radii, spacing } from '../theme';

interface ChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  /** Override active-state colors (e.g. tinted per entry type). */
  activeBg?: string;
  activeFg?: string;
  /**
   * Optional leading glyph. A render-prop rather than a node because RN-SVG has
   * no `currentColor` cascade — the glyph is drawn in the chip's current text
   * colour, which the chip passes in.
   */
  glyph?: (color: string) => React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Pill chip: inactive = white, active = accent bg / white text.
 * 20px radius, 700-weight label. Used for type/filter/method/repeat rows.
 */
export function Chip({
  label,
  active = false,
  onPress,
  disabled = false,
  activeBg = colors.accent,
  activeFg = colors.onAccent,
  glyph,
  style,
}: ChipProps) {
  const fg = active ? activeFg : colors.textPrimary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: active ? activeBg : colors.card },
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {glyph ? glyph(fg) : null}
      <AppText size={fontSize.body} weight="700" color={fg}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    gap: spacing.xs,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
});
