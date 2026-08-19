import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  AppText,
  ChipRow,
  FieldLabel,
  SegmentedToggle,
  Stepper,
  TextField,
} from '../../../components';
import type { ChipOption, SegmentOption } from '../../../components';
import {
  AsNeededGlyph,
  MedDropsGlyph,
  MedMgGlyph,
  MedMlGlyph,
  MedPasteGlyph,
  MedTabletsGlyph,
  ScheduledGlyph,
  type EntryGlyphProps,
} from '../../../components/glyphs/entryGlyphs';
import { fontSize, radii, spacing, useTheme, useThemedStyles, type AppTheme } from '../../../theme';
import type { DosageUnit, Entry, MedicationRoute, MedicationSchedule } from '../../../api/types';
import {
  DOSE_UNIT_ORDER,
  doseFieldLabel,
  doseUnitLabel,
  formatDose,
  medicationSuggestions,
} from '../../../lib/medication';
import {
  REPEAT_HOURS,
  isNoRepeat,
  medSuggestionPatch,
  repeatLabel,
  showsBodyArea,
  showsDose,
  showsMaxDose,
  showsRoute,
  type FormDraft,
} from '../../../lib/formDraft';

interface MedicationFieldsProps {
  draft: FormDraft;
  patch: (patch: Partial<FormDraft>) => void;
  /** All entries for this child — the suggestion list is derived from them. */
  entries: Entry[];
}

type RepeatChoice = string;

const CUSTOM = 'custom';
const ONCE = 'once';
/** The value the custom stepper opens on when nothing custom was set yet. */
const CUSTOM_SEED = 6.5;

// RN-SVG has no `currentColor`, so the chip passes its text colour into the
// render-prop — the unit glyph resolves to a named component drawn in that hue.
const UNIT_GLYPH: Record<DosageUnit, React.ComponentType<EntryGlyphProps>> = {
  mg: MedMgGlyph,
  ml: MedMlGlyph,
  tablets: MedTabletsGlyph,
  drops: MedDropsGlyph,
  paste: MedPasteGlyph,
};

// Fixed component behind a dynamic key, so both the unit chip's inline glyph and
// the suggestion-row swatch resolve to a named component.
function UnitGlyph({ unit, size, color }: EntryGlyphProps & { unit: DosageUnit }) {
  const Glyph = UNIT_GLYPH[unit];
  return <Glyph size={size} color={color} />;
}

/**
 * Medication fields. The unit drives most of the group: it sets the dose
 * stepper's step/precision/label, and reveals a route toggle (tablets) or a
 * body-area field (paste, which has no dose at all). The 24h ceiling only
 * applies to as-needed doses.
 *
 * Tapping a recent-medication suggestion prefills the whole group — the common
 * case is re-logging a dose of something already given.
 */
