import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { radii, spacing, useTheme } from '../theme';

interface CardProps extends ViewProps {
  /** Padding preset. Defaults to the 20px main-card padding. */
  padding?: number;
  /** Corner radius. Defaults to the 24px main-card radius. */
  radius?: number;
  /** 'card' (soft) or 'feedRow' (lighter) shadow, or 'none'. */
  elevation?: 'card' | 'feedRow' | 'none';
  /**
   * Two colour stops for a diagonal background gradient (top-left →
   * bottom-right), replacing the solid card fill. Used by the per-child accent
   * cards. When omitted the card keeps its plain `colors.card` background.
   */
  gradient?: readonly [string, string];
  style?: StyleProp<ViewStyle>;
}

export function Card({
  padding = spacing['4xl'],
  radius = radii.card,
  elevation = 'card',
  gradient,
  style,
  children,
  ...rest
}: CardProps) {
  const { colors, shadows } = useTheme();
  return (
    <View
      style={[
        // The gradient layer supplies the fill, so the base must not paint over it.
        { backgroundColor: gradient != null ? 'transparent' : colors.card },
        { padding, borderRadius: radius },
        elevation === 'card' && shadows.card,
        elevation === 'feedRow' && shadows.feedRow,
        // A drop shadow does nothing against a dark background, so the dark
        // palette separates cards with a hairline edge instead. Applied only
        // when the palette defines one — a transparent border would still inset
        // the light layout by a hairline.
        elevation !== 'none' &&
          colors.cardBorder != null && {
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.cardBorder,
          },
        style,
      ]}
      {...rest}
    >
      {gradient != null ? (
        // The gradient carries the corner radius itself rather than the parent
        // clipping with overflow:'hidden', which would drop the card's iOS shadow.
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
          pointerEvents="none"
        />
      ) : null}
      {children}
    </View>
  );
}
