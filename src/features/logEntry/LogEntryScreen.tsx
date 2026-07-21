import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActionButton, AppText, ChipRow, FieldLabel, TextField, TagRow } from '../../components';
import { CloseGlyph } from '../../components/glyphs';
import { ActionGlyph, ENTRY_TYPE_CHIP_GLYPH } from '../../components/glyphs/entryGlyphs';
import { colors, fontSize, radii, spacing, tints } from '../../theme';
import type { EntryType, MedicationEntry } from '../../api/types';
import type { MainStackParamList } from '../../navigation/types';
import { entryTypeLabel, entryTitle } from '../../lib/entryDisplay';
import {
  draftToEntry,
  emptyDraft,
  entryToDraft,
  medSuggestionPatch,
  type FormDraft,
} from '../../lib/formDraft';
import { isTimerType, type TimerType } from '../../lib/timers';
import { recentTagSuggestions } from '../../lib/tags';
import { errorMessage, serverNow } from '../../api/client';
import { useDashboardData, useSaveEntry } from '../../data/queries';
import { useAuthStore, useFormStore, useSettingsStore, useTimerStore } from '../../stores';
import { useTimerTick } from '../../hooks/useTick';
import { useTimerActions } from '../../hooks/useTimers';
import { entriesForChild } from '../dashboard/selectors';
import { DateTimeField } from './DateTimeField';
import { RunningTimerStrip } from './TimerControl';
import { DiaperFields } from './fields/DiaperFields';
import { FeedingFields } from './fields/FeedingFields';
import { MedicationFields } from './fields/MedicationFields';
import { TemperatureFields } from './fields/TemperatureFields';
import { TummyTimeFields } from './fields/TummyTimeFields';
import { SleepFields } from './fields/SleepFields';

const TYPE_OPTIONS = (
  ['diaper', 'feeding', 'medication', 'temperature', 'tummyTime', 'sleep', 'note'] as EntryType[]
).map((t) => ({
  value: t,
  label: entryTypeLabel[t],
  glyph: (color: string) => <ActionGlyph kind={ENTRY_TYPE_CHIP_GLYPH[t]} size={15} color={color} />,
}));

type Props = NativeStackScreenProps<MainStackParamList, 'LogEntry'>;

/**
 * The single create/edit form for all seven entry types. The shell (type chips,
 * time, note, tags, footer) is constant; the middle section swaps in the
 * per-type field group. All state lives in formStore so the screen itself is
 * just wiring — the field-visibility rules are pure functions in lib/formDraft.
 */
