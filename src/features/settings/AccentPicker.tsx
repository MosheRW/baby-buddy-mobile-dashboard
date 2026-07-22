/**
 * Curated accent-colour picker: an "auto" chip (no override → fall back to the
 * group colour or the child's default hue) plus a row of on-theme swatches. The
 * swatch fill is the accent's saturated name colour, so what you pick previews
 * the colour the name will take.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Chip } from '../../components';
import { ACCENT_SWATCHES, accentColors, colors, radii, spacing } from '../../theme';

interface AccentPickerProps {
  /** Selected hue, or null for "auto" (no override). */
  value: number | null;
  onChange: (hue: number | null) => void;
  /** Localised label for the "auto / no override" option. */
  autoLabel: string;
}

export function AccentPicker({ value, onChange, autoLabel }: AccentPickerProps) {
  return (
    <View style={styles.wrap}>
      <Chip label={autoLabel} active={value == null} onPress={() => onChange(null)} />
      {ACCENT_SWATCHES.map(({ id, hue }) => {
        const selected = value === hue;
        const accent = accentColors(hue);
        return (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityLabel={id}
            accessibilityState={{ selected }}
            onPress={() => onChange(hue)}
            style={[
              styles.swatch,
              { backgroundColor: accent.name },
              selected && styles.swatchSelected,
            ]}
          />
        );
      })}
    </View>
  );
}

const SWATCH = 34;

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
  },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: SWATCH / 2,
    borderWidth: 3,
    borderColor: colors.card,
  },
  swatchSelected: {
    borderColor: colors.textPrimary,
    borderRadius: radii.pill,
  },
});
