import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../../components';
import { ActionGlyph, type ActionGlyphKind } from '../../components/glyphs/entryGlyphs';
import { colors, fontSize, radii, spacing, tints } from '../../theme';
import type { EntryType } from '../../api/types';
import type { GlyphKind } from '../../lib/entryDisplay';

interface QuickAction {
  type: EntryType;
  label: string;
  /**
   * A quick action opens a blank form, so it stands for a whole category rather
   * than for any one entry's sub-type — hence the category glyphs (nappy,
   * capsule, ellipsis) rather than the pee-droplet / dropper-bottle / moon the
   * form happens to default to.
   */
  glyph: ActionGlyphKind | GlyphKind;
  /** The "More" button reads as chrome, not as a sixth entry type. */
  muted?: boolean;
}

/**
 * Order and set are the prototype's. "More" opens the temperature form, which
 * is also the prototype's behaviour — it is the only remaining type with a
 * dedicated field group, and notes stay reachable from the form's type chips.
 */
const ACTIONS: QuickAction[] = [
  { type: 'diaper', label: 'Diaper', glyph: 'nappy' },
  { type: 'feeding', label: 'Food', glyph: 'feedingBottle' },
  { type: 'sleep', label: 'Sleep', glyph: 'nap' },
  { type: 'tummyTime', label: 'Tummy', glyph: 'tummyTime' },
  { type: 'medication', label: 'Medication', glyph: 'pill' },
  { type: 'temperature', label: 'More', glyph: 'more', muted: true },
];

interface QuickActionsProps {
  onAction: (type: EntryType) => void;
  /** Types whose timer is running — shown disabled with the live mm:ss label. */
  runningTimers?: Partial<Record<EntryType, string>>;
}

/** 3-column quick-log button grid. */
export function QuickActions({ onAction, runningTimers = {} }: QuickActionsProps) {
  return (
    <View style={styles.grid}>
      {ACTIONS.map((action) => {
        const running = runningTimers[action.type];
        const disabled = running != null;
        const tint = action.muted ? tints.more : tints.quickAction;
        const bg = disabled ? colors.neutral : tint.bg;
        const fg = disabled ? colors.textMuted : tint.fg;
        return (
          <Pressable
            key={action.type}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={() => onAction(action.type)}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: bg },
              pressed && !disabled && styles.pressed,
            ]}
          >
            <View style={styles.glyph}>
              <ActionGlyph kind={action.glyph} size={22} color={fg} />
            </View>
            <AppText size={fontSize.micro} weight="700" color={fg}>
              {running ?? action.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  button: {
    // 3 per row: (100% - 2 gaps) / 3
    flexBasis: '31%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radii.tile,
    paddingVertical: spacing.md,
  },
  glyph: {
    height: 24,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
});
