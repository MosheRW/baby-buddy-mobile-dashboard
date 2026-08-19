import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, Card, ChipRow } from '../../components';
import { EntryGlyph, PencilGlyph, TrashGlyph } from '../../components/glyphs/entryGlyphs';
import { fontSize, radii, spacing, useTheme, useThemedStyles, type AppTheme } from '../../theme';
import { entryTimeLabel } from '../../lib/dates';
import {
  dailyIntakeNorm,
  feedingGaugePercent,
  filterAndGroup,
  type FeedFilter,
} from '../../lib/feed';
import { filterByTag, selectableTagLabels } from '../../lib/tags';
import {
  entryDurationLabel,
  entryTitle,
  entryVisual,
  type EntryVisual,
} from '../../lib/entryDisplay';
import { useSettingsStore } from '../../stores';
import type { Entry } from '../../api/types';

const FILTER_VALUES: FeedFilter[] = ['all', 'diaper', 'feeding', 'medication', 'sleep'];

interface ActivityFeedProps {
  entries: Entry[];
  /** Advancing clock from the dashboard's 60s tick, for relative-time labels. */
  now: number;
  onEditEntry: (entry: Entry) => void;
  onDeleteEntry: (entry: Entry) => void;
}

/**
 * Memoized, and every prop it takes is a stable reference from the dashboard.
 * This is the heaviest thing on the screen — one un-virtualized Card per entry —
 * so switching children must be able to skip it: the child pills re-render
 * urgently on the tap, the feed follows on the deferred pass. Without the memo
 * the whole list would re-render inside the tap's own commit and the pill
 * highlight would visibly lag the finger.
 */
export const ActivityFeed = React.memo(function ActivityFeed({
  entries,
  now,
  onEditEntry,
  onDeleteEntry,
}: ActivityFeedProps) {
  const { t } = useTranslation();
  const { colors, tints } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [filter, setFilter] = useState<FeedFilter>('all');
  // The two filters stack: a type chip narrows the list, a tag narrows it
  // further. Tapping a tag on any row sets it; the chip below clears it.
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const excludeInactiveDays = useSettingsStore((s) => s.excludeInactiveDays);

  const scoped = tagFilter ? filterByTag(entries, tagFilter) : entries;
  const groups = filterAndGroup(scoped, filter, now);

  // Only with the feature on do the feed gauges switch from the frozen per-entry
  // baseline to the toggle-sensitive per-day norm; off, they stay exactly as
  // before. `entries` is already scoped to the active child, so this norm is
  // that child's own average daily intake.
  const dailyNorm = excludeInactiveDays
    ? dailyIntakeNorm(entries, now, { excludeInactiveDays: true })
    : undefined;

  const filterOptions = FILTER_VALUES.map((value) => ({
    value,
    label: value === 'all' ? t('filter.all') : t(`entryType.${value}`),
  }));

  return (
    <View style={styles.container}>
      <AppText
        size={fontSize.bodySm}
        weight="800"
        color={colors.textSecondary}
        style={styles.title}
      >
        {t('dashboard.recentActivity')}
      </AppText>

      <ChipRow
        layout="scroll"
        value={filter}
        onChange={(v) => setFilter(v as FeedFilter)}
        options={filterOptions}
      />

      {tagFilter ? (
        <View style={styles.tagFilterRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('dashboard.clearTagFilter', { tag: tagFilter })}
            onPress={() => setTagFilter(null)}
            style={styles.tagFilter}
          >
            <AppText size={fontSize.metaSm} weight="800" color={tints.suggestion.fg}>
              {t('dashboard.tagFilter', { tag: tagFilter })}
            </AppText>
          </Pressable>
        </View>
      ) : null}

      {groups.length === 0 ? (
        <AppText size={fontSize.bodySm} weight="600" color={colors.textMuted} style={styles.empty}>
          {t('dashboard.noEntries')}
        </AppText>
      ) : (
        groups.map((group) => (
          <View key={group.header} style={styles.group}>
            <AppText
              size={fontSize.metaSm}
              weight="800"
              color={colors.textMuted}
              style={styles.dayHeader}
            >
              {group.header.toUpperCase()}
            </AppText>
            {group.entries.map((entry) => (
              <FeedRow
                key={entry.id}
                entry={entry}
                now={now}
                dailyNorm={dailyNorm}
                onEdit={onEditEntry}
                onDelete={onDeleteEntry}
                onTagPress={setTagFilter}
              />
            ))}
          </View>
        ))
      )}
    </View>
  );
});

/**
 * Memoized too, and it takes the entry-taking callbacks rather than per-row
 * closures — a `() => onEditEntry(entry)` prop would be a fresh function every
 * render and defeat the memo on every row.
 */
