import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { AppText, Chip } from '../../components';
import { SettingsButton } from './SettingsButton';
import { fontSize, radii, spacing, useTheme, useThemedStyles, type AppTheme } from '../../theme';
import { greeting, longDate } from '../../lib/dates';
import { hasInactiveBaselineDays } from '../../lib/activeDays';
import type { Child, Entry, EntryType } from '../../api/types';
import { isTimerType, type TimerType } from '../../lib/timers';
import type { MedStatus } from '../../lib/medication';
import type { MainStackParamList } from '../../navigation/types';
import { useDashboardData } from '../../data/queries';
import {
  useAppErrorStore,
  useAuthStore,
  useKidsStore,
  useSettingsStore,
  useUiStore,
} from '../../stores';
import { hiddenCount, visibleChildren } from '../../lib/visibility';
import { useMinuteTick, useTimerTick } from '../../hooks/useTick';
import { useTimerActions } from '../../hooks/useTimers';
import { entryTitle } from '../../lib/entryDisplay';
import { displayUserName } from '../../lib/userName';
import { notificationAction } from '../../lib/notifications';
import {
  useDeliveredNotifications,
  type DeliveredNotification,
} from '../../hooks/useDeliveredNotifications';
import { ChildNav } from './ChildNav';
import { TimerStrip } from './TimerStrip';
import { NotificationCarousel, type CarouselItem } from './NotificationCarousel';
import { ActivityFeed } from './ActivityFeed';
import { entriesForChild } from './selectors';
import { errorMessage } from '../../api/client';

type Props = NativeStackScreenProps<MainStackParamList, 'Dashboard'>;

