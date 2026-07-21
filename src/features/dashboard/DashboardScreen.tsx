import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText } from '../../components';
import { SettingsButton } from './SettingsButton';
import { colors, fontSize, radii, spacing } from '../../theme';
import { greeting, longDate } from '../../lib/dates';
import type { Child, Entry, EntryType } from '../../api/types';
import { isTimerType, type TimerType } from '../../lib/timers';
import type { MedStatus } from '../../lib/medication';
import type { MainStackParamList } from '../../navigation/types';
import { useDashboardData } from '../../data/queries';
import { useAuthStore, useSettingsStore, useUiStore } from '../../stores';
import { useMinuteTick, useTimerTick } from '../../hooks/useTick';
import { useTimerActions } from '../../hooks/useTimers';
import { entryTitle } from '../../lib/entryDisplay';
import { ChildNav } from './ChildNav';
import { TimerStrip } from './TimerStrip';
import { ActivityFeed } from './ActivityFeed';
import { entriesForChild } from './selectors';
import { errorMessage } from '../../api/client';

type Props = NativeStackScreenProps<MainStackParamList, 'Dashboard'>;

export function DashboardScreen({ navigation }: Props) {
  const { children, entries, isLoading, isRefreshing, error, refetch } = useDashboardData();
  const [activeIndex, setActiveIndex] = useState(0);
  const foodWindowHours = useSettingsStore((s) => s.foodWindowHours);
  const userName = useAuthStore((s) => s.session?.userName);
  const welcomeDismissed = useUiStore((s) => s.welcomeDismissed);
  const dismissWelcome = useUiStore((s) => s.dismissWelcome);

  const now = useMinuteTick();
  const timerNow = useTimerTick();
  const { start: startTimer } = useTimerActions();

  const childrenById = useMemo<Record<string, Child>>(
    () => Object.fromEntries(children.map((c) => [c.id, c])),
    [children],
  );

  const activeChild = children[activeIndex] ?? children[0];
  const feedEntries = activeChild ? entriesForChild(entries, activeChild.id) : [];

  /**
   * The greeting is a welcome, not a fixture: once the user does anything on
   * the dashboard they're here to work, so it gets out of the way for the rest
   * of the session. Every interactive path on this screen runs through one of
   * the handlers below, so they're where the dismissal hangs — a global touch
   * hook would be less code and less certain.
   */
  const dismiss = () => {
    if (!welcomeDismissed) dismissWelcome();
  };

  const openCreate = (childId: string, type: EntryType) => {
    dismiss();
    // Quick-logging a timed activity (Food/Sleep/Tummy) starts its timer right
    // away — tapping "Food" means a feed is starting now, matching the
    // prototype. The button is disabled once a timer runs, so this can't
    // double-start, and `startTimer` replaces any existing (type, child) timer.
    if (isTimerType(type)) startTimer(type, childId);
    navigation.navigate('LogEntry', { mode: 'create', childId, type });
  };

  /** Repeat dose from a med row — the form opens prefilled from that entry. */
  const openDose = (childId: string, status: MedStatus) => {
    dismiss();
    navigation.navigate('LogEntry', {
      mode: 'create',
      childId,
      type: 'medication',
      prefillMedEntryId: status.entryId,
    });
  };

  const openTimer = (childId: string, type: TimerType) => {
    dismiss();
    const idx = children.findIndex((c) => c.id === childId);
    if (idx >= 0) setActiveIndex(idx);
    navigation.navigate('LogEntry', { mode: 'create', childId, type });
  };

  const openEdit = (entry: Entry) => {
    dismiss();
    navigation.navigate('LogEntry', {
      mode: 'edit',
      childId: entry.childId,
      type: entry.type,
      entryId: entry.id,
    });
  };

  const confirmDelete = (entry: Entry) => {
    dismiss();
    navigation.navigate('DeleteConfirm', {
      entryId: entry.id,
      entryLabel: entryTitle(entry),
    });
  };

  const openMedBreakdown = (child: Child) => {
    dismiss();
    navigation.navigate('MedBreakdown', { childId: child.id, childName: child.name });
  };

  const changeChild = (index: number) => {
    dismiss();
    setActiveIndex(index);
  };

  const openSettings = () => {
    dismiss();
    navigation.navigate('Settings');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        // Scrolling counts as interaction, same as tapping anything below.
        onScrollBeginDrag={dismiss}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing && !isLoading}
            onRefresh={refetch}
            tintColor={colors.accent}
          />
        }
      >
        {welcomeDismissed ? null : (
          <View>
            <AppText size={fontSize.screenTitle} weight="800">
              {userName ? `${greeting(now)}, ${userName}` : greeting(now)}
            </AppText>
            <AppText size={fontSize.bodySm} weight="600" color={colors.textMuted}>
              {longDate(now)}
            </AppText>
          </View>
        )}

        {error ? (
          <View style={styles.banner}>
            <AppText size={fontSize.bodySm} weight="700" color={colors.danger}>
              {errorMessage(error)}
            </AppText>
            <Pressable accessibilityRole="button" onPress={refetch} style={styles.retry}>
              <AppText size={fontSize.metaSm} weight="800" color={colors.onAccent}>
                Retry
              </AppText>
            </Pressable>
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : null}

        <TimerStrip childrenById={childrenById} now={timerNow} onPress={openTimer} />

        {activeChild ? (
          <ChildNav
            childList={children}
            entries={entries}
            activeIndex={activeIndex}
            onActiveChange={changeChild}
            foodWindowHours={foodWindowHours}
            now={now}
            timerNow={timerNow}
            onQuickAction={openCreate}
            onOpenMedBreakdown={openMedBreakdown}
            onLogDose={openDose}
            onOpenSettings={openSettings}
          />
        ) : (
          // No children yet, so there's no name row to attach the cog to —
          // keep it reachable on its own right-aligned row.
          <View style={styles.settingsFallback}>
            <SettingsButton onPress={openSettings} />
          </View>
        )}

        <ActivityFeed
          entries={feedEntries}
          now={now}
          onEditEntry={openEdit}
          onDeleteEntry={confirmDelete}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing['2xl'],
    gap: spacing['5xl'],
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radii.control,
    padding: spacing['2xl'],
  },
  retry: {
    backgroundColor: colors.accent,
    borderRadius: radii.chipSmall,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing['2xl'],
  },
  loading: {
    paddingVertical: spacing['7xl'],
  },
  settingsFallback: {
    alignItems: 'flex-end',
  },
});
