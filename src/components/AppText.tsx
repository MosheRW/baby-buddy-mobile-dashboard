import React from 'react';
import { Text, type TextProps } from 'react-native';
import { colors, weightFamily, type FontWeightKey } from '../theme';

interface AppTextProps extends TextProps {
  size?: number;
  weight?: FontWeightKey;
  color?: string;
}

/**
 * Text wrapper that applies a Nunito family for the given weight. RN can't
 * synthesize Nunito weights from one family, so weight maps to a family here.
 * Always use this (or a token text style) instead of a bare <Text>.
 */
export function AppText({
  size = 14,
  weight = '600',
  color = colors.textPrimary,
  style,
  ...rest
}: AppTextProps) {
  return (
    <Text
      style={[{ fontFamily: weightFamily[weight], fontSize: size, color }, style]}
      {...rest}
    />
  );
}
