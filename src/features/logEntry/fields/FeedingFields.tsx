import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChipRow, FieldLabel, Stepper } from '../../../components';
import type { ChipOption } from '../../../components';
import {
  FeedingBothBreastsGlyph,
  FeedingBottleGlyph,
  FeedingBreastGlyph,
  FeedingFortifiedGlyph,
  FeedingLeftBreastGlyph,
  FeedingParentFedGlyph,
  FeedingRightBreastGlyph,
  FeedingSelfFedGlyph,
  FeedingSolidGlyph,
  type EntryGlyphProps,
} from '../../../components/glyphs/entryGlyphs';
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
import { StartTimerButton } from '../TimerControl';

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

const KIND_GLYPH: Record<FeedingKind, React.ComponentType<EntryGlyphProps>> = {
  breastMilk: FeedingBreastGlyph,
  formula: FeedingBottleGlyph,
  fortifiedBreastMilk: FeedingFortifiedGlyph,
  solidFood: FeedingSolidGlyph,
};

const METHOD_GLYPH: Record<FeedingMethod, React.ComponentType<EntryGlyphProps>> = {
  bottle: FeedingBottleGlyph,
  leftBreast: FeedingLeftBreastGlyph,
  rightBreast: FeedingRightBreastGlyph,
  bothBreasts: FeedingBothBreastsGlyph,
  selfFed: FeedingSelfFedGlyph,
  parentFed: FeedingParentFedGlyph,
};

// Fixed components with a dynamic key, so the chip's inline `glyph` render-prop
// resolves to a named component (RN-SVG has no `currentColor`, so the chip
// passes its text colour in).
function KindGlyph({ kind, size, color }: EntryGlyphProps & { kind: FeedingKind }) {
  const Glyph = KIND_GLYPH[kind];
  return <Glyph size={size} color={color} />;
}

function MethodGlyph({ method, size, color }: EntryGlyphProps & { method: FeedingMethod }) {
  const Glyph = METHOD_GLYPH[method];
  return <Glyph size={size} color={color} />;
}

const KIND_VALUES: FeedingKind[] = ['breastMilk', 'formula', 'fortifiedBreastMilk', 'solidFood'];

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
  const { t } = useTranslation();
  const timerRunning = useTimerStore((s) =>
    s.timers.some((timer) => timer.type === 'feeding' && timer.childId === childId),
  );

  const kindOptions: ChipOption<FeedingKind>[] = KIND_VALUES.map((k) => ({
    value: k,
    label: feedingKindLabel(k),
    glyph: (color: string) => <KindGlyph kind={k} size={15} color={color} />,
  }));

  const solidTypeOptions: ChipOption<SolidFoodType>[] = SOLID_FOOD_TYPES.map((type) => ({
    value: type,
    label: solidFoodTypeLabel(type),
  }));

  const methodOptions: ChipOption<FeedingMethod>[] = methodsForKind(draft.kind).map((m) => ({
    value: m,
    label: feedingMethodLabel(m),
    glyph: (color: string) => <MethodGlyph method={m} size={15} color={color} />,
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
        <FieldLabel>{t('feeding.typeLabel')}</FieldLabel>
        <ChipRow layout="wrap" options={kindOptions} value={draft.kind} onChange={changeKind} />
      </View>

      <View>
        <FieldLabel>{t('feeding.methodLabel')}</FieldLabel>
        <ChipRow
          layout="wrap"
          options={methodOptions}
          value={draft.method}
          onChange={changeMethod}
        />
      </View>

      {draft.kind === 'solidFood' ? (
        <View>
          <FieldLabel>{t('feeding.foodTypeLabel')}</FieldLabel>
          <ChipRow
            layout="wrap"
            options={solidTypeOptions}
            value={draft.solidFoodType}
            onChange={(solidFoodType) => patch({ solidFoodType })}
          />
        </View>
      ) : null}

      {showsAmount(draft.kind, draft.method, draft.solidFoodType) ? (
        <View>
          <FieldLabel>{t('feeding.amountLabel')}</FieldLabel>
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
          <FieldLabel>{t('feeding.durationLabel')}</FieldLabel>
          <Stepper
            value={draft.durationMinutes}
            onChange={(durationMinutes) => patch({ durationMinutes })}
            step={1}
            min={0}
            suffix={t('feeding.durationSuffix')}
          />
        </View>
      ) : null}

      {mode === 'create' && !timerRunning ? (
        <StartTimerButton type="feeding" childId={childId} />
      ) : null}
    </>
  );
}
