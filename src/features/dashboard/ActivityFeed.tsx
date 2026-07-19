import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Card, ChipRow } from '../../components';
import {
  BottleGlyph,
  CapsuleGlyph,
  CloseGlyph,
  DiaperGlyph,
  MoonGlyph,
  ThermometerGlyph,
  TummyGlyph,
} from '../../components/glyphs';
import { colors, fontSize, radii, spacing } from '../../theme';
import { timeAgo } from '../../lib/dates';
import { filterAndGroup, type FeedFilter } from '../../lib/feed';
import { entryTint, entryTitle } from '../../lib/entryDisplay';
import type { Entry, EntryType } from '../../api/types';

const FILTERS: { value: FeedFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'diaper', label: 'Diaper' },
  { value: 'feeding', label: 'Feeding' },
  { value: 'medication', label: 'Medication' },
  { value: 'sleep', label: 'Sleep' },
];

interface ActivityFeedProps {
  entries: Entry[];
  /** Advancing clock from the dashboard's 60s tick, for relative-time labels. */
  now: number;
  onEditEntry: (entry: Entry) => void;
  onDeleteEntry: (entry: Entry) => void;
}

export function ActivityFeed({ entries, now, onEditEntry, onDeleteEntry }: ActivityFeedProps) {
  const [filter, setFilter] = useState<FeedFilter>('all');
  const groups = filterAndGroup(entries, filter, now);

  return (
    <View style={styles.container}>
      <ChipRow
        layout="scroll"
        value={filter}
        onChange={(v) => setFilter(v as FeedFilter)}
        options={FILTERS}
      />

      {groups.length === 0 ? (
        <AppText size={fontSize.bodySm} weight="600" color={colors.textMuted} style={styles.empty}>
          No entries for this filter yet.
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
                onEdit={() => onEditEntry(entry)}
                onDelete={() => onDeleteEntry(entry)}
              />
            ))}
          </View>
        ))
      )}
    </View>
  );
}

function EntryGlyph({ type, color }: { type: EntryType; color: string }) {
  switch (type) {
    case 'diaper':
      return <DiaperGlyph size={18} color={color} />;
    case 'feeding':
      return <BottleGlyph size={18} color={color} />;
    case 'medication':
      return <CapsuleGlyph size={18} color={color} />;
    case 'temperature':
      return <ThermometerGlyph size={18} color={color} />;
    case 'sleep':
      return <MoonGlyph size={18} color={color} />;
    case 'tummyTime':
      return <TummyGlyph size={18} color={color} />;
    default:
      return <BottleGlyph size={18} color={color} />;
  }
}

function FeedRow({
  entry,
  now,
  onEdit,
  onDelete,
}: {
  entry: Entry;
  now: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const tint = entryTint(entry.type);
  return (
    <Card elevation="feedRow" radius={radii.feedRow} padding={spacing.lg} style={styles.row}>
      <Pressable style={styles.rowMain} onPress={onEdit} accessibilityRole="button">
        <View style={[styles.swatch, { backgroundColor: tint.bg }]}>
          <EntryGlyph type={entry.type} color={tint.fg} />
        </View>
        <View style={styles.rowText}>
          <AppText size={fontSize.bodySm} weight="700">
            {entryTitle(entry)}
          </AppText>
          <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
            {timeAgo(entry.time, now)}
          </AppText>
          {entry.note ? (
            <AppText size={fontSize.meta} weight="600" color={colors.textSecondary}>
              {entry.note}
            </AppText>
          ) : null}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Delete entry"
        hitSlop={8}
        onPress={onDelete}
        style={styles.deleteBtn}
      >
        <CloseGlyph size={16} color={colors.textMuted} />
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
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
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
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
  deleteBtn: {
    padding: spacing.xs,
  },
});
