import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText } from '../../components';
import { GearGlyph } from '../../components/glyphs';
import { colors, fontSize, radii, shadows, spacing } from '../../theme';
import { greeting, longDate } from '../../lib/dates';
import type { Child, Entry, EntryType } from '../../api/types';
import type { TimerType } from '../../lib/timers';
import type { MainStackParamList } from '../../navigation/types';
import { useDashboardData } from '../../data/useData';
import { useSettingsStore } from '../../stores';
import { useMinuteTick, useTimerTick } from '../../hooks/useTick';
import { entryTitle } from '../../lib/entryDisplay';
import { ChildNav } from './ChildNav';
import { TimerStrip } from './TimerStrip';
import { ActivityFeed } from './ActivityFeed';
import { entriesForChild } from './selectors';

type Props = NativeStackScreenProps<MainStackParamList, 'Dashboard'>;

export function DashboardScreen({ navigation }: Props) {
  const { children, entries } = useDashboardData();
  const [activeIndex, setActiveIndex] = useState(0);
  const foodWindowHours = useSettingsStore((s) => s.foodWindowHours);

  const now = useMinuteTick();
  const timerNow = useTimerTick();

  const childrenById = useMemo<Record<string, Child>>(
    () => Object.fromEntries(children.map((c) => [c.id, c])),
    [children],
  );

  const activeChild = children[activeIndex] ?? children[0];
  const feedEntries = activeChild ? entriesForChild(entries, activeChild.id) : [];

  const openCreate = (childId: string, type: EntryType) =>
    navigation.navigate('LogEntry', { mode: 'create', childId, type });

  const openTimer = (childId: string, type: TimerType) => {
    const idx = children.findIndex((c) => c.id === childId);
    if (idx >= 0) setActiveIndex(idx);
    navigation.navigate('LogEntry', { mode: 'create', childId, type });
  };

  const openEdit = (entry: Entry) =>
    navigation.navigate('LogEntry', {
      mode: 'edit',
      childId: entry.childId,
      type: entry.type,
      entryId: entry.id,
    });

  const confirmDelete = (entry: Entry) =>
    navigation.navigate('DeleteConfirm', {
      entryId: entry.id,
      entryLabel: entryTitle(entry),
    });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <AppText size={fontSize.screenTitle} weight="800">
              {greeting(now)}
            </AppText>
            <AppText size={fontSize.bodySm} weight="600" color={colors.textMuted}>
              {longDate(now)}
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => navigation.navigate('Settings')}
            style={styles.gear}
          >
            <GearGlyph size={20} />
          </Pressable>
        </View>

        <TimerStrip childrenById={childrenById} now={timerNow} onPress={openTimer} />

        {activeChild ? (
          <ChildNav
            childList={children}
            entries={entries}
            activeIndex={activeIndex}
            onActiveChange={setActiveIndex}
            foodWindowHours={foodWindowHours}
            now={now}
            timerNow={timerNow}
            onQuickAction={openCreate}
          />
        ) : null}

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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  gear: {
    width: 38,
    height: 38,
    borderRadius: radii.tile,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...(shadows.feedRow as object),
  },
});
