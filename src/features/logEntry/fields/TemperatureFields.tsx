import React from 'react';
import { View } from 'react-native';
import { FieldLabel, SegmentedToggle, Stepper } from '../../../components';
import type { SegmentOption } from '../../../components';
import {
  TemperatureGlyph,
  TempEarGlyph,
  TempForeheadGlyph,
} from '../../../components/glyphs/entryGlyphs';
import type { TemperatureMethod } from '../../../api/types';
import { temperatureMethodLabel } from '../../../lib/entryDisplay';
import type { FormDraft } from '../../../lib/formDraft';

interface FieldProps {
  draft: FormDraft;
  patch: (patch: Partial<FormDraft>) => void;
}

const METHOD_OPTIONS: SegmentOption<TemperatureMethod>[] = [
  {
    value: 'oral',
    label: temperatureMethodLabel.oral,
    glyph: (c) => <TemperatureGlyph size={14} color={c} />,
  },
  {
    value: 'ear',
    label: temperatureMethodLabel.ear,
    glyph: (c) => <TempEarGlyph size={15} color={c} />,
  },
  {
    value: 'forehead',
    label: temperatureMethodLabel.forehead,
    glyph: (c) => <TempForeheadGlyph size={16} color={c} />,
  },
];

export function TemperatureFields({ draft, patch }: FieldProps) {
  return (
    <>
      <View>
        <FieldLabel>Temperature (°C)</FieldLabel>
        <Stepper
          value={draft.temperature}
          onChange={(temperature) => patch({ temperature })}
          step={0.1}
          min={30}
          max={45}
          decimals={1}
          suffix="°C"
          trimZeros
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
