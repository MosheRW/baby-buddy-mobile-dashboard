import React from 'react';
import { View } from 'react-native';
import { FieldLabel, Stepper } from '../../../components';
import type { FormDraft } from '../../../lib/formDraft';
import { useTimerStore } from '../../../stores';
import { StartTimerButton } from '../TimerControl';

interface TummyTimeFieldsProps {
  draft: FormDraft;
  patch: (patch: Partial<FormDraft>) => void;
  childId: string;
  mode: 'create' | 'edit';
  now: number;
}

/**
 * Tummy time: a duration stepper whenever no timer is running (a running timer
 * supplies the duration when it stops), plus a start-timer button in create
 * mode. The running strip and end-time field live in the form shell.
 */
export function TummyTimeFields({ draft, patch, childId, mode }: TummyTimeFieldsProps) {
  const timerRunning = useTimerStore((s) =>
    s.timers.some((t) => t.type === 'tummyTime' && t.childId === childId),
  );

  return (
    <>
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

      {mode === 'create' && !timerRunning ? (
        <StartTimerButton type="tummyTime" childId={childId} />
      ) : null}
    </>
  );
}
