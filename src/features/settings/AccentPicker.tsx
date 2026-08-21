/**
 * Curated accent-colour picker: an "auto" chip (no override → fall back to the
 * group colour or the child's default hue) plus a row of on-theme swatches. The
 * swatch fill is the accent's saturated name colour, so what you pick previews
 * the colour the name will take.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Chip } from '../../components';
import {
  ACCENT_SWATCHES,
  accentColors,
  DYNAMIC_ACCENT_HUE,
  radii,
  spacing,
  useTheme,
  useThemedStyles,
  type AppTheme,
} from '../../theme';

interface AccentPickerProps {
  /** Selected hue, or null for "auto" (no override). */
  value: number | null;
  onChange: (hue: number | null) => void;
  /** Localised label for the "auto / no override" option. */
  autoLabel: string;
  /**
   * Localised label for the "match phone" (Material You) option. When set, the
   * chip renders and binds to `DYNAMIC_ACCENT_HUE`; omit it to hide the option
   * entirely (non-Android, or a device without Material You support). Making the
   * label itself the presence signal means the chip can never render blank.
   */
  matchPhoneLabel?: string;
}

export function AccentPicker({ value, onChange, autoLabel, matchPhoneLabel }: AccentPickerProps) {
  const { scheme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.wrap}>
      <Chip label={autoLabel} active={value == null} onPress={() => onChange(null)} />
      {matchPhoneLabel != null ? (
        <Chip
          label={matchPhoneLabel}
          active={value === DYNAMIC_ACCENT_HUE}
          onPress={() => onChange(DYNAMIC_ACCENT_HUE)}
        />
      ) : null}
      {ACCENT_SWATCHES.map(({ id, hue }) => {
        const selected = value === hue;
        const accent = accentColors(hue, scheme);
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

const makeStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
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
