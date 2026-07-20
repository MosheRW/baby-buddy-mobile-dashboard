import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Card, StatTile } from '../../components';
import { EntryGlyph } from '../../components/glyphs/entryGlyphs';
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
import { entryTitle, medGlyphKind } from '../../lib/entryDisplay';
import {
  countdownLabel,
  formatDose,
  medLimitSummaries,
  type MedLimitSummary,
} from '../../lib/medication';
import { foodTrend } from '../../lib/feed';
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
  /** Opens the 24h medication breakdown sheet for this child. */
  onOpenMedBreakdown?: () => void;
  width?: number;
}

export function ChildCard({
  child,
  entries,
  foodWindowHours,
  now,
  timerNow,
  onQuickAction,
  onOpenMedBreakdown,
  width,
}: ChildCardProps) {
  const childEntries = entriesForChild(entries, child.id);
  const pee = lastDiaper(childEntries, 'pee');
  const poo = lastDiaper(childEntries, 'poo');
  const feeding = lastFeeding(childEntries);
  const total = foodTotal(childEntries, foodWindowHours);
  const needed = neededMeds(childEntries, now);
  const eligible = eligibleMeds(childEntries, now);
  const limits = medLimitSummaries(childEntries, now);
  const trend = foodTrend(childEntries, now);
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
      {limits.map((m) => (
        <MedLimitTile key={`l-${m.name}`} summary={m} now={now} onPress={onOpenMedBreakdown} />
      ))}

      <View>
        <View style={styles.foodTotal}>
          <AppText size={fontSize.bodySm} weight="700" color={colors.textSecondary}>
            Food total ({foodWindowHours}h)
          </AppText>
          <AppText size={fontSize.bodySm} weight="800">
            {total} ml
          </AppText>
        </View>
        <FoodTrend trend={trend} />
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

/**
 * An as-needed medication that carries a 24h ceiling: how much of it has been
 * used, and when the next dose is allowed. Tapping opens the full breakdown.
 */
function MedLimitTile({
  summary,
  now,
  onPress,
}: {
  summary: MedLimitSummary;
  now: number;
  onPress?: () => void;
}) {
  const fg = tints.eligible.fg;
  // At the ceiling the bar turns red — this is the one number here that means
  // "stop", so it shouldn't read the same as a half-full bar.
  const barColor = summary.atLimit ? colors.danger : fg;
  const eligible = summary.isDue ? 'now' : `in ${countdownLabel(summary.dueInMs)}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${summary.name} 24-hour total, ${summary.taken} of ${summary.limit}`}
      disabled={onPress == null}
      onPress={onPress}
      style={styles.limitTile}
    >
      <View style={styles.limitHeader}>
        <View style={styles.limitIcon}>
          <EntryGlyph kind={medGlyphKind(summary.unit)} size={13} color={fg} />
        </View>
        <View style={styles.limitName}>
          <AppText size={fontSize.meta} weight="700" color={fg}>
            {summary.name}
          </AppText>
          <AppText size={fontSize.micro} weight="600" color={fg} style={styles.faded}>
            last {timeAgo(new Date(summary.lastTakenAt).toISOString(), now)}
          </AppText>
        </View>
        <AppText size={fontSize.metaSm} weight="800" color={fg}>
          {eligible}
        </AppText>
      </View>

      <AppText size={fontSize.metaSm} weight="700" color={fg}>
        {formatDose(summary.taken, summary.unit)} / {formatDose(summary.limit, summary.unit)}
      </AppText>
      <View style={styles.barTrack}>
        <View
          style={[styles.barFill, { width: `${summary.percent}%`, backgroundColor: barColor }]}
        />
      </View>
    </Pressable>
  );
}

/** Today's food total against the previous 7 days' daily average. */
function FoodTrend({ trend }: { trend: ReturnType<typeof foodTrend> }) {
  if (trend.avgPerDay === 0) return null;
  return (
    <View style={styles.trend}>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            {
              width: `${trend.percent}%`,
              backgroundColor: trend.up ? colors.accent : colors.textMuted,
            },
          ]}
        />
      </View>
      <AppText size={fontSize.micro} weight="600" color={colors.textMuted} style={styles.trendText}>
        {trend.last24} ml today vs {trend.avgPerDay} ml daily average
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
  limitTile: {
    backgroundColor: tints.eligible.bg,
    borderRadius: radii.tile,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  limitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  limitIcon: {
    width: 22,
    height: 22,
    borderRadius: radii.iconButton,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  limitName: {
    flex: 1,
  },
  faded: {
    opacity: 0.75,
  },
  barTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
  trend: {
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    marginTop: spacing.sm,
  },
  trendText: {
    // Left-aligned under the bar, matching the food-total row above.
  },
});
