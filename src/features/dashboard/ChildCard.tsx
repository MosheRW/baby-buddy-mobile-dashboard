import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, Card, StatTile } from '../../components';
import { EntryGlyph } from '../../components/glyphs/entryGlyphs';
import {
  accentColors,
  fontSize,
  radii,
  spacing,
  useTheme,
  useThemedStyles,
  type AppTheme,
} from '../../theme';
import { effectiveHue } from '../../lib/visibility';
import { timeAgo } from '../../lib/dates';
import { ageLabel } from '../../api/normalize';
import type { Child, Entry, EntryType } from '../../api/types';
import { QuickActions } from './QuickActions';
import { SettingsButton } from './SettingsButton';
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
  eligibleStatusLabel,
  formatDose,
  medLimitSummaries,
  neededStatusLabel,
  type MedLimitSummary,
} from '../../lib/medication';
import { foodTrend, foodTrendLabel } from '../../lib/feed';
import { DEFAULT_FOOD_INTERVAL_MINUTES } from '../../lib/notifications';
import { elapsedClock, TIMER_TYPES } from '../../lib/timers';
import { formatWidgetSpan, type TimeFormat } from '../../lib/timeFormat';
import { useKidsStore, useNotificationStore, useSettingsStore, useTimerStore } from '../../stores';

interface ChildCardProps {
  child: Child;
  entries: Entry[];
  /** 60s tick for relative-time labels. */
  now: number;
  /** 1s tick for live timer elapsed labels on quick-action buttons. */
  timerNow: number;
  onQuickAction: (type: EntryType) => void;
  /** Opens the 24h medication breakdown sheet for this child. */
  onOpenMedBreakdown?: () => void;
  /** Opens the medication form prefilled from an existing dose of that med. */
  onLogDose?: (status: MedStatus) => void;
  /** When set, a settings cog floats inline with the name in the header. */
  onOpenSettings?: () => void;
  width?: number;
}

/**
 * Memoized: it rescans the whole entry list several times over (last-of-type,
 * med windows, 7-day food trend), so it has to be skippable on the render that
 * only flipped which pill is highlighted. Callers pass stable callbacks.
 */
