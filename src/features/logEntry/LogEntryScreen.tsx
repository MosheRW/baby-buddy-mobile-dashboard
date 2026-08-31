import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import {
  ActionButton,
  AppText,
  ChipRow,
  FieldLabel,
  Stepper,
  TextField,
  TagRow,
} from '../../components';
import { CloseGlyph } from '../../components/glyphs';
import { ActionGlyph, ENTRY_TYPE_CHIP_GLYPH } from '../../components/glyphs/entryGlyphs';
import { fontSize, radii, spacing, useTheme, useThemedStyles, type AppTheme } from '../../theme';
import type { EntryType, MedicationEntry } from '../../api/types';
import type { MainStackParamList } from '../../navigation/types';
import { entryTypeLabel, entryTitle } from '../../lib/entryDisplay';
import {
  amountUnit,
  draftSaveError,
  draftToEntry,
  entryToDraft,
  medSuggestionPatch,
  seedDraft,
  type FormDraft,
} from '../../lib/formDraft';
import { isTimerType, type TimerType } from '../../lib/timers';
import { recentTagSuggestions } from '../../lib/tags';
import { canModifyEntry } from '../../lib/entryOwnership';
import { displayUserName } from '../../lib/userName';
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

const TYPE_VALUES: EntryType[] = [
  'diaper',
  'feeding',
  'medication',
  'temperature',
  'tummyTime',
  'sleep',
  'note',
];

type Props = NativeStackScreenProps<MainStackParamList, 'LogEntry'>;

/**
 * The single create/edit form for all seven entry types. The shell (type chips,
 * time, note, tags, footer) is constant; the middle section swaps in the
 * per-type field group. All state lives in formStore so the screen itself is
 * just wiring — the field-visibility rules are pure functions in lib/formDraft.
 */
