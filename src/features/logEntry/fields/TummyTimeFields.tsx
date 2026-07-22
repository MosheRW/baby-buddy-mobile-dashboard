import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const timerRunning = useTimerStore((s) =>
    s.timers.some((timer) => timer.type === 'tummyTime' && timer.childId === childId),
  );

  return (
    <>
      {!timerRunning ? (
        <View>
          <FieldLabel>{t('feeding.durationLabel')}</FieldLabel>
          <Stepper
            value={draft.tummyMinutes}
            onChange={(tummyMinutes) => patch({ tummyMinutes })}
            step={1}
            min={0}
            suffix={t('feeding.durationSuffix')}
          />
        </View>
      ) : null}

      {mode === 'create' && !timerRunning ? (
        <StartTimerButton type="tummyTime" childId={childId} />
      ) : null}
    </>
  );
}