export function MedicationFields({ draft, patch, entries }: MedicationFieldsProps) {
  const { t } = useTranslation();
  const { colors, tints } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const suggestions = medicationSuggestions(entries);
  const noRepeat = isNoRepeat(draft.repeatHours);
  // Custom mode is tracked on the draft, not derived from the value, so stepping
  // the custom interval onto a preset number (6h, 8h) doesn't collapse the field.
  const custom = draft.repeatCustom && !noRepeat;

  const scheduleOptions: SegmentOption<MedicationSchedule>[] = [
    {
      value: 'scheduled',
      label: t('medForm.scheduled'),
      glyph: (c) => <ScheduledGlyph size={15} color={c} />,
    },
    {
      value: 'asNeeded',
      label: t('medForm.asNeeded'),
      glyph: (c) => <AsNeededGlyph size={13} color={c} />,
    },
  ];

  const unitOptions: ChipOption<DosageUnit>[] = DOSE_UNIT_ORDER.map((u) => ({
    value: u,
    label: doseUnitLabel(u),
    glyph: (color: string) => <UnitGlyph unit={u} size={15} color={color} />,
  }));

  const routeOptions: SegmentOption<MedicationRoute>[] = [
    { value: 'orally', label: t('medForm.routeOrally') },
    { value: 'anal', label: t('medForm.routeAnal') },
  ];

  const repeatOptions: ChipOption<RepeatChoice>[] = [
    { value: ONCE, label: t('medForm.once') },
    ...REPEAT_HOURS.map((h) => ({ value: String(h), label: `${h}h` })),
    { value: CUSTOM, label: t('medForm.custom') },
  ];

  const selectedRepeat = noRepeat ? ONCE : custom ? CUSTOM : String(draft.repeatHours);

  const chooseRepeat = (choice: RepeatChoice) => {
    if (choice === ONCE) return patch({ repeatHours: 0, repeatCustom: false });
    if (choice === CUSTOM) {
      // Keep the current custom value if there is one; otherwise open just
      // off-preset so the Custom chip stays selected.
      patch({ repeatHours: custom ? draft.repeatHours : CUSTOM_SEED, repeatCustom: true });
      return;
    }
    patch({ repeatHours: Number(choice), repeatCustom: false });
  };

  // A blank limit means "say nothing about the limit", which leaves the pair's
  // existing one standing — see `maxDose24h` in lib/formDraft.
  const changeMaxDose = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return patch({ maxDose24h: null });
    const value = Number(trimmed);
    if (!Number.isFinite(value) || value < 0) return;
    // Up to 4 fractional digits; number→String drops any trailing zeros.
    patch({ maxDose24h: Math.round(value * 1e4) / 1e4 });
  };

  return (
    <>
      {suggestions.length > 0 ? (
        <View>
          <FieldLabel>{t('medForm.recent')}</FieldLabel>
          <ScrollView style={styles.suggestions} nestedScrollEnabled>
            {suggestions.map((m) => (
              <Pressable
                key={m.id}
                accessibilityRole="button"
                onPress={() => patch(medSuggestionPatch(m))}
                style={styles.suggestion}
              >
                <View style={styles.suggestionIcon}>
                  <UnitGlyph unit={m.doseUnit} size={13} color={tints.eligible.fg} />
                </View>
                <View style={styles.suggestionText}>
                  <AppText size={fontSize.bodySm} weight="700">
                    {m.name}
                  </AppText>
                  <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
                    {t('medForm.recentMeta', {
                      dose: formatDose(m.dose, m.doseUnit),
                      hours: m.repeatHours,
                    })}
                  </AppText>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <TextField
        label={t('medForm.name')}
        placeholder={t('medForm.namePlaceholder')}
        value={draft.medName}
        onChangeText={(medName) => patch({ medName })}
      />

      <View>
        <FieldLabel>{t('medForm.schedule')}</FieldLabel>
        <SegmentedToggle
          options={scheduleOptions}
          value={draft.schedule}
          onChange={(schedule) => patch({ schedule })}
        />
      </View>

      <View>
        <FieldLabel>{t('medForm.unit')}</FieldLabel>
        <ChipRow
          layout="wrap"
          options={unitOptions}
          value={draft.doseUnit}
          onChange={(doseUnit) => patch({ doseUnit })}
        />
      </View>

      {showsDose(draft.doseUnit) ? (
        <View>
          <FieldLabel>{doseFieldLabel(draft.doseUnit)}</FieldLabel>
          <Stepper
            value={draft.dose}
            onChange={(dose) => patch({ dose })}
            // Deliberately a uniform 0.1 fine step across all units (a product
            // decision), not the per-unit `spec.step`; the press-and-hold ramp
            // covers larger doses.
            step={0.1}
            min={0}
            // Allow up to 4 fractional digits via manual entry; `trimZeros` hides
            // the unused ones so a whole dose reads "5", not "5.0000".
            decimals={4}
            trimZeros
          />
        </View>
      ) : null}

      {showsRoute(draft.doseUnit) ? (
        <View>
          <FieldLabel>{t('medForm.route')}</FieldLabel>
          <SegmentedToggle
            options={routeOptions}
            value={draft.route}
            onChange={(route) => patch({ route })}
          />
        </View>
      ) : null}

      {showsBodyArea(draft.doseUnit) ? (
        <TextField
          label={t('medForm.bodyArea')}
          placeholder={t('medForm.bodyAreaPlaceholder')}
          value={draft.bodyArea}
          onChangeText={(bodyArea) => patch({ bodyArea })}
        />
      ) : null}

      <View>
        <FieldLabel>{repeatLabel(draft.schedule)}</FieldLabel>
        <ChipRow
          layout="wrap"
          options={repeatOptions}
          value={selectedRepeat}
          onChange={chooseRepeat}
        />
        {custom ? (
          <View style={styles.customField}>
            <Stepper
              value={draft.repeatHours}
              onChange={(repeatHours) => patch({ repeatHours })}
              step={0.5}
              min={0.5}
              decimals={1}
              suffix={t('medForm.customSuffix')}
            />
          </View>
        ) : null}
      </View>

      {showsMaxDose(draft.schedule) ? (
        <View>
          <FieldLabel>{t('medForm.maxDose')}</FieldLabel>
          <MaxDoseField
            value={draft.maxDose24h}
            unitLabel={doseUnitLabel(draft.doseUnit)}
            onChange={changeMaxDose}
          />
          <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted} style={styles.hint}>
            {t('medForm.maxDoseHint')}
          </AppText>
        </View>
      ) : null}
    </>
  );
}

/**
 * The limit input keeps its own raw text so half-typed values ("2.", "") stay
 * on screen — binding the box straight to the parsed number would erase the
 * decimal point the moment it's typed. The draft still only ever holds a number
 * or null. It re-seeds when the draft value changes underneath it, which is how
 * a suggestion prefill and edit-mode hydration reach the box.
 */
function MaxDoseField({
  value,
  unitLabel,
  onChange,
}: {
  value: number | null;
  unitLabel: string;
  onChange: (text: string) => void;
}) {
  const { t } = useTranslation();
  const asText = (n: number | null) => (n == null ? '' : String(n));
  const [raw, setRaw] = useState(() => asText(value));
  // React's documented "adjust state when a prop changes" pattern — state, not
  // a ref, so it survives lint and re-renders correctly in the same pass.
  const [seeded, setSeeded] = useState(value);

  if (seeded !== value) {
    setSeeded(value);
    // Don't fight the user's own keystrokes — only re-seed when the incoming
    // value isn't what they just typed.
    const typed = raw.trim() === '' ? null : Number(raw);
    if (typed !== value) setRaw(asText(value));
  }

  return (
    <TextField
      keyboardType="decimal-pad"
      placeholder={t('medForm.noLimitPlaceholder', { unit: unitLabel })}
      value={raw}
      onChangeText={(text) => {
        setRaw(text);
        onChange(text);
      }}
    />
  );
}

const makeStyles = ({ colors, tints }: AppTheme) =>
  StyleSheet.create({
    suggestions: {
      // Handoff: the list scrolls rather than pushing the form down.
      maxHeight: 140,
    },
    suggestion: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.card,
      borderRadius: radii.tile,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing['2xl'],
      marginBottom: spacing.sm,
    },
    suggestionIcon: {
      width: 22,
      height: 22,
      borderRadius: radii.iconButton,
      backgroundColor: tints.eligible.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    suggestionText: {
      flex: 1,
      gap: spacing.xs,
    },
    customField: {
      marginTop: spacing.lg,
    },
    hint: {
      marginTop: spacing.sm,
      lineHeight: 15,
    },
  });
