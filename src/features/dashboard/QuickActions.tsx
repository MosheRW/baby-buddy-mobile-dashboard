import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../../components';
import { EntryGlyph } from '../../components/glyphs/entryGlyphs';
import { colors, fontSize, radii, spacing } from '../../theme';
import type { EntryType } from '../../api/types';
import type { GlyphKind } from '../../lib/entryDisplay';

interface QuickAction {
  type: EntryType;
  label: string;
  /**
   * The sub-type these buttons stand for. A quick action opens a blank form,
   * so it has no entry to derive a glyph from — it picks the default the form
   * itself opens on (pee diaper, bottle feed, ml medication, night sleep).
   */
  glyph: GlyphKind;
}

const ACTIONS: QuickAction[] = [
  { type: 'diaper', label: 'Diaper', glyph: 'diaperPee' },
  { type: 'feeding', label: 'Food', glyph: 'feedingBottle' },
  { type: 'medication', label: 'Medication', glyph: 'medMl' },
  { type: 'temperature', label: 'Temp', glyph: 'temperature' },
  { type: 'sleep', label: 'Sleep', glyph: 'night' },
  { type: 'tummyTime', label: 'Tummy', glyph: 'tummyTime' },
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
        return (
          <Pressable
            key={action.type}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={() => onAction(action.type)}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: disabled ? colors.neutral : colors.accent },
              pressed && !disabled && styles.pressed,
            ]}
          >
            <View style={styles.glyph}>
              <EntryGlyph
                kind={action.glyph}
                size={22}
                color={disabled ? colors.textMuted : colors.onAccent}
              />
            </View>
            <AppText
              size={fontSize.micro}
              weight="800"
              color={disabled ? colors.textMuted : colors.onAccent}
            >
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
    gap: spacing.md,
  },
  button: {
    // 3 per row: (100% - 2 gaps) / 3
    flexBasis: '31%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radii.control,
    paddingVertical: spacing.xl,
  },
  glyph: {
    height: 24,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
});
