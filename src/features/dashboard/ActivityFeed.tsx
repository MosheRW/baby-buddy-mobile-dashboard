import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  SectionList,
  StyleSheet,
  View,
  type RefreshControlProps,
  type SectionListData,
  type SectionListRenderItemInfo,
} from 'react-native';
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
import { canModifyEntry, type EntryOwner } from '../../lib/entryOwnership';
import { displayUserName } from '../../lib/userName';
import {
  entryDurationLabel,
  entryTitle,
  entryVisual,
  type EntryVisual,
} from '../../lib/entryDisplay';
import { useSettingsStore } from '../../stores';
import type { Entry } from '../../api/types';

const FILTER_VALUES: FeedFilter[] = ['all', 'diaper', 'feeding', 'medication', 'sleep'];

/** One day-group; `data` is the SectionList's required per-section item array. */
type FeedSection = { header: string; data: Entry[] };

const keyExtractor = (entry: Entry) => entry.id;

/** 10px gap between rows within a day-group (matches the old group gap). */
const rowSeparatorStyle = { height: spacing.md };
function ItemSeparator() {
  return <View style={rowSeparatorStyle} />;
}

interface ActivityFeedProps {
  entries: Entry[];
  /** Advancing clock from the dashboard's 60s tick, for relative-time labels. */
  now: number;
  /** Current user, for the "edit/delete only your own entries" guard. */
  currentUser: EntryOwner | undefined;
  onEditEntry: (entry: Entry) => void;
  onDeleteEntry: (entry: Entry) => void;
  /**
   * The whole above-feed dashboard content (greeting, timer strip, carousel,
   * child card + quick actions). Rendered as the list header so the feed can
   * virtualize while everything scrolls together — a virtualized list can't be
   * nested inside a same-orientation ScrollView.
   */
  header: React.ReactElement;
  /** Pull-to-refresh control, owned by the dashboard's query. */
  refreshControl?: React.ReactElement<RefreshControlProps>;
  /** Scrolling counts as a welcome-dismissing interaction. */
  onScrollBeginDrag?: () => void;
}

/**
 * The dashboard's single scroll container: a SectionList that virtualizes the
 * feed (one Card per entry — the heaviest thing on the screen) while carrying
 * the entire above-feed dashboard as its list header, so it all scrolls as one.
 *
 * The old whole-feed memo (skip the feed on a child-switch's urgent pass) is
 * replaced by two things that survive virtualization: only visible rows exist
 * at all, and each `FeedRow` is memoized so the urgent pass — which changes the
 * header (pills) but not `sections`/`extraData` — reconciles just the header
 * and leaves the visible rows untouched. The child card stays deferred in
 * `ChildNav` (in the header), so the pill highlight still leads the card.
 */
