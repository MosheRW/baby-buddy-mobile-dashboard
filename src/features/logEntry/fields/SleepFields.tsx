import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, FieldLabel, SegmentedToggle, ToggleSwitch } from '../../../components';
import type { SegmentOption } from '../../../components';
import { NapGlyph, NightGlyph } from '../../../components/glyphs/entryGlyphs';
import { fontSize, radii, spacing, useThemedStyles, type AppTheme } from '../../../theme';
import type { SleepType } from '../../../api/types';
import type { FormDraft } from '../../../lib/formDraft';
import { useTimerStore } from '../../../stores';
import { DateTimeField } from '../DateTimeField';
import { StartTimerButton } from '../TimerControl';

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
 *
 * The nap/night type shows in both modes — it decides the feed's icon, and the
 * clock-based guess in `defaultSleepType` is only a guess.
 */
export function SleepFields({ draft, patch, childId, mode, now }: SleepFieldsProps) {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const timerRunning = useTimerStore((s) =>
    s.timers.some((timer) => timer.type === 'sleep' && timer.childId === childId),
  );

  const typeOptions: SegmentOption<SleepType>[] = [
    { value: 'nap', label: t('sleep.nap'), glyph: (c) => <NapGlyph size={17} color={c} /> },
    { value: 'night', label: t('sleep.night'), glyph: (c) => <NightGlyph size={16} color={c} /> },
  ];

  const typeField = (
    <View>
      <FieldLabel>{t('sleep.typeLabel')}</FieldLabel>
      <SegmentedToggle
        options={typeOptions}
        value={draft.sleepType}
        onChange={(sleepType) => patch({ sleepType })}
      />
    </View>
  );

  if (mode === 'create') {
    // Timer-driven: the running strip and "Woke up at" field live in the shell;
    // here we only offer to start the timer when one isn't already running.
    return (
      <>
        {typeField}
        {!timerRunning ? <StartTimerButton type="sleep" childId={childId} /> : null}
      </>
    );
  }

  return (
    <>
      {typeField}

      <View style={styles.switchRow}>
        <AppText size={fontSize.body} weight="700">
          {t('sleep.stillSleeping')}
        </AppText>
        <ToggleSwitch
          value={draft.stillSleeping}
          onValueChange={(stillSleeping) =>
            patch({
              stillSleeping,
              // Seed a sensible wake time the moment the sleep is ended.
              endTime: stillSleeping
                ? draft.endTime
                : (draft.endTime ?? new Date(now).toISOString()),
            })
          }
        />
      </View>

      {!draft.stillSleeping ? (
        <DateTimeField
          label={t('sleep.wokeUpAt')}
          value={draft.endTime ?? new Date(now).toISOString()}
          onChange={(endTime) => patch({ endTime })}
        />
      ) : (
        <FieldLabel>{t('sleep.turnOffHint')}</FieldLabel>
      )}
    </>
  );
}

const makeStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
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
