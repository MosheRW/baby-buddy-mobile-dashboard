import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, FieldLabel } from '../../../components';
import { colors, fontSize, pooSwatch, radii, spacing, tints } from '../../../theme';
import type { PooColor } from '../../../api/types';
import type { FormDraft } from '../../../lib/formDraft';

interface FieldProps {
  draft: FormDraft;
  patch: (patch: Partial<FormDraft>) => void;
}

const POO_COLORS = Object.keys(pooSwatch) as PooColor[];

/**
 * Pee and Poo are two independent toggles — a diaper can be pee-only, poo-only,
 * or both — so this is deliberately NOT a segmented control. The poo-color row
 * is always visible but only meaningful (and only saved) when Poo is on.
 */
export function DiaperFields({ draft, patch }: FieldProps) {
  return (
    <>
      <View>
        <FieldLabel>Contents</FieldLabel>
        <View style={styles.toggles}>
          <TogglePill
            label="Pee"
            active={draft.pee}
            tint={tints.pee}
            onPress={() => patch({ pee: !draft.pee })}
          />
          <TogglePill
            label="Poo"
            active={draft.poo}
            tint={tints.poo}
            onPress={() => patch({ poo: !draft.poo })}
          />
        </View>
      </View>

      <View>
        <FieldLabel>Poo color</FieldLabel>
        <View style={styles.swatches}>
          {POO_COLORS.map((color) => (
            <Pressable
              key={color}
              accessibilityRole="button"
              accessibilityLabel={`${color} poo color`}
              accessibilityState={{ selected: draft.pooColor === color }}
              onPress={() => patch({ pooColor: color })}
              style={[styles.swatchRing, draft.pooColor === color && styles.swatchRingActive]}
            >
              <View style={[styles.swatch, { backgroundColor: pooSwatch[color] }]} />
            </Pressable>
          ))}
        </View>
      </View>
    </>
  );
}

function TogglePill({
  label,
  active,
  tint,
  onPress,
}: {
  label: string;
  active: boolean;
  tint: { bg: string; fg: string };
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.pill, { backgroundColor: active ? tint.bg : colors.card }]}
    >
      <AppText
        size={fontSize.body}
        weight="800"
        color={active ? tint.fg : colors.textMuted}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toggles: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    borderRadius: radii.control,
  },
  swatches: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  swatchRing: {
    padding: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchRingActive: {
    borderColor: colors.accent,
  },
  swatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
});
