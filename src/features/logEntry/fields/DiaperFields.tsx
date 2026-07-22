import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, FieldLabel, Stepper } from '../../../components';
import { EntryGlyph } from '../../../components/glyphs/entryGlyphs';
import type { GlyphKind } from '../../../lib/entryDisplay';
import { colors, fontSize, pooSwatch, radii, spacing, tints } from '../../../theme';
import type { PooColor } from '../../../api/types';
import { diaperAmountLabel, type FormDraft } from '../../../lib/formDraft';

interface FieldProps {
  draft: FormDraft;
  patch: (patch: Partial<FormDraft>) => void;
}

const POO_COLORS = Object.keys(pooSwatch) as PooColor[];

/**
 * Pee and Poo are two independent toggles — a diaper can be pee-only, poo-only,
 * or both — so this is deliberately NOT a segmented control. The poo-color row
 * only appears when Poo is on: a color is meaningless (and never saved) without
 * it, so showing the swatches for a pee-only change is just noise.
 */
export function DiaperFields({ draft, patch }: FieldProps) {
  const { t } = useTranslation();
  return (
    <>
      <View>
        <FieldLabel>{t('diaper.contents')}</FieldLabel>
        <View style={styles.toggles}>
          <TogglePill
            label={t('diaper.pee')}
            glyph="diaperPee"
            active={draft.pee}
            tint={tints.pee}
            onPress={() => patch({ pee: !draft.pee })}
          />
          <TogglePill
            label={t('diaper.poo')}
            glyph="diaperPoo"
            active={draft.poo}
            tint={tints.poo}
            onPress={() => patch({ poo: !draft.poo })}
          />
        </View>
      </View>

      {draft.poo ? (
        <View>
          <FieldLabel>{t('diaper.pooColor')}</FieldLabel>
          <View style={styles.swatches}>
            {POO_COLORS.map((color) => (
              <Pressable
                key={color}
                accessibilityRole="button"
                accessibilityLabel={t('diaper.pooColorAria', { color })}
                accessibilityState={{ selected: draft.pooColor === color }}
                onPress={() => patch({ pooColor: color })}
                style={[styles.swatchRing, draft.pooColor === color && styles.swatchRingActive]}
              >
                <View style={[styles.swatch, { backgroundColor: pooSwatch[color] }]} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View>
        <FieldLabel>{diaperAmountLabel(draft.pee, draft.poo)}</FieldLabel>
        <Stepper
          value={draft.diaperAmount}
          onChange={(diaperAmount) => patch({ diaperAmount })}
          step={1}
          min={1}
          max={10}
          suffix={t('diaper.amountSuffix')}
          // The 1–10 subjective scale gains nothing from manual entry or a
          // magnitude ramp; keep the plain stepper.
          enhanced={false}
        />
      </View>
    </>
  );
}

function TogglePill({
  label,
  glyph,
  active,
  tint,
  onPress,
}: {
  label: string;
  glyph: GlyphKind;
  active: boolean;
  tint: { bg: string; fg: string };
  onPress: () => void;
}) {
  const fg = active ? tint.fg : colors.textMuted;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.pill, { backgroundColor: active ? tint.bg : colors.card }]}
    >
      <EntryGlyph kind={glyph} size={22} color={fg} />
      <AppText size={fontSize.body} weight="800" color={fg}>
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
    gap: spacing.sm,
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
