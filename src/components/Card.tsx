import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { colors, radii, shadows, spacing } from '../theme';

interface CardProps extends ViewProps {
  /** Padding preset. Defaults to the 20px main-card padding. */
  padding?: number;
  /** Corner radius. Defaults to the 24px main-card radius. */
  radius?: number;
  /** 'card' (soft) or 'feedRow' (lighter) shadow, or 'none'. */
  elevation?: 'card' | 'feedRow' | 'none';
  style?: StyleProp<ViewStyle>;
}

export function Card({
  padding = spacing['4xl'],
  radius = radii.card,
  elevation = 'card',
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
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.card,
  },
});
