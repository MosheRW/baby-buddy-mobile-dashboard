import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Card, StatTile } from '../../components';
import { avatarTint, colors, fontSize, radii, spacing, tints } from '../../theme';
import { timeAgo } from '../../lib/dates';
import type { Child, Entry, EntryType } from '../../api/types';
import { QuickActions } from './QuickActions';
import {
  entriesForChild,
  lastDiaper,
  lastFeeding,
  foodTotal,
  neededMeds,
  eligibleMeds,
  type MedStatus,
} from './selectors';
import { entryTitle } from '../../lib/entryDisplay';
import { countdownLabel } from '../../lib/medication';
import { elapsedClock, TIMER_TYPES } from '../../lib/timers';
import { useTimerStore } from '../../stores';

interface ChildCardProps {
  child: Child;
  entries: Entry[];
  foodWindowHours: number;
  /** 60s tick for relative-time labels. */
  now: number;
  /** 1s tick for live timer elapsed labels on quick-action buttons. */
  timerNow: number;
  onQuickAction: (type: EntryType) => void;
  width?: number;
}

export function ChildCard({
  child,
  entries,
  foodWindowHours,
  now,
  timerNow,
  onQuickAction,
  width,
}: ChildCardProps) {
  const childEntries = entriesForChild(entries, child.id);
  const pee = lastDiaper(childEntries, 'pee');
  const poo = lastDiaper(childEntries, 'poo');
  const feeding = lastFeeding(childEntries);
  const total = foodTotal(childEntries, foodWindowHours);
  const needed = neededMeds(childEntries, now);
  const eligible = eligibleMeds(childEntries, now);
  const tint = avatarTint(child.hue);

  // Live mm:ss labels for this child's running timers, keyed by entry type.
  const timers = useTimerStore((s) => s.timers);
  const runningTimers: Partial<Record<EntryType, string>> = {};
  for (const type of TIMER_TYPES) {
    const t = timers.find((x) => x.type === type && x.childId === child.id);
    if (t) runningTimers[type] = elapsedClock(t.startedAt, timerNow);
  }

  return (
    <Card style={[styles.card, width != null && { width }]}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: tint.bg }]}>
          <AppText size={fontSize.cardTitleLg} weight="800" color={tint.fg}>
            {child.initial}
          </AppText>
        </View>
        <View>
          <AppText size={fontSize.cardTitle} weight="800">
            {child.name}
          </AppText>
          <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
            {child.age}
          </AppText>
        </View>
      </View>

      <View style={styles.statRow}>
        <StatTile
          label="Last pee"
          value={pee ? timeAgo(pee.time, now) : '—'}
          tint={tints.pee}
          style={styles.stat}
        />
        <StatTile
          label="Last poo"
          value={poo ? timeAgo(poo.time, now) : '—'}
          tint={tints.poo}
          style={styles.stat}
        />
      </View>

      <StatTile
        label="Last feeding"
        value={feeding ? `${entryTitle(feeding)} · ${timeAgo(feeding.time, now)}` : '—'}
        tint={tints.feeding}
      />

      {needed.map((m) => (
        <MedRow key={`n-${m.name}`} status={m} kind="needed" />
      ))}
      {eligible.map((m) => (
        <MedRow key={`e-${m.name}`} status={m} kind="eligible" />
      ))}

      <View style={styles.foodTotal}>
        <AppText size={fontSize.bodySm} weight="700" color={colors.textSecondary}>
          Food total ({foodWindowHours}h)
        </AppText>
        <AppText size={fontSize.bodySm} weight="800">
          {total} ml
        </AppText>
      </View>

      <QuickActions onAction={onQuickAction} runningTimers={runningTimers} />
    </Card>
  );
}

function MedRow({ status, kind }: { status: MedStatus; kind: 'needed' | 'eligible' }) {
  const due = status.isDue;
  const tint = kind === 'needed' ? tints.overdue : tints.eligible;
  const bg = due ? tint.bg : colors.neutral;
  const fg = due ? tint.fg : colors.textSecondary;

  const label = kind === 'needed' ? `${status.name} needed` : `Eligible for ${status.name}`;
  const value = due ? (kind === 'needed' ? 'overdue' : 'now') : `in ${countdownLabel(status.dueInMs)}`;

  return (
    <View style={[styles.medRow, { backgroundColor: bg }]}>
      <AppText size={fontSize.bodySm} weight="700" color={fg}>
        {label}
      </AppText>
      <AppText size={fontSize.bodySm} weight="800" color={fg}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  stat: {
    flex: 1,
  },
  foodTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  medRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: radii.tile,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
});
