import React from 'react';
import { StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { colors, fontSize, spacing } from '../theme';

/** 11px 700-weight uppercase muted caption shown above form fields. */
export function FieldLabel({ children }: { children: string }) {
  return (
    <AppText size={fontSize.metaSm} weight="700" color={colors.textSecondary} style={styles.label}>
      {children.toUpperCase()}
    </AppText>
  );
}

const styles = StyleSheet.create({
  label: {
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
});
