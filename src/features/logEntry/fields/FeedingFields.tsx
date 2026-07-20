import React from 'react';
import { View } from 'react-native';
import { ChipRow, FieldLabel, Stepper } from '../../../components';
import type { ChipOption } from '../../../components';
import type { Entry, FeedingKind, FeedingMethod, SolidFoodType } from '../../../api/types';
import { feedingKindLabel, feedingMethodLabel } from '../../../lib/entryDisplay';
import { defaultTimeForMethod } from '../../../lib/feed';
import {
  SOLID_FOOD_TYPES,
  amountUnit,
  baselinePatch,
  methodForKindChange,
  methodsForKind,
  showsAmount,
  showsDuration,
  solidFoodTypeLabel,
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
  /** This child's entries — the direct-breast baseline is averaged from them. */
  entries: Entry[];
  /** This child's usual bottle amount, captured as the bottle baseline. */
  defaultFoodMl: number;
}

const KIND_OPTIONS: ChipOption<FeedingKind>[] = (
  ['breastMilk', 'formula', 'fortifiedBreastMilk', 'solidFood'] as FeedingKind[]
).map((k) => ({ value: k, label: feedingKindLabel[k] }));

const SOLID_TYPE_OPTIONS: ChipOption<SolidFoodType>[] = SOLID_FOOD_TYPES.map((t) => ({
  value: t,
  label: solidFoodTypeLabel[t],
}));

/**
 * Feeding fields. The conditional rules, all pure in `lib/formDraft`:
 *  - Method options depend on Kind (formula/fortified are bottle-only).
 *  - Solids reveal a food-type row, and fruits/vegetables then hide Amount —
 *    nobody weighs a few grapes.
 *  - Amount shows for bottle feeds and weighed solids; Duration shows only for
 *    direct breast methods and only while no timer is running (otherwise the
 *    duration comes from the timer).
 *  - Picking a method stamps that method's baseline onto the draft.
 */
export function FeedingFields({
  draft,
  patch,
  childId,
  mode,
  now,
  entries,
  defaultFoodMl,
}: FeedingFieldsProps) {
  const timerRunning = useTimerStore((s) =>
    s.timers.some((t) => t.type === 'feeding' && t.childId === childId),
  );

  const methodOptions: ChipOption<FeedingMethod>[] = methodsForKind(draft.kind).map((m) => ({
    value: m,
    label: feedingMethodLabel[m],
  }));

  // Stamp the baseline at the moment of selection, not at save: what counted as
  // a normal feed *then* is what the feed's gauge should compare against.
  const baseline = (method: FeedingMethod) =>
    baselinePatch(method, defaultFoodMl, defaultTimeForMethod(entries, method, now));

  const changeKind = (kind: FeedingKind) => {
    // Keep the method valid for the new kind (e.g. Left Breast → Bottle).
    const method = methodForKindChange(kind, draft.method);
    patch({ kind, method, ...baseline(method) });
  };

  const changeMethod = (method: FeedingMethod) => patch({ method, ...baseline(method) });

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
          onChange={changeMethod}
        />
      </View>

      {draft.kind === 'solidFood' ? (
        <View>
          <FieldLabel>Food type</FieldLabel>
          <ChipRow
            layout="wrap"
            options={SOLID_TYPE_OPTIONS}
            value={draft.solidFoodType}
            onChange={(solidFoodType) => patch({ solidFoodType })}
          />
        </View>
      ) : null}

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

      {showsAmount(draft.kind, draft.method, draft.solidFoodType) ? (
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
