import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../../components';
import {
  BottleGlyph,
  CapsuleGlyph,
  DiaperGlyph,
  MoonGlyph,
  ThermometerGlyph,
  TummyGlyph,
} from '../../components/glyphs';
import { colors, fontSize, radii, spacing } from '../../theme';
import type { EntryType } from '../../api/types';

interface QuickAction {
  type: EntryType;
  label: string;
  glyph: React.ReactNode;
}

const GLYPH_COLOR = colors.onAccent;

const ACTIONS: QuickAction[] = [
  { type: 'diaper', label: 'Diaper', glyph: <DiaperGlyph size={22} color={GLYPH_COLOR} /> },
  { type: 'feeding', label: 'Food', glyph: <BottleGlyph size={22} color={GLYPH_COLOR} /> },
  { type: 'medication', label: 'Medication', glyph: <CapsuleGlyph size={22} color={GLYPH_COLOR} /> },
  { type: 'temperature', label: 'Temp', glyph: <ThermometerGlyph size={22} color={GLYPH_COLOR} /> },
  { type: 'sleep', label: 'Sleep', glyph: <MoonGlyph size={22} color={GLYPH_COLOR} /> },
  { type: 'tummyTime', label: 'Tummy', glyph: <TummyGlyph size={22} color={GLYPH_COLOR} /> },
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
            <View style={styles.glyph}>{action.glyph}</View>
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