const FeedRow = React.memo(function FeedRow({
  entry,
  now,
  dailyNorm,
  onEdit,
  onDelete,
  onTagPress,
}: {
  entry: Entry;
  now: number;
  /** Per-day intake norm when excluding inactive days; else undefined. */
  dailyNorm?: number;
  onEdit: (entry: Entry) => void;
  onDelete: (entry: Entry) => void;
  onTagPress: (tag: string) => void;
}) {
  const { t } = useTranslation();
  const { scheme, colors, tints } = useTheme();
  const styles = useThemedStyles(makeStyles);
  // Scheme passed explicitly so the row's colours belong to the render that
  // produced them, rather than to whatever `getScheme()` happens to hold.
  const visual = entryVisual(entry, scheme);
  const gauge = entry.type === 'feeding' ? feedingGaugePercent(entry, dailyNorm) : null;
  const tags = selectableTagLabels(entry);
  // The non-removable "by {creator}" author tag rides at the front of every
  // entry. It shows as its own chip so each row records who logged it, but it
  // stays non-tappable: `filterByTag` never matches the author, so a tap would
  // be a dead filter.
  const author = entry.tags.find((t) => t.author);
  // The row's duration is pinned to the text form ("2h 30m") regardless of the
  // digital/text setting, so it reads the same in both modes.
  const duration = entryDurationLabel(entry, 'text');

  return (
    <Card
      elevation="feedRow"
      radius={radii.feedRow}
      padding={spacing.lg}
      // The left edge carries the entry's colour, so type is readable while
      // scrolling without reading the icon.
      style={[styles.row, { borderLeftColor: visual.accent }]}
    >
      <View style={[styles.swatch, { backgroundColor: visual.iconBg }]}>
        <EntryGlyph kind={visual.glyph} size={18} color={visual.accent} />
      </View>

      <Pressable style={styles.rowText} onPress={() => onEdit(entry)} accessibilityRole="button">
        <View style={styles.titleRow}>
          <AppText size={fontSize.bodySm} weight="700">
            {entryTitle(entry)}
          </AppText>
          {visual.tempDotColor ? (
            <View style={[styles.tempDot, { backgroundColor: visual.tempDotColor }]} />
          ) : null}
        </View>

        <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
          {entryTimeLabel(entry.time, now)}
          {duration ? ` · ${duration}` : ''}
        </AppText>

        {entry.note ? (
          <AppText size={fontSize.meta} weight="600" color={colors.textSecondary}>
            {entry.note}
          </AppText>
        ) : null}

        <DiaperAdornments visual={visual} />

        {gauge != null ? (
          <View style={styles.gaugeTrack}>
            <View
              style={[styles.gaugeFill, { width: `${gauge}%`, backgroundColor: visual.accent }]}
            />
          </View>
        ) : null}
      </Pressable>

      <View style={styles.actions}>
        <RowButton label={t('dashboard.editEntry')} onPress={() => onEdit(entry)} bg={colors.neutral}>
          <PencilGlyph size={14} color={colors.textSecondary} />
        </RowButton>
        <RowButton
          label={t('dashboard.deleteEntry')}
          onPress={() => onDelete(entry)}
          bg={tints.overdue.bg}
        >
          <TrashGlyph size={14} color={tints.overdue.fg} />
        </RowButton>
      </View>

      {author || tags.length > 0 ? (
        <View style={styles.tagRow}>
          {author ? (
            <View style={[styles.tagChip, styles.authorChip]}>
              <AppText size={fontSize.micro} weight="700" color={colors.textMuted}>
                {author.label}
              </AppText>
            </View>
          ) : null}
          {tags.map((tag) => (
            <Pressable
              key={tag}
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.filterByTag', { tag })}
              onPress={() => onTagPress(tag)}
              style={styles.tagChip}
            >
              <AppText size={fontSize.micro} weight="700" color={colors.textSecondary}>
                {tag}
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Card>
  );
});

/** The poo swatch and `x/10` badge, which only diaper rows carry. */
function DiaperAdornments({ visual }: { visual: EntryVisual }) {
  const styles = useThemedStyles(makeStyles);
  if (!visual.pooSwatchColor && !visual.amountBadge) return null;
  return (
    <View style={styles.adornments}>
      {visual.pooSwatchColor ? (
        <View style={[styles.pooSwatch, { backgroundColor: visual.pooSwatchColor }]} />
      ) : null}
      {visual.amountBadge ? (
        <View style={[styles.amountBadge, { backgroundColor: visual.iconBg }]}>
          <AppText size={fontSize.micro} weight="800" color={visual.accent}>
            {visual.amountBadge}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

function RowButton({
  label,
  onPress,
  bg,
  children,
}: {
  label: string;
  onPress: () => void;
  bg: string;
  children: React.ReactNode;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.rowButton,
        { backgroundColor: bg },
        pressed && styles.pressed,
      ]}
    >
      {children}
    </Pressable>
  );
}

const makeStyles = ({ colors, tints }: AppTheme) =>
  StyleSheet.create({
    container: {
      gap: spacing.lg,
    },
    title: {
      letterSpacing: 0.5,
    },
    tagFilterRow: {
      flexDirection: 'row',
    },
    tagFilter: {
      backgroundColor: tints.suggestion.bg,
      borderRadius: radii.chipSmall,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
    },
    empty: {
      textAlign: 'center',
      paddingVertical: spacing['6xl'],
    },
    group: {
      gap: spacing.md,
    },
    dayHeader: {
      letterSpacing: 0.6,
      marginTop: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      // Tags wrap onto their own line under the row's three columns.
      flexWrap: 'wrap',
      gap: spacing.lg,
      borderLeftWidth: 4,
    },
    swatch: {
      width: 34,
      height: 34,
      borderRadius: radii.chipSmall,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    tempDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    adornments: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: 4,
    },
    pooSwatch: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: colors.neutral,
    },
    amountBadge: {
      borderRadius: radii.chipSmall,
      paddingVertical: 2,
      paddingHorizontal: spacing.sm,
    },
    gaugeTrack: {
      height: 4,
      maxWidth: 120,
      borderRadius: 2,
      backgroundColor: colors.neutral,
      overflow: 'hidden',
      marginTop: spacing.xs,
    },
    gaugeFill: {
      height: '100%',
      borderRadius: 2,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    rowButton: {
      width: 26,
      height: 26,
      borderRadius: radii.chipSmall,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: {
      opacity: 0.7,
    },
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      // Full-width so it wraps below the icon/text/actions row.
      width: '100%',
    },
    tagChip: {
      backgroundColor: colors.neutral,
      borderRadius: radii.chipSmall,
      paddingVertical: 2,
      paddingHorizontal: spacing.sm,
    },
    authorChip: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.neutral,
    },
  });
