import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActionButton, AppText, ChipRow, FieldLabel, TextField, TagRow } from '../../components';
import { CloseGlyph } from '../../components/glyphs';
import { colors, fontSize, radii, spacing } from '../../theme';
import type { EntryType } from '../../api/types';
import type { MainStackParamList } from '../../navigation/types';
import { entryTypeLabel, entryTitle } from '../../lib/entryDisplay';
import { draftToEntry, emptyDraft, entryToDraft } from '../../lib/formDraft';
import { isTimerType } from '../../lib/timers';
import { errorMessage, serverNow } from '../../api/client';
import { useDashboardData, useSaveEntry } from '../../data/queries';
import { useAuthStore, useFormStore, useSettingsStore, useTimerStore } from '../../stores';
import { useTimerTick } from '../../hooks/useTick';
import { entriesForChild } from '../dashboard/selectors';
import { DateTimeField } from './DateTimeField';
import { DiaperFields } from './fields/DiaperFields';
import { FeedingFields } from './fields/FeedingFields';
import { MedicationFields } from './fields/MedicationFields';
import { TemperatureFields } from './fields/TemperatureFields';
import { TummyTimeFields } from './fields/TummyTimeFields';
import { SleepFields } from './fields/SleepFields';

const TYPE_OPTIONS: { value: EntryType; label: string }[] = (
  ['diaper', 'feeding', 'medication', 'temperature', 'tummyTime', 'sleep', 'note'] as EntryType[]
).map((t) => ({ value: t, label: entryTypeLabel[t] }));

type Props = NativeStackScreenProps<MainStackParamList, 'LogEntry'>;

/**
 * The single create/edit form for all seven entry types. The shell (type chips,
 * time, note, tags, footer) is constant; the middle section swaps in the
 * per-type field group. All state lives in formStore so the screen itself is
 * just wiring — the field-visibility rules are pure functions in lib/formDraft.
 */
export function LogEntryScreen({ route, navigation }: Props) {
  const { mode, type: initialType, entryId, childId } = route.params;
  const isEdit = mode === 'edit';

  const { children, entries } = useDashboardData();
  const child = children.find((c) => c.id === childId);
  const editingEntry = entryId ? entries.find((e) => e.id === entryId) : undefined;

  const perChildMl = useSettingsStore((s) => s.defaultFoodMl[childId]);
  const defaultFoodMl = perChildMl ?? child?.defaultFoodMl ?? 120;

  const type = useFormStore((s) => s.type);
  const draft = useFormStore((s) => s.draft);
  const openForm = useFormStore((s) => s.openForm);
  const setType = useFormStore((s) => s.setType);
  const patch = useFormStore((s) => s.patchDraft);

  const stopTimer = useTimerStore((s) => s.stopTimer);
  const timerNow = useTimerTick();

  const userName = useAuthStore((s) => s.session?.userName) ?? 'you';

  // Seed the store once per opened entry. In edit mode this waits for the
  // entry to load, so `readyKey` gates rendering on a hydrated draft.
  const formKey = `${mode}:${childId}:${entryId ?? ''}`;
  const [readyKey, setReadyKey] = useState<string | null>(null);

  useEffect(() => {
    if (readyKey === formKey) return;
    if (isEdit && !editingEntry) return; // entries still loading
    openForm({
      mode,
      type: editingEntry?.type ?? initialType ?? 'diaper',
      childId,
      editingEntryId: entryId ?? null,
      draft: editingEntry
        ? entryToDraft(editingEntry, defaultFoodMl)
        : // serverNow, not Date.now: the server rejects times in its own future,
          // so a phone running slightly fast can't log a "now" entry.
          emptyDraft(serverNow(), defaultFoodMl),
    });
    // One-time seeding, guarded by the key above — it can't cascade because
    // the next run returns early.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReadyKey(formKey);
  }, [
    formKey,
    readyKey,
    isEdit,
    editingEntry,
    openForm,
    mode,
    initialType,
    childId,
    entryId,
    defaultFoodMl,
  ]);

  const saveEntry = useSaveEntry();

  const save = () => {
    const entry = draftToEntry({
      draft,
      type,
      childId,
      // Empty id = create; the server assigns the real one.
      id: editingEntry?.id ?? '',
      creator: editingEntry?.creator ?? userName,
    });

    saveEntry.mutate(entry, {
      onSuccess: () => {
        // A timer that produced this entry has done its job — clear it only
        // once the entry is safely saved, so a failed save doesn't lose it.
        if (isTimerType(type)) stopTimer(type, childId);
        navigation.goBack();
      },
    });
  };

  const remove = () => {
    if (!editingEntry) return;
    navigation.navigate('DeleteConfirm', {
      entryId: editingEntry.id,
      entryLabel: entryTitle(editingEntry),
    });
  };

  const fieldProps = { draft, patch, childId, mode, now: timerNow };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View>
          <AppText size={fontSize.cardTitle} weight="800">
            {isEdit ? 'Edit entry' : 'New entry'}
          </AppText>
          {child ? (
            <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
              {child.name}
            </AppText>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => navigation.goBack()}
          style={styles.close}
        >
          <CloseGlyph size={18} />
        </Pressable>
      </View>

      {readyKey !== formKey ? null : (
        <>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <ChipRow layout="wrap" value={type} onChange={setType} options={TYPE_OPTIONS} />

            <DateTimeField label="Time" value={draft.time} onChange={(time) => patch({ time })} />

            {type === 'diaper' ? <DiaperFields draft={draft} patch={patch} /> : null}
            {type === 'feeding' ? <FeedingFields {...fieldProps} /> : null}
            {type === 'medication' ? (
              <MedicationFields
                draft={draft}
                patch={patch}
                entries={entriesForChild(entries, childId)}
              />
            ) : null}
            {type === 'temperature' ? <TemperatureFields draft={draft} patch={patch} /> : null}
            {type === 'tummyTime' ? <TummyTimeFields {...fieldProps} /> : null}
            {type === 'sleep' ? <SleepFields {...fieldProps} /> : null}

            <View>
              <FieldLabel>Note</FieldLabel>
              <TextField
                multilineFixed
                placeholder="Optional note"
                value={draft.note}
                onChangeText={(note) => patch({ note })}
              />
            </View>

            <View>
              <FieldLabel>Tags</FieldLabel>
              <TagRow
                authorTag={`by ${editingEntry?.creator ?? userName}`}
                tags={draft.tags}
                onAdd={(t) => patch({ tags: [...draft.tags, t] })}
                onRemove={(i) => patch({ tags: draft.tags.filter((_, idx) => idx !== i) })}
              />
            </View>
          </ScrollView>

          <View style={styles.footerWrap}>
            {saveEntry.isError ? (
              <AppText
                size={fontSize.metaSm}
                weight="700"
                color={colors.danger}
                style={styles.saveError}
              >
                {errorMessage(saveEntry.error)}
              </AppText>
            ) : null}
            <View style={styles.footer}>
              {isEdit ? (
                <ActionButton label="Delete" variant="danger" flex={1} onPress={remove} />
              ) : null}
              <ActionButton
                label={saveEntry.isPending ? 'Saving…' : 'Save'}
                variant="accent"
                flex={2}
                disabled={saveEntry.isPending}
                onPress={save}
              />
            </View>
          </View>
        </>
      )}
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
  footerWrap: {
    paddingHorizontal: spacing['2xl'],
  },
  saveError: {
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingVertical: spacing['2xl'],
  },
});
