import React from 'react';
import { View } from 'react-native';
import { FieldLabel, Stepper } from '../../../components';
import type { FormDraft } from '../../../lib/formDraft';
import { useTimerStore } from '../../../stores';
import { TimerControl } from '../TimerControl';

interface TummyTimeFieldsProps {
  draft: FormDraft;
  patch: (patch: Partial<FormDraft>) => void;
  childId: string;
  mode: 'create' | 'edit';
  now: number;
}

/**
 * Tummy time: the timer in create mode, and a duration stepper whenever no
 * timer is running (a running timer supplies the duration when it stops).
 */
export function TummyTimeFields({ draft, patch, childId, mode, now }: TummyTimeFieldsProps) {
  const timerRunning = useTimerStore((s) =>
    s.timers.some((t) => t.type === 'tummyTime' && t.childId === childId),
  );

  return (
    <>
      {mode === 'create' ? (
        <TimerControl
          type="tummyTime"
          childId={childId}
          now={now}
          endTimeLabel="End time"
          endTime={draft.endTime}
          onEndTimeChange={(endTime) => patch({ endTime })}
          onStop={(startedAt, endedAt) =>
            patch({
              time: new Date(startedAt).toISOString(),
              endTime: new Date(endedAt).toISOString(),
              tummyMinutes: Math.max(1, Math.round((endedAt - startedAt) / 60_000)),
            })
          }
        />
      ) : null}

      {!timerRunning ? (
        <View>
          <FieldLabel>Duration</FieldLabel>
          <Stepper
            value={draft.tummyMinutes}
            onChange={(tummyMinutes) => patch({ tummyMinutes })}
            step={5}
            min={0}
            suffix=" min"
          />
        </View>
      ) : null}
    </>
  );
}
