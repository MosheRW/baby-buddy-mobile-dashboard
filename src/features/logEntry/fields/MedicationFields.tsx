import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText, ChipRow, FieldLabel, SegmentedToggle, Stepper, TextField } from '../../../components';
import type { ChipOption } from '../../../components';
import { colors, fontSize, radii, spacing } from '../../../theme';
import type { Entry, MedicationSchedule } from '../../../api/types';
import { medicationSuggestions } from '../../../lib/medication';
import { REPEAT_HOURS, isCustomRepeat, repeatLabel, type FormDraft } from '../../../lib/formDraft';

interface MedicationFieldsProps {
  draft: FormDraft;
  patch: (patch: Partial<FormDraft>) => void;
  /** All entries for this child — the suggestion list is derived from them. */
  entries: Entry[];
}

type RepeatChoice = string;

const CUSTOM = 'custom';

const SCHEDULE_OPTIONS: { value: MedicationSchedule; label: string }[] = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'asNeeded', label: 'As-needed' },
];

const REPEAT_OPTIONS: ChipOption<RepeatChoice>[] = [
  ...REPEAT_HOURS.map((h) => ({ value: String(h), label: `${h}h` })),
  { value: CUSTOM, label: 'Custom' },
];

/**
 * Medication fields. Tapping a recent-medication suggestion prefills the whole
 * group (name, dose, schedule, repeat) — the common case is re-logging a dose
 * of something already given.
 */
export function MedicationFields({ draft, patch, entries }: MedicationFieldsProps) {
  const suggestions = medicationSuggestions(entries);
  const custom = isCustomRepeat(draft.repeatHours);

  const chooseRepeat = (choice: RepeatChoice) => {
    if (choice === CUSTOM) {
      // Seed the custom field just off-preset so the Custom chip stays selected.
      if (!custom) patch({ repeatHours: 6.5 });
      return;
    }
    patch({ repeatHours: Number(choice) });
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
                onPress={() =>
                  patch({
                    medName: m.name,
                    dose: m.dose,
                    schedule: m.schedule,
                    repeatHours: m.repeatHours,
                  })
                }
                style={styles.suggestion}
              >
                <AppText size={fontSize.bodySm} weight="700">
                  {m.name}
                </AppText>
                <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
                  {m.dose} · every {m.repeatHours}h
                </AppText>
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
        <FieldLabel>Dose</FieldLabel>
        <Stepper
          value={draft.dose}
          onChange={(dose) => patch({ dose })}
          step={0.5}
          min={0}
          decimals={1}
        />
      </View>

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
    </>
  );
}

const styles = StyleSheet.create({
  suggestions: {
    // Handoff: the list scrolls rather than pushing the form down.
    maxHeight: 140,
  },
  suggestion: {
    backgroundColor: colors.card,
    borderRadius: radii.tile,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing['2xl'],
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  customField: {
    marginTop: spacing.lg,
  },
});
