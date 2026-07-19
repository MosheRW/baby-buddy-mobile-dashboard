import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Chip } from './Chip';
import { spacing } from '../theme';

export interface ChipOption<T extends string = string> {
  value: T;
  label: string;
  activeBg?: string;
  activeFg?: string;
  disabled?: boolean;
}

interface ChipRowProps<T extends string> {
  options: ChipOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /**
   * 'scroll' — single-line horizontal scroll (filter/type tab rows).
   * 'wrap' — multi-line wrapping (the 7 entry-type chips).
   */
  layout?: 'scroll' | 'wrap';
}

/** A single-select row of chips. */
export function ChipRow<T extends string>({
  options,
  value,
  onChange,
  layout = 'scroll',
}: ChipRowProps<T>) {
  const chips = options.map((opt) => (
    <Chip
      key={opt.value}
      label={opt.label}
      active={opt.value === value}
      disabled={opt.disabled}
      activeBg={opt.activeBg}
      activeFg={opt.activeFg}
      onPress={() => onChange(opt.value)}
    />
  ));

  if (layout === 'wrap') {
    return <View style={styles.wrap}>{chips}</View>;
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      {chips}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  scroll: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing['2xl'],
  },
});