export const ChildCard = React.memo(function ChildCard({
  child,
  entries,
  now,
  timerNow,
  onQuickAction,
  onOpenMedBreakdown,
  onLogDose,
  onOpenSettings,
  width,
}: ChildCardProps) {
  const { t } = useTranslation();
  const { scheme, colors, tints } = useTheme();
  const styles = useThemedStyles(makeStyles);
  // The per-child feeding interval doubles as this child's food-total window
  // (merged from the old global "feeding window" setting).
  const windowMinutes = useNotificationStore(
    (s) => s.perChild[child.id]?.foodMinIntervalMinutes ?? DEFAULT_FOOD_INTERVAL_MINUTES,
  );
  const childEntries = entriesForChild(entries, child.id);
  const pee = lastDiaper(childEntries, 'pee');
  const poo = lastDiaper(childEntries, 'poo');
  const feeding = lastFeeding(childEntries);
  const total = foodTotal(childEntries, windowMinutes / 60);
  const needed = neededMeds(childEntries, now);
  const eligible = eligibleMeds(childEntries, now);
  const limits = medLimitSummaries(childEntries, now);
  const excludeInactiveDays = useSettingsStore((s) => s.excludeInactiveDays);
  const timeFormat = useSettingsStore((s) => s.timeFormat);
  const trend = foodTrend(childEntries, now, { excludeInactiveDays });

  // The child's accent (override → group → default hue) drives the avatar, the
  // name, and the card's gradient background, all from one hue.
  const childAccent = useKidsStore((s) => s.childAccent);
  const childGroupId = useKidsStore((s) => s.childGroupId);
  const groups = useKidsStore((s) => s.groups);
  const accent = accentColors(effectiveHue(child, { childAccent, childGroupId, groups }), scheme);

  // Live mm:ss labels for this child's running timers, keyed by entry type.
  const timers = useTimerStore((s) => s.timers);
  const runningTimers: Partial<Record<EntryType, string>> = {};
  for (const type of TIMER_TYPES) {
    const t = timers.find((x) => x.type === type && x.childId === child.id);
    if (t) runningTimers[type] = elapsedClock(t.startedAt, timerNow, timeFormat);
  }

  return (
    <Card
      style={[styles.card, width != null && { width }]}
      gradient={[accent.gradientFrom, accent.gradientTo]}
    >
      <View style={styles.header}>
        <View style={styles.headerMain}>
          <View style={[styles.avatar, { backgroundColor: accent.avatarBg }]}>
            <AppText size={fontSize.cardTitleLg} weight="800" color={accent.avatarFg}>
              {child.initial}
            </AppText>
          </View>
          <View>
            <AppText size={fontSize.cardTitle} weight="800" color={accent.name}>
              {child.name}
            </AppText>
            <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
              {ageLabel(child.birthDate, now)}
            </AppText>
          </View>
        </View>
        {onOpenSettings ? <SettingsButton onPress={onOpenSettings} /> : null}
      </View>

      {/* The 24h intake summary belongs to this tile, not to the food total
          below it — it's context for the feed that just happened. Feeding sits
          above the diaper tiles. */}
      <StatTile
        label={t('childCard.lastFeeding')}
        value={
          feeding
            ? t('childCard.lastFeedingValue', {
                title: entryTitle(feeding),
                ago: timeAgo(feeding.time, now, timeFormat),
              })
            : '—'
        }
        tint={tints.feeding}
        glyph="feedingBottle"
      >
        <FoodTrend trend={trend} />
      </StatTile>

      <View style={styles.statRow}>
        <StatTile
          label={t('childCard.lastPee')}
          value={pee ? timeAgo(pee.time, now, timeFormat) : '—'}
          tint={tints.pee}
          glyph="diaperPee"
          style={styles.stat}
        />
        <StatTile
          label={t('childCard.lastPoo')}
          value={poo ? timeAgo(poo.time, now, timeFormat) : '—'}
          tint={tints.poo}
          glyph="diaperPoo"
          style={styles.stat}
        />
      </View>

      <StatTile
        label={t('childCard.foodWindow', {
          window: formatWidgetSpan(windowMinutes * 60_000, timeFormat),
        })}
        value={t('childCard.foodValue', { amount: total })}
        tint={{ bg: colors.tileNeutral }}
      />

      {needed.map((m) => (
        <MedRow
          key={`n-${m.name}`}
          status={m}
          kind="needed"
          now={now}
          format={timeFormat}
          onPress={onLogDose}
        />
      ))}
      {eligible.map((m) => (
        <MedRow
          key={`e-${m.name}`}
          status={m}
          kind="eligible"
          now={now}
          format={timeFormat}
          onPress={onLogDose}
        />
      ))}
      {limits.map((m) => (
        <MedLimitTile
          key={`l-${m.name}`}
          summary={m}
          now={now}
          format={timeFormat}
          onPress={onOpenMedBreakdown}
        />
      ))}

      <QuickActions onAction={onQuickAction} runningTimers={runningTimers} />
    </Card>
  );
});

/**
 * A medicine this child is on: what it is, when it was last given, and where
 * that puts the next dose. Stays on the calm cream tile until it actually wants
 * attention — a permanently coloured row is a permanently ignored one.
 *
 * Tapping opens the medication form prefilled from this dose. Unlike the
 * prototype, which only wires the tap once the med is due, the row is always
 * tappable: giving a dose early is legitimate, and a tap target that silently
 * does nothing is a bug rather than a design.
 */
