import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { colors, fontSize, radii, spacing } from '../theme';

interface StatTileProps {
  /** Uppercase micro-label, e.g. "LAST PEE". */
  label: string;
  /** Big value, e.g. "45m ago". */
  value: string;
  /** Tint pair { bg, fg }. Defaults to a neutral tile. */
  tint?: { bg: string; fg?: string };
  style?: StyleProp<ViewStyle>;
}

export function StatTile({ label, value, tint, style }: StatTileProps) {
  const bg = tint?.bg ?? colors.neutral;
  const fg = tint?.fg ?? colors.textPrimary;
  return (
    <View style={[styles.tile, { backgroundColor: bg }, style]}>
      <AppText size={fontSize.micro} weight="700" color={fg} style={styles.label}>
        {label.toUpperCase()}
      </AppText>
      <AppText size={fontSize.cardTitle} weight="800" color={fg}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: radii.control,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    gap: spacing.xs,
  },
  label: {
    letterSpacing: 0.5,
    opacity: 0.85,
  },
});
