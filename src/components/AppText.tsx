import React from 'react';
import { Text, type TextProps } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme, weightFamily, type FontWeightKey } from '../theme';
import '../i18n';

interface AppTextProps extends TextProps {
  size?: number;
  weight?: FontWeightKey;
  color?: string;
}

/**
 * Text wrapper that applies a Nunito family for the given weight. RN can't
 * synthesize Nunito weights from one family, so weight maps to a family here.
 * Always use this (or a token text style) instead of a bare <Text>.
 *
 * It also subscribes to the active language (via `useTranslation`) and the
 * active colour scheme (via `useTheme`), so a language or appearance switch
 * re-renders every label in the tree, and defaults its text
 * alignment to the language's direction — Hebrew reads right-to-left. A `style`
 * with an explicit `textAlign` (e.g. centered titles) still wins, since it is
 * spread last.
 */
export function AppText({ size = 14, weight = '600', color, style, ...rest }: AppTextProps) {
  const { i18n } = useTranslation();
  const { colors } = useTheme();
  const rtl = i18n.dir() === 'rtl';
  return (
    <Text
      style={[
        {
          fontFamily: weightFamily[weight],
          fontSize: size,
          color: color ?? colors.textPrimary,
          textAlign: rtl ? 'right' : 'left',
          writingDirection: rtl ? 'rtl' : 'ltr',
        },
        style,
      ]}
      {...rest}
    />
  );
}
