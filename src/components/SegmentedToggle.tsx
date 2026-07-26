import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { fontSize, radii, spacing, useTheme, useThemedStyles, type AppTheme } from '../theme';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /**
   * Optional glyph stacked above the label. A render-prop rather than a node
   * because RN-SVG has no `currentColor` cascade — the segment draws it in its
   * own text colour, which it passes in.
   */
  glyph?: (color: string) => React.ReactNode;
}

interface SegmentedToggleProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * Segmented pill toggle: 14px-radius container, 4px inner padding, active
 * segment = white bg + subtle shadow. Used for login mode, temp method,
 * scheduled/as-needed.
 */
export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
}: SegmentedToggleProps<T>) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.container}>
      {options.map((opt) => {
        const active = opt.value === value;
        const fg = active ? colors.textPrimary : colors.textMuted;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(opt.value)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            {opt.glyph ? opt.glyph(fg) : null}
            <AppText size={fontSize.body} weight={active ? '800' : '700'} color={fg}>
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = ({ colors, shadows }: AppTheme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: colors.neutral,
      borderRadius: radii.control,
      padding: 4,
      gap: 4,
    },
    segment: {
      flex: 1,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.md,
      borderRadius: radii.chipSmall,
    },
    segmentActive: {
      backgroundColor: colors.card,
      ...(shadows.feedRow as object),
    },
  });
