import React from 'react';
import { View } from 'react-native';
import { FieldLabel, SegmentedToggle, Stepper } from '../../../components';
import type { TemperatureMethod } from '../../../api/types';
import { temperatureMethodLabel } from '../../../lib/entryDisplay';
import type { FormDraft } from '../../../lib/formDraft';

interface FieldProps {
  draft: FormDraft;
  patch: (patch: Partial<FormDraft>) => void;
}

const METHOD_OPTIONS: { value: TemperatureMethod; label: string }[] = (
  ['oral', 'ear', 'forehead'] as TemperatureMethod[]
).map((m) => ({ value: m, label: temperatureMethodLabel[m] }));

export function TemperatureFields({ draft, patch }: FieldProps) {
  return (
    <>
      <View>
        <FieldLabel>Temperature</FieldLabel>
        <Stepper
          value={draft.temperature}
          onChange={(temperature) => patch({ temperature })}
          step={0.1}
          min={30}
          max={45}
          decimals={1}
          suffix="°"
        />
      </View>

      <View>
        <FieldLabel>Method</FieldLabel>
        <SegmentedToggle
          options={METHOD_OPTIONS}
          value={draft.tempMethod}
          onChange={(tempMethod) => patch({ tempMethod })}
        />
      </View>
    </>
  );
}