export function ActivityFeed({
  entries,
  now,
  currentUser,
  onEditEntry,
  onDeleteEntry,
  header,
  refreshControl,
  onScrollBeginDrag,
}: ActivityFeedProps) {
  const { t } = useTranslation();
  const { colors, tints } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [filter, setFilter] = useState<FeedFilter>('all');
  // The two filters stack: a type chip narrows the list, a tag narrows it
  // further. Tapping a tag on any row sets it; the chip below clears it.
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const excludeInactiveDays = useSettingsStore((s) => s.excludeInactiveDays);

  // Memoized so the SectionList sees a stable `sections` reference on the
  // urgent pill-tap pass (activeChild is deferred, so `entries` is unchanged
  // then) and skips re-rendering the visible rows.
  const scoped = useMemo(
    () => (tagFilter ? filterByTag(entries, tagFilter) : entries),
    [entries, tagFilter],
  );
  const sections = useMemo<FeedSection[]>(
    () => filterAndGroup(scoped, filter, now).map((g) => ({ header: g.header, data: g.entries })),
    [scoped, filter, now],
  );

  // Only with the feature on do the feed gauges switch from the frozen per-entry
  // baseline to the toggle-sensitive per-day norm; off, they stay exactly as
  // before. `entries` is already scoped to the active child, so this norm is
  // that child's own average daily intake.
  const dailyNorm = useMemo(
    () =>
      excludeInactiveDays
        ? dailyIntakeNorm(entries, now, { excludeInactiveDays: true })
        : undefined,
    [excludeInactiveDays, entries, now],
  );

  const filterOptions = FILTER_VALUES.map((value) => ({
    value,
    label: value === 'all' ? t('filter.all') : t(`entryType.${value}`),
  }));

  // A row re-renders only when one of these moves: the tick (time labels), the
  // norm (gauges), or the current user (edit/delete affordance).
  const extraData = useMemo(
    () => ({ now, dailyNorm, currentUser }),
    [now, dailyNorm, currentUser],
  );

  const renderItem = useCallback(
    ({ item }: SectionListRenderItemInfo<Entry, FeedSection>) => (
      <FeedRow
        entry={item}
        now={now}
        dailyNorm={dailyNorm}
        canModify={canModifyEntry(item, currentUser)}
        onEdit={onEditEntry}
        onDelete={onDeleteEntry}
        onTagPress={setTagFilter}
      />
    ),
    [now, dailyNorm, currentUser, onEditEntry, onDeleteEntry],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<Entry, FeedSection> }) => (
      <AppText
        size={fontSize.metaSm}
        weight="800"
        color={colors.textMuted}
        style={styles.dayHeader}
      >
        {section.header.toUpperCase()}
      </AppText>
    ),
    [colors.textMuted, styles.dayHeader],
  );

  const listHeader = (
    <View style={styles.listHeader}>
      {header}
      <View style={styles.feedHeader}>
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
      </View>
    </View>
  );

  return (
    <SectionList<Entry, FeedSection>
      style={styles.list}
      contentContainerStyle={styles.content}
      sections={sections}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={
        <AppText size={fontSize.bodySm} weight="600" color={colors.textMuted} style={styles.empty}>
          {t('dashboard.noEntries')}
        </AppText>
      }
      ItemSeparatorComponent={ItemSeparator}
      stickySectionHeadersEnabled={false}
      showsVerticalScrollIndicator={false}
      onScrollBeginDrag={onScrollBeginDrag}
      refreshControl={refreshControl}
      extraData={extraData}
    />
  );
}

/**
 * Memoized too, and it takes the entry-taking callbacks rather than per-row
 * closures — a `() => onEditEntry(entry)` prop would be a fresh function every
 * render and defeat the memo on every row.
 */
const FeedRow = React.memo(function FeedRow({
  entry,
  now,
  dailyNorm,
  canModify,
  onEdit,
  onDelete,
  onTagPress,
}: {
  entry: Entry;
  now: number;
  /** Per-day intake norm when excluding inactive days; else undefined. */
  dailyNorm?: number;
  /** Whether this user may edit/delete the row (own entry, or staff). */
  canModify: boolean;
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

  // The body is shared between the editable (Pressable) and read-only (View)
  // wrappers below, so it's built once here.
  const rowBody = (
    <>
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
    </>
  );

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

      {/* The row body opens the editor — but only for an entry this user may
          edit. For someone else's entry (a non-staff caregiver) it's a plain,
          non-pressable View: everything worth seeing is already shown inline. */}
      {canModify ? (
        <Pressable style={styles.rowText} onPress={() => onEdit(entry)} accessibilityRole="button">
          {rowBody}
        </Pressable>
      ) : (
        <View style={styles.rowText}>{rowBody}</View>
      )}

      {/* Edit/delete are hidden entirely on entries this user can't modify. */}
      {canModify ? (
        <View style={styles.actions}>
          <RowButton
            label={t('dashboard.editEntry')}
            onPress={() => onEdit(entry)}
            bg={colors.neutral}
          >
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
      ) : null}

      {author || tags.length > 0 ? (
        <View style={styles.tagRow}>
          {author ? (
            <View style={[styles.tagChip, styles.authorChip]}>
              <AppText size={fontSize.micro} weight="700" color={colors.textMuted}>
                {/* Display only — the stored label keeps its underscores, since
                    the "by {creator}" tag is wire format parsed by prefix. */}
                {displayUserName(author.label)}
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
      // The button is 26px; 9px of slop brings the touch area to the ~44px
      // guideline without changing the visual layout.
      hitSlop={9}
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
    list: {
      flex: 1,
    },
    content: {
      padding: spacing['2xl'],
    },
    // 22px between the dashboard header block and the feed's title/chips —
    // matches the old ScrollView gap between the child card and the feed.
    listHeader: {
      gap: spacing['5xl'],
    },
    // 12px among the feed title, filter chips, and the tag-filter row.
    feedHeader: {
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
    dayHeader: {
      letterSpacing: 0.6,
      // Separates a day-group from the content above it (the previous group's
      // last row, or the filter chips for the first group); marginBottom sets
      // it off from its own first row (the old within-group gap).
      marginTop: spacing['4xl'],
      marginBottom: spacing.md,
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