export function DashboardScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { children, entries, isLoading, isRefreshing, error, refetch } = useDashboardData();
  const [activeIndex, setActiveIndex] = useState(0);
  const excludeInactiveDays = useSettingsStore((s) => s.excludeInactiveDays);
  const inactiveDaysPromptSeen = useSettingsStore((s) => s.inactiveDaysPromptSeen);
  const setExcludeInactiveDays = useSettingsStore((s) => s.setExcludeInactiveDays);
  const markInactiveDaysPromptSeen = useSettingsStore((s) => s.markInactiveDaysPromptSeen);
  const userName = useAuthStore((s) => s.session?.userName);
  const isStaff = useAuthStore((s) => s.session?.isStaff);
  // Drives the feed's "edit/delete only your own entries" guard. Memoized so the
  // memoized ActivityFeed sees a stable prop across the 60s tick re-renders.
  const currentUser = useMemo(
    () => (userName ? { userName, isStaff } : undefined),
    [userName, isStaff],
  );
  const welcomeDismissed = useUiStore((s) => s.welcomeDismissed);
  const dismissWelcome = useUiStore((s) => s.dismissWelcome);
  const revealHiddenUntil = useUiStore((s) => s.revealHiddenUntil);
  const revealHidden = useUiStore((s) => s.revealHidden);
  const clearReveal = useUiStore((s) => s.clearReveal);

  // App-wide event errors (failed save/delete) surfaced in the carousel. The
  // dashboard *fetch* error stays reactive in React Query (`error` below) — it
  // clears itself on a successful refetch, so it isn't kept here.
  const appErrors = useAppErrorStore((s) => s.errors);
  const dismissAppError = useAppErrorStore((s) => s.dismissError);
  const clearAppErrors = useAppErrorStore((s) => s.clearErrors);

  // Visibility/appearance state (client-only). Selecting the fields individually
  // keeps each a stable reference, so the memo below only recomputes on a real
  // change.
  const hidden = useKidsStore((s) => s.hidden);
  const childGroupId = useKidsStore((s) => s.childGroupId);
  const childSchedule = useKidsStore((s) => s.childSchedule);
  const groups = useKidsStore((s) => s.groups);
  const revealDurationMinutes = useKidsStore((s) => s.shakeReveal.durationMinutes);

  const now = useMinuteTick();
  const timerNow = useTimerTick();
  const { start: startTimer } = useTimerActions();

  // Reminders the OS has already delivered, surfaced in an in-app carousel above
  // the child card. Empty (so the carousel hides) on web/Expo Go and whenever
  // notifications are off — see the hook.
  const {
    items: deliveredNotifications,
    dismiss: dismissNotification,
    dismissAll: dismissAllNotifications,
  } = useDeliveredNotifications();

  const childrenById = useMemo<Record<string, Child>>(
    () => Object.fromEntries(children.map((c) => [c.id, c])),
    [children],
  );

  // Hidden children drop off the dashboard entirely (managed from settings). A
  // reveal window temporarily shows them all. Re-evaluated on the minute tick,
  // so a schedule boundary passing re-filters within a minute.
  const revealActive = revealHiddenUntil != null && revealHiddenUntil > now;
  const visible = useMemo(
    () =>
      visibleChildren(children, { hidden, childGroupId, childSchedule, groups }, now, revealActive),
    [children, hidden, childGroupId, childSchedule, groups, now, revealActive],
  );

  // Count real hidden children regardless of the reveal window, so the "show
  // hidden" affordance reflects what's actually hidden.
  const numHidden = useMemo(
    () => hiddenCount(children, { hidden, childGroupId, childSchedule, groups }, now),
    [children, hidden, childGroupId, childSchedule, groups, now],
  );

  // Re-hide exactly when the reveal window expires. The minute tick alone would
  // leave them shown for up to a minute past the deadline.
  useEffect(() => {
    if (revealHiddenUntil == null) return;
    const ms = revealHiddenUntil - Date.now();
    if (ms <= 0) {
      clearReveal();
      return;
    }
    const id = setTimeout(() => clearReveal(), ms);
    return () => clearTimeout(id);
  }, [revealHiddenUntil, clearReveal]);

  // If the currently-active child was just hidden, `activeIndex` can point past
  // the filtered list — clamp so a tab stays selected and swipe navigation keeps
  // working instead of landing on nothing.
  const clampedIndex = activeIndex < visible.length ? activeIndex : 0;

  // Switching children is two jobs of very different weight: move the highlight
  // (one pill's colours) and rebuild the child card plus the whole un-virtualized
  // feed. Done in one commit the cheap one waits on the expensive one and the
  // chips visibly lag the finger. `useDeferredValue` splits them — the pill row
  // renders from `clampedIndex` urgently, the card and feed from `contentIndex`
  // on the follow-up low-priority pass. It only pays off because `ChildCard` and
  // `ActivityFeed` are memoized on stable props, so the urgent render can skip
  // them outright.
  const contentIndex = useDeferredValue(clampedIndex);
  const safeContentIndex = contentIndex < visible.length ? contentIndex : clampedIndex;
  const activeChild = visible[safeContentIndex];
  const feedEntries = useMemo(
    () => (activeChild ? entriesForChild(entries, activeChild.id) : []),
    [entries, activeChild],
  );

  // Offer the exclude-inactive-days feature the first time a logging gap is
  // actually diluting the active child's food-trend baseline — not before there
  // is anything to fix, and not again once the user has answered.
  const showInactiveDaysPrompt =
    !inactiveDaysPromptSeen && !excludeInactiveDays && hasInactiveBaselineDays(feedEntries, now);

  /**
   * The greeting is a welcome, not a fixture: once the user does anything on
   * the dashboard they're here to work, so it gets out of the way for the rest
   * of the session. Every interactive path on this screen runs through one of
   * the handlers below, so they're where the dismissal hangs — a global touch
   * hook would be less code and less certain.
   *
   * Every handler here is a stable reference on purpose. They're props of the
   * memoized card and feed, so a fresh closure per render would re-render both
   * on the pill tap and undo the deferred split above. That's also why this one
   * reads `welcomeDismissed` off the store rather than closing over the selector.
   */
  const dismiss = useCallback(() => {
    if (!useUiStore.getState().welcomeDismissed) dismissWelcome();
  }, [dismissWelcome]);

  const openCreate = useCallback(
    (childId: string, type: EntryType) => {
      dismiss();
      // Quick-logging a timed activity (Food/Sleep/Tummy) starts its timer right
      // away — tapping "Food" means a feed is starting now, matching the
      // prototype. The button is disabled once a timer runs, so this can't
      // double-start, and `startTimer` replaces any existing (type, child) timer.
      if (isTimerType(type)) startTimer(type, childId);
      navigation.navigate('LogEntry', { mode: 'create', childId, type });
    },
    [dismiss, navigation, startTimer],
  );

  /** Repeat dose from a med row — the form opens prefilled from that entry. */
  const openDose = useCallback(
    (childId: string, status: MedStatus) => {
      dismiss();
      navigation.navigate('LogEntry', {
        mode: 'create',
        childId,
        type: 'medication',
        prefillMedEntryId: status.entryId,
      });
    },
    [dismiss, navigation],
  );

  const openTimer = useCallback(
    (childId: string, type: TimerType) => {
      dismiss();
      const idx = visible.findIndex((c) => c.id === childId);
      if (idx >= 0) setActiveIndex(idx);
      navigation.navigate('LogEntry', { mode: 'create', childId, type });
    },
    [dismiss, navigation, visible],
  );

  const openEdit = useCallback(
    (entry: Entry) => {
      dismiss();
      navigation.navigate('LogEntry', {
        mode: 'edit',
        childId: entry.childId,
        type: entry.type,
        entryId: entry.id,
      });
    },
    [dismiss, navigation],
  );

  const confirmDelete = useCallback(
    (entry: Entry) => {
      dismiss();
      navigation.navigate('DeleteConfirm', {
        entryId: entry.id,
        entryLabel: entryTitle(entry),
      });
    },
    [dismiss, navigation],
  );

  const openMedBreakdown = useCallback(
    (child: Child) => {
      dismiss();
      navigation.navigate('MedBreakdown', { childId: child.id, childName: child.name });
    },
    [dismiss, navigation],
  );

  const changeChild = useCallback(
    (index: number) => {
      dismiss();
      setActiveIndex(index);
    },
    [dismiss],
  );

  // Tapping a delivered notification opens the screen it's about: the med
  // breakdown for a medication reminder, or a prefilled log form for a
  // timer/diaper/feeding one (see `notificationAction`). The child's tab is
  // focused first so the destination — and the dashboard behind it — is in
  // context. Weekly/unrecognised reminders aren't tappable, so never arrive here.
  const openNotification = useCallback(
    (item: DeliveredNotification) => {
      dismiss();
      const childId = item.childId;
      if (childId) {
        const idx = visible.findIndex((c) => c.id === childId);
        if (idx >= 0) setActiveIndex(idx);
      }
      const action = notificationAction(item.id);
      if (!childId) return;
      switch (action.kind) {
        case 'medication':
          navigation.navigate('MedBreakdown', {
            childId,
            childName: childrenById[childId]?.name ?? '',
          });
          return;
        case 'timer':
          navigation.navigate('LogEntry', { mode: 'create', childId, type: action.timerType });
          return;
        case 'create':
          navigation.navigate('LogEntry', { mode: 'create', childId, type: action.entryType });
          return;
        case 'none':
          return;
      }
    },
    [childrenById, dismiss, navigation, visible],
  );

  const openSettings = useCallback(() => {
    dismiss();
    navigation.navigate('Settings');
  }, [dismiss, navigation]);

  // Every dashboard alert in one stack: the reactive fetch error (with Retry)
  // first, then event errors (failed save/delete, dismissable), then the
  // OS-delivered reminders. Built inline — the list is tiny and rebuilding it on
  // the minute tick is free. `notificationAction` decides which reminders are
  // tappable (see `openNotification`).
  const carouselItems: CarouselItem[] = [];
  if (error) {
    carouselItems.push({
      kind: 'error',
      id: 'dashboard-fetch',
      title: t('errors.loadTitle'),
      body: errorMessage(error),
      onRetry: refetch,
    });
  }
  for (const e of appErrors) {
    carouselItems.push({
      kind: 'error',
      id: e.id,
      title: t(e.titleKey),
      body: e.message,
      childId: e.childId,
      onDismiss: () => dismissAppError(e.id),
    });
  }
  for (const n of deliveredNotifications) {
    const tappable = !!n.childId && notificationAction(n.id).kind !== 'none';
    carouselItems.push({
      kind: 'reminder',
      id: n.id,
      title: n.title,
      body: n.body,
      childId: n.childId,
      onPress: tappable ? () => openNotification(n) : undefined,
      onDismiss: () => dismissNotification(n.id),
    });
  }

  // Clear every dismissable card at once: the OS reminders (tells the OS) and
  // the event errors. The reactive fetch error has no ✕ and survives — it's
  // cleared by a successful refetch, not a manual sweep.
  const clearAllAlerts = () => {
    dismissAllNotifications();
    clearAppErrors();
  };

  // Everything above the feed. Passed to ActivityFeed as the SectionList's list
  // header so the whole screen scrolls as one while the feed itself virtualizes
  // (a virtualized list can't be nested in a same-orientation ScrollView).
  const header = (
    <View style={styles.header}>
      {welcomeDismissed ? null : (
        <View>
          <AppText size={fontSize.screenTitle} weight="800">
            {userName
              ? t('dashboard.greetingWithName', {
                  greeting: greeting(now),
                  name: displayUserName(userName),
                })
              : greeting(now)}
          </AppText>
          <AppText size={fontSize.bodySm} weight="600" color={colors.textMuted}>
            {longDate(now)}
          </AppText>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : null}

      {showInactiveDaysPrompt ? (
        <View style={styles.inactivePrompt}>
          <AppText size={fontSize.bodySm} weight="800">
            {t('dashboard.inactiveDaysTitle')}
          </AppText>
          <AppText size={fontSize.metaSm} weight="600" color={colors.textSecondary}>
            {t('dashboard.inactiveDaysBody')}
          </AppText>
          <View style={styles.inactiveActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => markInactiveDaysPromptSeen()}
              style={styles.inactiveDismiss}
            >
              <AppText size={fontSize.metaSm} weight="800" color={colors.textSecondary}>
                {t('dashboard.inactiveDaysDismiss')}
              </AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setExcludeInactiveDays(true)}
              style={styles.inactiveConfirm}
            >
              <AppText size={fontSize.metaSm} weight="800" color={colors.onAccent}>
                {t('dashboard.inactiveDaysExclude')}
              </AppText>
            </Pressable>
          </View>
        </View>
      ) : null}

      <TimerStrip childrenById={childrenById} now={timerNow} onPress={openTimer} />

      {numHidden > 0 && !revealActive ? (
        <View style={styles.revealRow}>
          <Chip
            label={t('dashboard.showHidden', { count: numHidden })}
            onPress={() => {
              dismiss();
              revealHidden(revealDurationMinutes * 60_000);
            }}
          />
        </View>
      ) : null}

      <NotificationCarousel
        items={carouselItems}
        childrenById={childrenById}
        onClearAll={clearAllAlerts}
      />

      {activeChild ? (
        <ChildNav
          childList={visible}
          entries={entries}
          activeIndex={clampedIndex}
          cardIndex={safeContentIndex}
          onActiveChange={changeChild}
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
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ActivityFeed
        entries={feedEntries}
        now={now}
        currentUser={currentUser}
        onEditEntry={openEdit}
        onDeleteEntry={confirmDelete}
        header={header}
        // Scrolling counts as interaction, same as tapping anything below.
        onScrollBeginDrag={dismiss}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing && !isLoading}
            onRefresh={refetch}
            tintColor={colors.accent}
          />
        }
      />
    </SafeAreaView>
  );
}

const makeStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    // The list-header block: 22px between each above-feed section (the feed's
    // own outer padding comes from the SectionList content container).
    header: {
      gap: spacing['5xl'],
    },
    loading: {
      paddingVertical: spacing['7xl'],
    },
    inactivePrompt: {
      gap: spacing.md,
      backgroundColor: colors.card,
      borderRadius: radii.control,
      padding: spacing['2xl'],
    },
    inactiveActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.md,
      marginTop: spacing.xs,
    },
    inactiveDismiss: {
      borderRadius: radii.chipSmall,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing['2xl'],
      backgroundColor: colors.neutral,
    },
    inactiveConfirm: {
      borderRadius: radii.chipSmall,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing['2xl'],
      backgroundColor: colors.accent,
    },
    settingsFallback: {
      alignItems: 'flex-end',
    },
    revealRow: {
      alignItems: 'flex-start',
    },
  });