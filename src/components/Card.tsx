import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radii, shadows, spacing } from '../theme';

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
  return (
    <View
      style={[
        styles.base,
        { padding, borderRadius: radius },
        elevation === 'card' && shadows.card,
        elevation === 'feedRow' && shadows.feedRow,
        // The gradient fills to the rounded edge, so the corners have to clip.
        gradient != null && { backgroundColor: 'transparent', overflow: 'hidden' },
        style,
      ]}
      {...rest}
    >
      {gradient != null ? (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.card,
  },
});
