import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, Card } from '../../components';
import { fontSize, radii, spacing, useTheme, type AppTheme } from '../../theme';
import { elapsedClock, type TimerType } from '../../lib/timers';
import { useTimerStore } from '../../stores';
import type { Child } from '../../api/types';

// A function of the theme rather than a module-scope map: at module scope the
// colours would freeze to whichever scheme was active at import time.
const typeDot = ({ colors, tints }: AppTheme): Record<TimerType, string> => ({
  feeding: tints.feeding.fg,
  sleep: colors.textSecondary,
  tummyTime: colors.textSecondary,
});

interface TimerStripProps {
  childrenById: Record<string, Child>;
  /** Advancing clock from the dashboard's 1s tick. */
  now: number;
  onPress: (childId: string, type: TimerType) => void;
}

/**
 * Horizontal strip of running-timer chips. Only rendered when ≥1 timer is
 * active. Each chip shows a colored dot, "Child · Type", and live mm:ss.
 */
export function TimerStrip({ childrenById, now, onPress }: TimerStripProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { colors } = theme;
  const dotColor = typeDot(theme);
  const timers = useTimerStore((s) => s.timers);
  if (timers.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
    >
      {timers.map((timer) => {
        const child = childrenById[timer.childId];
        const typeLabel = t(`timer.typeLabel.${timer.type}`);
        return (
          <Pressable
            key={`${timer.type}:${timer.childId}`}
            accessibilityRole="button"
            onPress={() => onPress(timer.childId, timer.type)}
          >
            <Card elevation="feedRow" radius={radii.pill} padding={spacing.md} style={styles.chip}>
              <View style={[styles.dot, { backgroundColor: dotColor[timer.type] }]} />
              <AppText size={fontSize.meta} weight="700">
                {child ? `${child.name} · ${typeLabel}` : typeLabel}
              </AppText>
              <AppText size={fontSize.meta} weight="800" color={colors.accent}>
                {elapsedClock(timer.startedAt, now)}
              </AppText>
            </Card>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingRight: spacing['2xl'],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
