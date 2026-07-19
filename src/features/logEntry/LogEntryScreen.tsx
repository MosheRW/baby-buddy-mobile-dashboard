import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActionButton,
  AppText,
  ChipRow,
  FieldLabel,
  TextField,
  TagRow,
} from '../../components';
import { CloseGlyph } from '../../components/glyphs';
import { colors, fontSize, radii, spacing } from '../../theme';
import type { EntryType } from '../../api/types';
import type { MainStackParamList } from '../../navigation/types';
import { entryTypeLabel } from '../../lib/entryDisplay';
import { CURRENT_USER } from '../../data/mockData';
import { elapsedClock, isTimerType } from '../../lib/timers';
import { useTimerStore } from '../../stores';
import { useTimerTick } from '../../hooks/useTick';

const TYPE_OPTIONS: { value: EntryType; label: string }[] = (
  [
    'diaper',
    'feeding',
    'medication',
    'temperature',
    'tummyTime',
    'sleep',
    'note',
  ] as EntryType[]
).map((t) => ({ value: t, label: entryTypeLabel[t] }));

type Props = NativeStackScreenProps<MainStackParamList, 'LogEntry'>;

/**
 * Phase 2 form shell: header, entry-type chip row, time, note, and tags with
 * Save/Delete footer. The per-type field groups (diaper toggles, feeding
 * method/timer, medication dose, etc.) are added in Phase 4.
 */
export function LogEntryScreen({ route, navigation }: Props) {
  const { mode, type: initialType, entryId, childId } = route.params;
  const [type, setType] = useState<EntryType>(initialType ?? 'diaper');
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const isEdit = mode === 'edit';

  // Minimal timer control (feeding/sleep/tummy) so timers survive form close and
  // drive the dashboard strip. The full timer UX (end-time pickers, amount from
  // duration) is added in Phase 4.
  const timers = useTimerStore((s) => s.timers);
  const startTimer = useTimerStore((s) => s.startTimer);
  const stopTimer = useTimerStore((s) => s.stopTimer);
  const timerNow = useTimerTick();
  const activeTimer =
    isTimerType(type) && childId
      ? timers.find((t) => t.type === type && t.childId === childId)
      : undefined;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <AppText size={fontSize.cardTitle} weight="800">
          {isEdit ? 'Edit entry' : 'New entry'}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => navigation.goBack()}
          style={styles.close}
        >
          <CloseGlyph size={18} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ChipRow layout="wrap" value={type} onChange={setType} options={TYPE_OPTIONS} />

        <View>
          <FieldLabel>Time</FieldLabel>
          <View style={styles.timeField}>
            <AppText size={fontSize.body} weight="700">
              {new Date().toLocaleString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            </AppText>
          </View>
        </View>

        {/* Minimal timer control for timer-capable types (full UX in Phase 4). */}
        {isTimerType(type) && childId ? (
          <View>
            <FieldLabel>Timer</FieldLabel>
            {activeTimer ? (
              <View style={styles.timerRunning}>
                <AppText size={fontSize.cardTitle} weight="800" color={colors.accent}>
                  {elapsedClock(activeTimer.startedAt, timerNow)}
                </AppText>
                <ActionButton
                  label="Stop timer"
                  variant="danger"
                  onPress={() => stopTimer(type, childId)}
                />
              </View>
            ) : (
              <ActionButton
                label="Start timer"
                variant="neutral"
                fullWidth
                onPress={() => startTimer(type, childId)}
              />
            )}
          </View>
        ) : null}

        {/* Placeholder for remaining per-type fields (Phase 4). */}
        <View style={styles.typeNote}>
          <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
            {entryTypeLabel[type]} fields are added in Phase 4.
          </AppText>
        </View>

        <View>
          <FieldLabel>Note</FieldLabel>
          <TextField
            multilineFixed
            placeholder="Optional note"
            value={note}
            onChangeText={setNote}
          />
        </View>

        <View>
          <FieldLabel>Tags</FieldLabel>
          <TagRow
            authorTag={`by ${CURRENT_USER}`}
            tags={tags}
            onAdd={(t) => setTags((prev) => [...prev, t])}
            onRemove={(i) => setTags((prev) => prev.filter((_, idx) => idx !== i))}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {isEdit ? (
          <ActionButton
            label="Delete"
            variant="danger"
            flex={1}
            onPress={() =>
              navigation.navigate('DeleteConfirm', {
                entryId: entryId ?? '',
                entryLabel: entryTypeLabel[type],
              })
            }
          />
        ) : null}
        <ActionButton label="Save" variant="accent" flex={2} onPress={() => navigation.goBack()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: radii.chipSmall,
    backgroundColor: colors.neutral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing['2xl'],
    gap: spacing['4xl'],
  },
  timeField: {
    backgroundColor: colors.card,
    borderRadius: radii.control,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing['2xl'],
    alignItems: 'flex-end',
  },
  typeNote: {
    backgroundColor: colors.card,
    borderRadius: radii.control,
    padding: spacing['2xl'],
  },
  timerRunning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radii.control,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing['2xl'],
    gap: spacing.lg,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.lg,
    padding: spacing['2xl'],
  },
});
