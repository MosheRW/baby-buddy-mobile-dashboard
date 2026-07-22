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
        gradient != null && styles.transparent,
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

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.card,
  },
  // The gradient layer supplies the fill, so the base must not paint over it.
  transparent: {
    backgroundColor: 'transparent',
  },
});