function MedRow({
  status,
  kind,
  now,
  format,
  onPress,
}: {
  status: MedStatus;
  kind: 'needed' | 'eligible';
  now: number;
  format: TimeFormat;
  onPress?: (status: MedStatus) => void;
}) {
  const { t } = useTranslation();
  const { colors, tints } = useTheme();
  const styles = useThemedStyles(makeStyles);
  // Scheduled meds warn a few minutes ahead; an as-needed med has nothing to be
  // late for, so it only lights up once it's actually available again.
  const urgent = kind === 'needed' ? status.urgent : status.isDue;
  const tint = kind === 'needed' ? tints.overdue : tints.eligible;
  const bg = urgent ? tint.bg : colors.tileNeutral;
  const fg = urgent ? tint.fg : colors.textSecondary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('childCard.logDose', { name: status.name })}
      disabled={onPress == null}
      onPress={() => onPress?.(status)}
      style={[styles.medRow, { backgroundColor: bg }]}
    >
      <View style={styles.medIcon}>
        <EntryGlyph kind={medGlyphKind(status.unit)} size={13} color={fg} />
      </View>
      <View style={styles.medName}>
        <AppText size={fontSize.meta} weight="700" color={fg}>
          {status.name}
        </AppText>
        <AppText size={fontSize.micro} weight="600" color={fg} style={styles.faded}>
          {t('childCard.lastAt', {
            time: timeAgo(new Date(status.lastTakenAt).toISOString(), now, format),
          })}
        </AppText>
      </View>
      <AppText size={fontSize.metaSm} weight="800" color={fg} style={styles.medStatus}>
        {kind === 'needed'
          ? neededStatusLabel(status, format)
          : eligibleStatusLabel(status, format)}
      </AppText>
    </Pressable>
  );
}

/**
 * An as-needed medication that carries a 24h ceiling: how much of it has been
 * used, and when the next dose is allowed. Tapping opens the full breakdown.
 */
function MedLimitTile({
  summary,
  now,
  format,
  onPress,
}: {
  summary: MedLimitSummary;
  now: number;
  format: TimeFormat;
  onPress?: () => void;
}) {
  const { t } = useTranslation();
  const { colors, tints } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const fg = tints.eligible.fg;
  // At the ceiling the bar turns red — this is the one number here that means
  // "stop", so it shouldn't read the same as a half-full bar.
  const barColor = summary.atLimit ? colors.danger : fg;
  const eligible = summary.isDue
    ? t('med.eligibleNowShort')
    : t('med.eligibleInShort', { duration: formatWidgetSpan(summary.dueInMs, format) });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('childCard.limitAria', {
        name: summary.name,
        taken: summary.taken,
        limit: summary.limit,
      })}
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
            {t('childCard.lastAt', {
              time: timeAgo(new Date(summary.lastTakenAt).toISOString(), now, format),
            })}
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

/**
 * Today's food total against the previous 7 days' daily average.
 *
 * Always rendered. It used to bail out when the average was 0, which is exactly
 * the case a new account is in — the summary simply never appeared. `foodTrend`
 * now gauges today against itself when there's no norm yet.
 */
function FoodTrend({ trend }: { trend: ReturnType<typeof foodTrend> }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.trend}>
      <View style={[styles.barTrack, styles.trendTrack]}>
        <View
          style={[
            styles.barFill,
            {
              width: `${trend.percent}%`,
              backgroundColor: trend.up ? colors.trendUp : colors.trendDown,
            },
          ]}
        />
      </View>
      <AppText size={fontSize.micro} weight="700" color={colors.textSecondary}>
        {foodTrendLabel(trend)}
      </AppText>
    </View>
  );
}

const makeStyles = ({ colors, tints }: AppTheme) =>
  StyleSheet.create({
    card: {
      gap: spacing.xl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.lg,
    },
    headerMain: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      flexShrink: 1,
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
    medRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: radii.tile,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    medIcon: {
      width: 22,
      height: 22,
      borderRadius: radii.iconButton,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    medName: {
      flex: 1,
    },
    medStatus: {
      textAlign: 'right',
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
      marginTop: spacing.xs,
    },
    trendTrack: {
      backgroundColor: tints.feeding.track,
    },
  });
