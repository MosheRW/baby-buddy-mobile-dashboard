import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, FieldLabel, ToggleSwitch } from '../../../components';
import { colors, fontSize, radii, spacing } from '../../../theme';
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

/**
 * Sleep. Create mode is timer-driven (start → live elapsed + "Woke up at" →
 * stop). Edit mode instead exposes a "Still sleeping" switch; turning it off
 * reveals the wake time, which is what actually ends the sleep.
 */
export function SleepFields({ draft, patch, childId, mode, now }: SleepFieldsProps) {
  if (mode === 'create') {
    return (
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
    );
  }

  return (
    <>
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
