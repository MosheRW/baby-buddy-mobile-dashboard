import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
import { colors, fontSize, radii, spacing, tints } from '../../../theme';
import type { DosageUnit, Entry, MedicationRoute, MedicationSchedule } from '../../../api/types';
import {
  DOSE_UNITS,
  DOSE_UNIT_ORDER,
  doseFieldLabel,
  formatDose,
  medicationSuggestions,
} from '../../../lib/medication';
import {
  REPEAT_HOURS,
  isCustomRepeat,
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

const SCHEDULE_OPTIONS: SegmentOption<MedicationSchedule>[] = [
  { value: 'scheduled', label: 'Scheduled', glyph: (c) => <ScheduledGlyph size={15} color={c} /> },
  { value: 'asNeeded', label: 'As-needed', glyph: (c) => <AsNeededGlyph size={13} color={c} /> },
];

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

const UNIT_OPTIONS: ChipOption<DosageUnit>[] = DOSE_UNIT_ORDER.map((u) => ({
  value: u,
  label: DOSE_UNITS[u].label,
  glyph: (color: string) => <UnitGlyph unit={u} size={15} color={color} />,
}));

const ROUTE_OPTIONS: { value: MedicationRoute; label: string }[] = [
  { value: 'orally', label: 'Orally' },
  { value: 'anal', label: 'Anal' },
];

const REPEAT_OPTIONS: ChipOption<RepeatChoice>[] = [
  ...REPEAT_HOURS.map((h) => ({ value: String(h), label: `${h}h` })),
  { value: CUSTOM, label: 'Custom' },
];

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
  const suggestions = medicationSuggestions(entries);
  const custom = isCustomRepeat(draft.repeatHours);
  const spec = DOSE_UNITS[draft.doseUnit];

  const chooseRepeat = (choice: RepeatChoice) => {
    if (choice === CUSTOM) {
      // Seed the custom field just off-preset so the Custom chip stays selected.
      if (!custom) patch({ repeatHours: 6.5 });
      return;
    }
    patch({ repeatHours: Number(choice) });
  };

  // A blank limit means "say nothing about the limit", which leaves the pair's
  // existing one standing — see `maxDose24h` in lib/formDraft.
  const changeMaxDose = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return patch({ maxDose24h: null });
    const value = Number(trimmed);
    if (!Number.isFinite(value) || value < 0) return;
    patch({ maxDose24h: Math.round(value * 10) / 10 });
  };

  return (
    <>
      {suggestions.length > 0 ? (
        <View>
          <FieldLabel>Recent medications</FieldLabel>
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
                    {formatDose(m.dose, m.doseUnit)} · every {m.repeatHours}h
                  </AppText>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <TextField
        label="Medicine name"
        placeholder="e.g. Tylenol"
        value={draft.medName}
        onChangeText={(medName) => patch({ medName })}
      />

      <View>
        <FieldLabel>Schedule</FieldLabel>
        <SegmentedToggle
          options={SCHEDULE_OPTIONS}
          value={draft.schedule}
          onChange={(schedule) => patch({ schedule })}
        />
      </View>

      <View>
        <FieldLabel>Unit</FieldLabel>
        <ChipRow
          layout="wrap"
          options={UNIT_OPTIONS}
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
            step={spec.step}
            min={0}
            decimals={spec.precision}
          />
        </View>
      ) : null}

      {showsRoute(draft.doseUnit) ? (
        <View>
          <FieldLabel>Route</FieldLabel>
          <SegmentedToggle
            options={ROUTE_OPTIONS}
            value={draft.route}
            onChange={(route) => patch({ route })}
          />
        </View>
      ) : null}

      {showsBodyArea(draft.doseUnit) ? (
        <TextField
          label="Body area"
          placeholder="e.g. chest, back"
          value={draft.bodyArea}
          onChangeText={(bodyArea) => patch({ bodyArea })}
        />
      ) : null}

      <View>
        <FieldLabel>{repeatLabel(draft.schedule)}</FieldLabel>
        <ChipRow
          layout="wrap"
          options={REPEAT_OPTIONS}
          value={custom ? CUSTOM : String(draft.repeatHours)}
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
              suffix=" h"
            />
          </View>
        ) : null}
      </View>

      {showsMaxDose(draft.schedule) ? (
        <View>
          <FieldLabel>Max dose per 24h (optional)</FieldLabel>
          <MaxDoseField
            value={draft.maxDose24h}
            unitLabel={spec.label}
            onChange={changeMaxDose}
          />
          <AppText
            size={fontSize.metaSm}
            weight="600"
            color={colors.textMuted}
            style={styles.hint}
          >
            Leave blank to keep whatever limit this medicine already has. We&apos;ll warn before a
            dose would exceed it in a rolling 24h window.
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
      placeholder={`No limit (${unitLabel})`}
      value={raw}
      onChangeText={(text) => {
        setRaw(text);
        onChange(text);
      }}
    />
  );
}

const styles = StyleSheet.create({
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
