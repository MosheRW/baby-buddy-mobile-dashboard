import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
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

export function TemperatureFields({ draft, patch }: FieldProps) {
  const { t } = useTranslation();

  const methodOptions: SegmentOption<TemperatureMethod>[] = [
    {
      value: 'oral',
      label: temperatureMethodLabel('oral'),
      glyph: (c) => <TemperatureGlyph size={14} color={c} />,
    },
    {
      value: 'ear',
      label: temperatureMethodLabel('ear'),
      glyph: (c) => <TempEarGlyph size={15} color={c} />,
    },
    {
      value: 'forehead',
      label: temperatureMethodLabel('forehead'),
      glyph: (c) => <TempForeheadGlyph size={16} color={c} />,
    },
  ];

  return (
    <>
      <View>
        <FieldLabel>{t('temperature.valueLabel')}</FieldLabel>
        <Stepper
          value={draft.temperature}
          onChange={(temperature) => patch({ temperature })}
          step={0.1}
          min={30}
          max={45}
          decimals={1}
          suffix={t('temperature.valueSuffix')}
          trimZeros
        />
      </View>

      <View>
        <FieldLabel>{t('temperature.methodLabel')}</FieldLabel>
        <SegmentedToggle
          options={methodOptions}
          value={draft.tempMethod}
          onChange={(tempMethod) => patch({ tempMethod })}
        />
      </View>
    </>
  );
}