export function LogEntryScreen({ route, navigation }: Props) {
  const { mode, type: initialType, entryId, childId, prefillMedEntryId } = route.params;
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

  const { stop: stopTimer, updateStart: updateTimerStart } = useTimerActions();
  const timerNow = useTimerTick();

  const userName = useAuthStore((s) => s.session?.userName) ?? 'you';

  // Timer UI only appears while creating a timed entry. `timerType` is the
  // narrowed type or null, so the strip, end-time field and split-save below can
  // be gated without re-checking `isTimerType` each time.
  const timerType: TimerType | null = mode === 'create' && isTimerType(type) ? type : null;
  const runningTimer = useTimerStore((s) =>
    timerType ? s.timers.find((t) => t.type === timerType && t.childId === childId) : undefined,
  );
  const timerRunning = !!runningTimer;

  // Stopping a timer, or saving while one runs, stamps the measured span onto
  // the draft: start = when the timer began, end = the end-time field (default
  // now), and the type's own duration/wake field derived from the two.
  const endTimeIso = draft.endTime ?? new Date(timerNow).toISOString();
  const spanPatch = (): Partial<FormDraft> => {
    if (!runningTimer) return {};
    const startedAt = runningTimer.startedAt;
    const endedAt = new Date(endTimeIso).getTime();
    const minutes = Math.max(1, Math.round((endedAt - startedAt) / 60_000));
    const base: Partial<FormDraft> = {
      time: new Date(startedAt).toISOString(),
      endTime: new Date(endedAt).toISOString(),
    };
    if (type === 'feeding') return { ...base, durationMinutes: minutes };
    if (type === 'tummyTime') return { ...base, tummyMinutes: minutes };
    if (type === 'sleep') return { ...base, stillSleeping: false };
    return base;
  };

  const stopTimerAndFill = () => {
    if (!timerType) return;
    patch(spanPatch());
    stopTimer(timerType, childId);
  };

  const endActivityLabel = timerType === 'tummyTime' ? 'tummy time' : (timerType ?? '');

  // A repeat dose started from a dashboard med row: same medicine, same dose,
  // schedule and interval, but a fresh entry at the current time.
  const prefillMed = prefillMedEntryId
    ? entries.find(
        (e): e is MedicationEntry => e.id === prefillMedEntryId && e.type === 'medication',
      )
    : undefined;

  // Seed the store once per opened entry. In edit mode this waits for the
  // entry to load, so `readyKey` gates rendering on a hydrated draft.
  const formKey = `${mode}:${childId}:${entryId ?? ''}:${prefillMedEntryId ?? ''}`;
  const [readyKey, setReadyKey] = useState<string | null>(null);

  useEffect(() => {
    if (readyKey === formKey) return;
    if (isEdit && !editingEntry) return; // entries still loading
    if (prefillMedEntryId && !prefillMed) return; // ditto for the source dose

    const seedType = editingEntry?.type ?? initialType ?? 'diaper';
    // Reopening a create form for a type/child that already has a running
    // timer (e.g. after backgrounding the app) must seed from the timer's
    // real start, not the moment the form happens to reopen — otherwise the
    // Time field silently shows "now" while the timer strip shows the true
    // elapsed span, and the two only reconcile again at save time.
    const runningStart =
      !isEdit && isTimerType(seedType)
        ? useTimerStore.getState().getTimer(seedType, childId)?.startedAt
        : undefined;

    openForm({
      mode,
      type: seedType,
      childId,
      editingEntryId: entryId ?? null,
      draft: editingEntry
        ? entryToDraft(editingEntry, defaultFoodMl)
        : {
            // serverNow, not Date.now: the server rejects times in its own
            // future, so a phone running slightly fast can't log a "now" entry.
            ...emptyDraft(runningStart ?? serverNow(), defaultFoodMl),
            ...(prefillMed ? medSuggestionPatch(prefillMed) : {}),
          },
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
    prefillMedEntryId,
    prefillMed,
  ]);

  const saveEntry = useSaveEntry();

  const save = ({ keepTimer = false }: { keepTimer?: boolean } = {}) => {
    // While a timer runs its duration isn't in the draft yet, so fold the
    // measured span in here rather than relying on a not-yet-committed patch.
    const spanVals = timerRunning ? spanPatch() : {};
    const entry = draftToEntry({
      draft: { ...draft, ...spanVals },
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
        // "Save" (keepTimer) leaves it running to log another span later.
        if (isTimerType(type) && !keepTimer) stopTimer(type, childId);
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
  const childEntries = entriesForChild(entries, childId);

  // Suggestions look across all children — a caregiver's tag vocabulary is
  // theirs — but never re-offer a tag already on this draft.
  const tagSuggestions = recentTagSuggestions(entries, type, { exclude: draft.tags });

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

            {timerType && timerRunning ? (
              <RunningTimerStrip
                type={timerType}
                childId={childId}
                asOf={Date.parse(endTimeIso)}
                onStop={stopTimerAndFill}
              />
            ) : null}

            <DateTimeField
              label="Time"
              value={draft.time}
              onChange={(time) => {
                patch({ time });
                // A running timer's elapsed display and eventual entry both
                // read from the timer's own startedAt, not the draft — keep
                // them in sync or this edit gets silently overwritten on stop.
                if (timerType && runningTimer) {
                  updateTimerStart(timerType, childId, new Date(time).getTime());
                }
              }}
            />

            {timerRunning ? (
              <DateTimeField
                label={type === 'sleep' ? 'Woke up at' : 'End time'}
                value={endTimeIso}
                onChange={(endTime) => patch({ endTime })}
              />
            ) : null}

            {type === 'diaper' ? <DiaperFields draft={draft} patch={patch} /> : null}
            {type === 'feeding' ? (
              <FeedingFields {...fieldProps} entries={childEntries} defaultFoodMl={defaultFoodMl} />
            ) : null}
            {type === 'medication' ? (
              <MedicationFields draft={draft} patch={patch} entries={childEntries} />
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
              {tagSuggestions.length > 0 ? (
                <View style={styles.tagSuggestions}>
                  {tagSuggestions.map((label) => (
                    <Pressable
                      key={label}
                      accessibilityRole="button"
                      accessibilityLabel={`Add tag ${label}`}
                      onPress={() => patch({ tags: [...draft.tags, label] })}
                      style={styles.tagSuggestion}
                    >
                      <AppText size={fontSize.metaSm} weight="700" color={tints.suggestion.fg}>
                        + {label}
                      </AppText>
                    </Pressable>
                  ))}
                </View>
              ) : null}
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
              {timerRunning ? (
                <>
                  {/* Save keeps the timer running to log another span; "Save and
                      end" stops it and closes out the activity. */}
                  <ActionButton
                    label="Save"
                    variant="neutral"
                    flex={1}
                    disabled={saveEntry.isPending}
                    onPress={() => save({ keepTimer: true })}
                  />
                  <ActionButton
                    label={saveEntry.isPending ? 'Saving…' : `Save and end ${endActivityLabel}`}
                    variant="accent"
                    flex={1}
                    disabled={saveEntry.isPending}
                    onPress={() => save()}
                  />
                </>
              ) : (
                <ActionButton
                  label={saveEntry.isPending ? 'Saving…' : 'Save'}
                  variant="accent"
                  flex={2}
                  disabled={saveEntry.isPending}
                  onPress={() => save()}
                />
              )}
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
  tagSuggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tagSuggestion: {
    // Dashed outline marks these as offers rather than applied tags.
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tints.suggestion.border,
    backgroundColor: tints.suggestion.bg,
    borderRadius: radii.chipSmall,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
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
