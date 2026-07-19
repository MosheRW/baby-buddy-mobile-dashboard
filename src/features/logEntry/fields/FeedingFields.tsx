import React from 'react';
import { View } from 'react-native';
import { ChipRow, FieldLabel, Stepper } from '../../../components';
import type { ChipOption } from '../../../components';
import type { FeedingKind, FeedingMethod } from '../../../api/types';
import { feedingKindLabel, feedingMethodLabel } from '../../../lib/entryDisplay';
import {
  amountUnit,
  methodForKindChange,
  methodsForKind,
  showsAmount,
  showsDuration,
  type FormDraft,
} from '../../../lib/formDraft';
import { useTimerStore } from '../../../stores';
import { TimerControl } from '../TimerControl';

interface FeedingFieldsProps {
  draft: FormDraft;
  patch: (patch: Partial<FormDraft>) => void;
  childId: string;
  mode: 'create' | 'edit';
  now: number;
}

const KIND_OPTIONS: ChipOption<FeedingKind>[] = (
  ['breastMilk', 'formula', 'fortifiedBreastMilk', 'solidFood'] as FeedingKind[]
).map((k) => ({ value: k, label: feedingKindLabel[k] }));

/**
 * Feeding fields. Two conditional rules from the handoff:
 *  - Method options depend on Kind (formula/fortified are bottle-only).
 *  - Amount shows for bottle feeds and solids; Duration shows only for direct
 *    breast methods and only while no timer is running (otherwise the duration
 *    comes from the timer).
 */
export function FeedingFields({ draft, patch, childId, mode, now }: FeedingFieldsProps) {
  const timerRunning = useTimerStore((s) =>
    s.timers.some((t) => t.type === 'feeding' && t.childId === childId),
  );

  const methodOptions: ChipOption<FeedingMethod>[] = methodsForKind(draft.kind).map((m) => ({
    value: m,
    label: feedingMethodLabel[m],
  }));

  const changeKind = (kind: FeedingKind) =>
    // Keep the method valid for the new kind (e.g. Left Breast → Bottle).
    patch({ kind, method: methodForKindChange(kind, draft.method) });

  return (
    <>
      <View>
        <FieldLabel>Type</FieldLabel>
        <ChipRow layout="wrap" options={KIND_OPTIONS} value={draft.kind} onChange={changeKind} />
      </View>

      <View>
        <FieldLabel>Method</FieldLabel>
        <ChipRow
          layout="wrap"
          options={methodOptions}
          value={draft.method}
          onChange={(method) => patch({ method })}
        />
      </View>

      {mode === 'create' ? (
        <TimerControl
          type="feeding"
          childId={childId}
          now={now}
          endTimeLabel="End time"
          endTime={draft.endTime}
          onEndTimeChange={(endTime) => patch({ endTime })}
          onStop={(startedAt, endedAt) =>
            patch({
              time: new Date(startedAt).toISOString(),
              endTime: new Date(endedAt).toISOString(),
              durationMinutes: Math.max(1, Math.round((endedAt - startedAt) / 60_000)),
            })
          }
        />
      ) : null}

      {showsAmount(draft.kind, draft.method) ? (
        <View>
          <FieldLabel>Amount</FieldLabel>
          <Stepper
            value={draft.amount}
            onChange={(amount) => patch({ amount })}
            step={10}
            min={0}
            suffix={amountUnit(draft.kind)}
          />
        </View>
      ) : null}

      {showsDuration(draft.method, timerRunning) ? (
        <View>
          <FieldLabel>Duration</FieldLabel>
          <Stepper
            value={draft.durationMinutes}
            onChange={(durationMinutes) => patch({ durationMinutes })}
            step={5}
            min={0}
            suffix=" min"
          />
        </View>
      ) : null}
    </>
  );
}
