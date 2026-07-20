import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, FieldLabel, SegmentedToggle, ToggleSwitch } from '../../../components';
import type { SegmentOption } from '../../../components';
import { colors, fontSize, radii, spacing } from '../../../theme';
import type { SleepType } from '../../../api/types';
import type { FormDraft } from '../../../lib/formDraft';
import { DateTimeField } from '../DateTimeField';
import { TimerControl } from '../TimerControl';

interface SleepFieldsProps {
  draft: FormDraft;
  patch: (patch: Partial<FormDraft>) => void;
  childId: string;
  mode: 'create' | 'edit';
  now: number;
}

const TYPE_OPTIONS: SegmentOption<SleepType>[] = [
  { value: 'nap', label: 'Nap' },
  { value: 'night', label: 'Night' },
];

/**
 * Sleep. Create mode is timer-driven (start → live elapsed + "Woke up at" →
 * stop). Edit mode instead exposes a "Still sleeping" switch; turning it off
 * reveals the wake time, which is what actually ends the sleep.
 *
 * The nap/night type shows in both modes — it decides the feed's icon, and the
 * clock-based guess in `defaultSleepType` is only a guess.
 */
export function SleepFields({ draft, patch, childId, mode, now }: SleepFieldsProps) {
  const typeField = (
    <View>
      <FieldLabel>Type</FieldLabel>
      <SegmentedToggle
        options={TYPE_OPTIONS}
        value={draft.sleepType}
        onChange={(sleepType) => patch({ sleepType })}
      />
    </View>
  );

  if (mode === 'create') {
    return (
      <>
        {typeField}
        <TimerControl
          type="sleep"
          childId={childId}
          now={now}
          endTimeLabel="Woke up at"
          endTime={draft.endTime}
          onEndTimeChange={(endTime) => patch({ endTime })}
          onStop={(startedAt, endedAt) =>
            patch({
              time: new Date(startedAt).toISOString(),
              endTime: new Date(endedAt).toISOString(),
              stillSleeping: false,
            })
          }
        />
      </>
    );
  }

  return (
    <>
      {typeField}

      <View style={styles.switchRow}>
        <AppText size={fontSize.body} weight="700">
          Still sleeping
        </AppText>
        <ToggleSwitch
          value={draft.stillSleeping}
          onValueChange={(stillSleeping) =>
            patch({
              stillSleeping,
              // Seed a sensible wake time the moment the sleep is ended.
              endTime: stillSleeping ? draft.endTime : (draft.endTime ?? new Date(now).toISOString()),
            })
          }
        />
      </View>

      {!draft.stillSleeping ? (
        <DateTimeField
          label="Woke up at"
          value={draft.endTime ?? new Date(now).toISOString()}
          onChange={(endTime) => patch({ endTime })}
        />
      ) : (
        <FieldLabel>Turn off to record a wake time</FieldLabel>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radii.control,
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing['2xl'],
  },
});