export function LogEntryScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { colors, tints } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const {
    mode,
    type: initialType,
    entryId,
    childId,
    prefillMedEntryId,
    confirm,
    focus,
  } = route.params;
  const isEdit = mode === 'edit';

  const typeOptions = TYPE_VALUES.map((value) => ({
    value,
    label: entryTypeLabel(value),
    glyph: (color: string) => (
      <ActionGlyph kind={ENTRY_TYPE_CHIP_GLYPH[value]} size={15} color={color} />
    ),
  }));

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
  const isStaff = useAuthStore((s) => s.session?.isStaff);

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

  // A modal the form can be opened *with*, by a notification action button
  // (issue #45): "cancel <timer>" needs confirmation before throwing a running
  // timer away, "end feeding" asks for the amount on the way to saving.
  //
  // Derived from the route params rather than mirrored into state by an effect —
  // an effect can't be a lazy `useState` initializer here anyway, since navigating
  // to an already-mounted LogEntry updates params in place without remounting.
  // What *is* stateful is the dismissal, and it's keyed on the params object's
  // identity (React Navigation hands out a fresh one per navigate) so arriving
  // here again with the same request re-opens the modal instead of staying shut.
  const requestedModal =
    confirm === 'cancelTimer' ? 'cancelTimer' : focus === 'amount' ? 'amount' : null;
  const [dismissedFor, setDismissedFor] = useState<object | null>(null);
  const modal = dismissedFor === route.params ? null : requestedModal;
  const closeModal = () => setDismissedFor(route.params);

  // Discard, not save: the timer (and its server-side counterpart) goes away and
  // no entry is written. `stopTimer` already deletes the server timer.
  const discardTimer = () => {
    closeModal();
    if (timerType) stopTimer(timerType, childId);
    navigation.goBack();
  };

  const endActivityLabel = timerType ? t(`logEntry.activity.${timerType}`) : '';

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
    // Details the caregiver stashed with "Save details" while the timer ran —
    // reapply them so reopening to stop-and-save doesn't start from scratch.
    const savedTimerDraft =
      !isEdit && isTimerType(seedType)
        ? useTimerStore.getState().getDraft(seedType, childId)
        : undefined;
    // serverNow, not Date.now: the server rejects times in its own future, so a
    // phone running slightly fast can't log a "now" entry.
    const seedNow = runningStart ?? serverNow();

    // A new entry inherits the shape of this child's most recent entry of the
    // same type (last feed's amount, last diaper's contents, …) — re-logging
    // almost always repeats those choices.
    const seedEntries = entries.filter((e) => e.childId === childId);

    openForm({
      mode,
      type: seedType,
      childId,
      editingEntryId: entryId ?? null,
      draft: editingEntry
        ? entryToDraft(editingEntry, defaultFoodMl)
        : {
            ...seedDraft(seedType, seedEntries, seedNow, defaultFoodMl),
            ...(savedTimerDraft ?? {}),
            ...(prefillMed ? medSuggestionPatch(prefillMed) : {}),
            // A restored draft carries the start/end from when it was stashed;
            // the live timer owns the Time field and the end defaults to now.
            ...(savedTimerDraft ? { time: new Date(seedNow).toISOString(), endTime: null } : {}),
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
    entries,
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
  const saveTimerDraft = useTimerStore((s) => s.saveDraft);

  // "Save details" while a timer runs: stash the draft on the timer (not the
  // ephemeral formStore) and close, leaving the timer running. No entry is
  // created — that happens only on stop-and-save. Reopening the form later
  // rehydrates these details, so the caregiver never re-enters them.
  const saveDetails = () => {
    if (!timerType) return;
    saveTimerDraft(timerType, childId, draft);
    navigation.goBack();
  };

  const save = () => {
    // Guard against an invalid draft reaching the server (the buttons are also
    // disabled, so this is defense-in-depth).
    if (draftSaveError(draft, type)) return;
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
        // (stopTimer no-ops for a non-timer type or when nothing is running.)
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
  const childEntries = entriesForChild(entries, childId);

  // Defense-in-depth for the "edit only your own entries" rule (the feed
  // already hides edit/delete on others' rows, so this normally isn't reached).
  // Editing an existing entry is blocked unless it's yours or you're staff;
  // creating a new one is always allowed.
  const canEditEntry = !editingEntry || canModifyEntry(editingEntry, { userName, isStaff });

  // Type-specific "can't save yet" reason (e.g. a diaper with neither pee nor
  // poo). Shown inline and used to disable the save buttons.
  const validationError = draftSaveError(draft, type);

  // Suggestions look across all children — a caregiver's tag vocabulary is
  // theirs — but never re-offer a tag already on this draft.
  const tagSuggestions = recentTagSuggestions(entries, type, { exclude: draft.tags });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View>
          <AppText size={fontSize.cardTitle} weight="800">
            {isEdit ? t('logEntry.editTitle') : t('logEntry.newTitle')}
          </AppText>
          {child ? (
            <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
              {child.name}
            </AppText>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('logEntry.close')}
          onPress={() => navigation.goBack()}
          style={styles.close}
        >
          <CloseGlyph size={18} color={colors.textPrimary} />
        </Pressable>
      </View>

      {readyKey !== formKey ? null : (
        <>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <ChipRow layout="wrap" value={type} onChange={setType} options={typeOptions} />

            {timerType && timerRunning ? (
              <RunningTimerStrip
                type={timerType}
                childId={childId}
                asOf={Date.parse(endTimeIso)}
                onStop={stopTimerAndFill}
              />
            ) : null}

            <DateTimeField
              label={t('logEntry.time')}
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
                label={type === 'sleep' ? t('sleep.wokeUpAt') : t('logEntry.endTime')}
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
              <FieldLabel>{t('logEntry.note')}</FieldLabel>
              <TextField
                multilineFixed
                placeholder={t('logEntry.notePlaceholder')}
                value={draft.note}
                onChangeText={(note) => patch({ note })}
              />
            </View>

            <View>
              <FieldLabel>{t('logEntry.tags')}</FieldLabel>
              {tagSuggestions.length > 0 ? (
                <View style={styles.tagSuggestions}>
                  {tagSuggestions.map((label) => (
                    <Pressable
                      key={label}
                      accessibilityRole="button"
                      accessibilityLabel={t('dashboard.addTag', { tag: label })}
                      onPress={() => patch({ tags: [...draft.tags, label] })}
                      style={styles.tagSuggestion}
                    >
                      <AppText size={fontSize.metaSm} weight="700" color={tints.suggestion.fg}>
                        {t('logEntry.addTagOffer', { tag: label })}
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
            {validationError && canEditEntry ? (
              <AppText
                size={fontSize.metaSm}
                weight="700"
                color={colors.danger}
                style={styles.saveError}
              >
                {validationError}
              </AppText>
            ) : null}
            {!canEditEntry ? (
              <AppText
                size={fontSize.metaSm}
                weight="700"
                color={colors.textMuted}
                style={styles.saveError}
              >
                {editingEntry?.creator
                  ? t('logEntry.readOnlyOthersBy', {
                      name: displayUserName(editingEntry.creator),
                    })
                  : t('logEntry.readOnlyOthers')}
              </AppText>
            ) : null}
            <View style={styles.footer}>
              {isEdit && canEditEntry ? (
                <ActionButton
                  label={t('common.delete')}
                  variant="danger"
                  flex={1}
                  onPress={remove}
                />
              ) : null}
              {timerRunning ? (
                <>
                  {/* "Save and end" stops the timer and writes the entry,
                      reusing whatever was stashed; "Save details" stashes the
                      draft and leaves the timer running — no entry yet. */}
                  <ActionButton
                    label={
                      saveEntry.isPending
                        ? t('common.saving')
                        : t('logEntry.saveAndEnd', { activity: endActivityLabel })
                    }
                    variant="accent"
                    flex={1}
                    disabled={saveEntry.isPending || !!validationError}
                    onPress={() => save()}
                  />
                  <ActionButton
                    label={t('logEntry.saveDetails')}
                    variant="neutral"
                    flex={1}
                    disabled={saveEntry.isPending}
                    onPress={saveDetails}
                  />
                </>
              ) : (
                <ActionButton
                  label={saveEntry.isPending ? t('common.saving') : t('common.save')}
                  variant="accent"
                  flex={2}
                  disabled={saveEntry.isPending || !canEditEntry || !!validationError}
                  onPress={() => save()}
                />
              )}
            </View>
          </View>
        </>
      )}

      {/* Only meaningful while the thing they act on exists: a timer that was
          already stopped elsewhere has nothing to cancel, and the amount prompt
          belongs to the feeding form. */}
      {modal === 'cancelTimer' && timerRunning ? (
        <FormModal onRequestClose={closeModal}>
          <AppText size={fontSize.cardTitle} weight="800">
            {t('logEntry.cancelTimerTitle', { activity: endActivityLabel })}
          </AppText>
          <AppText size={fontSize.bodySm} weight="600" color={colors.textMuted}>
            {t('logEntry.cancelTimerBody')}
          </AppText>
          <View style={styles.modalActions}>
            <ActionButton
              label={t('logEntry.cancelTimerKeep')}
              variant="neutral"
              flex={1}
              onPress={closeModal}
            />
            <ActionButton
              label={t('logEntry.cancelTimerConfirm')}
              variant="danger"
              flex={1}
              onPress={discardTimer}
            />
          </View>
        </FormModal>
      ) : null}

      {modal === 'amount' && type === 'feeding' ? (
        <FormModal onRequestClose={closeModal}>
          <AppText size={fontSize.cardTitle} weight="800">
            {t('logEntry.quantityTitle', { child: child?.name ?? '' })}
          </AppText>
          <Stepper
            value={draft.amount}
            onChange={(amount) => patch({ amount })}
            step={10}
            min={0}
            suffix={amountUnit(draft.kind)}
          />
          {saveEntry.isError ? (
            <AppText size={fontSize.metaSm} weight="700" color={colors.danger}>
              {errorMessage(saveEntry.error)}
            </AppText>
          ) : null}
          <View style={styles.modalActions}>
            {/* The whole point of the "end feeding" notification action: set the
                amount, then stop the timer and write the entry. `save` folds the
                measured span in and clears the timer on success, so this button
                does the full stop-and-save rather than merely closing. */}
            <ActionButton
              label={
                saveEntry.isPending
                  ? t('common.saving')
                  : t('logEntry.saveAndEnd', { activity: endActivityLabel })
              }
              variant="accent"
              flex={1}
              disabled={saveEntry.isPending}
              onPress={() => save()}
            />
          </View>
        </FormModal>
      ) : null}
    </SafeAreaView>
  );
}

/**
 * A small centered dialog over the form. Deliberately a plain RN `Modal` rather
 * than another stack route: these belong to the form's own state, and the form is
 * already the screen the notification navigated to.
 */
function FormModal({
  children,
  onRequestClose,
}: {
  children: React.ReactNode;
  onRequestClose: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onRequestClose}>
      <Pressable style={styles.modalBackdrop} onPress={onRequestClose}>
        {/* Swallow taps on the card itself so they don't dismiss it. */}
        <Pressable style={styles.modalCard} onPress={() => {}}>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = ({ colors, tints }: AppTheme) =>
  StyleSheet.create({
    modalBackdrop: {
      flex: 1,
      backgroundColor: colors.scrim,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing['6xl'],
    },
    modalCard: {
      width: '100%',
      gap: spacing.lg,
      backgroundColor: colors.card,
      borderRadius: radii.card,
      padding: spacing['6xl'],
    },
    modalActions: {
      flexDirection: 'row',
      gap: spacing.md,
    },
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
