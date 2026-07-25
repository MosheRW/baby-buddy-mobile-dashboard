import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { fontSize, radii, spacing, useTheme, type Palette } from '../theme';

type Variant = 'accent' | 'danger' | 'neutral';

interface ActionButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  /** Optional leading glyph element. */
  icon?: React.ReactNode;
  /** flex value when used in a row (e.g. Save flex 2 vs Delete flex 1). */
  flex?: number;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

function bgFor(variant: Variant, colors: Palette): string {
  return { accent: colors.accent, danger: colors.danger, neutral: colors.neutral }[variant];
}

function fgFor(variant: Variant, disabled: boolean, colors: Palette): string {
  if (disabled) return colors.textMuted;
  return variant === 'neutral' ? colors.textPrimary : colors.onAccent;
}

/** Full-width-ish CTA / footer button: 800/14px text, 14–16px radius. */
export function ActionButton({
  label,
  onPress,
  variant = 'accent',
  disabled = false,
  icon,
  flex,
  fullWidth,
  style,
}: ActionButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: disabled ? colors.neutral : bgFor(variant, colors) },
        fullWidth && styles.fullWidth,
        flex != null && { flex },
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <AppText size={fontSize.body} weight="800" color={fgFor(variant, disabled, colors)}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.control,
    paddingVertical: 15,
    paddingHorizontal: spacing['4xl'],
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  pressed: {
    opacity: 0.85,
  },
  icon: {
    marginRight: 2,
  },
});
