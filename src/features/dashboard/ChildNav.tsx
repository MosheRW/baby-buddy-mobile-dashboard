import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '../../components';
import { colors, fontSize, radii, spacing } from '../../theme';
import type { Child, Entry, EntryType } from '../../api/types';
import type { MedStatus } from '../../lib/medication';
import { ChildCard } from './ChildCard';
import { SettingsButton } from './SettingsButton';

interface ChildNavProps {
  childList: Child[];
  entries: Entry[];
  activeIndex: number;
  onActiveChange: (index: number) => void;
  now: number;
  timerNow: number;
  onQuickAction: (childId: string, type: EntryType) => void;
  onOpenMedBreakdown: (child: Child) => void;
  onLogDose: (childId: string, status: MedStatus) => void;
  onOpenSettings: () => void;
}

// A deliberate swipe needs either this much horizontal travel or this much
// fling speed (px, px/s) — short enough to feel responsive, long enough that
// scrolling the feed below doesn't accidentally flip a child.
const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 800;

/**
 * Child navigation: a scrollable pill tab row above the active child's card,
 * swipeable left/right to switch. Identical for 2 children and for 20 — the
 * prototype's exchange-carousel/peek-strip layout below 3 children was a
 * second interaction pattern for no real benefit, so every count now gets the
 * tab-row treatment. A single child gets neither: there's nothing to switch to.
 */
export function ChildNav(props: ChildNavProps) {
  return props.childList.length > 1 ? <TabsNav {...props} /> : <SingleChildNav {...props} />;
}

function SingleChildNav({
  childList,
  entries,
  now,
  timerNow,
  onQuickAction,
  onOpenMedBreakdown,
  onLogDose,
  onOpenSettings,
}: ChildNavProps) {
  const child = childList[0];
  if (!child) return null;
  return (
    <ChildCard
      child={child}
      entries={entries}
      now={now}
      timerNow={timerNow}
      onQuickAction={(type) => onQuickAction(child.id, type)}
      onOpenMedBreakdown={() => onOpenMedBreakdown(child)}
      onLogDose={(status) => onLogDose(child.id, status)}
      onOpenSettings={onOpenSettings}
    />
  );
}

function TabsNav({
  childList,
  entries,
  activeIndex,
  onActiveChange,
  now,
  timerNow,
  onQuickAction,
  onOpenMedBreakdown,
  onLogDose,
  onOpenSettings,
}: ChildNavProps) {
  const { t } = useTranslation();
  const active = childList[activeIndex] ?? childList[0];
  const translateX = useSharedValue(0);

  const goTo = (index: number) => {
    if (index >= 0 && index < childList.length) onActiveChange(index);
  };

  // Horizontal drag follows the finger for feedback, then always snaps back to
  // 0 — the index change (if any) swaps the card contents instead of sliding
  // the view, so it works the same regardless of how many children flank the
  // active one.
  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      const swiped =
        Math.abs(e.translationX) > SWIPE_DISTANCE || Math.abs(e.velocityX) > SWIPE_VELOCITY;
      if (swiped) {
        runOnJS(goTo)(e.translationX < 0 ? activeIndex + 1 : activeIndex - 1);
      }
      translateX.value = withTiming(0, { duration: 180 });
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View>
      {/* Names live on their own pill row, so the cog sits on that same line,
          pinned to the right while the pills scroll under it. */}
      <View style={styles.tabsRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
          style={styles.tabsScroll}
        >
          {childList.map((child, i) => {
            const isActive = i === activeIndex;
            return (
              <Pressable
                key={child.id}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={t('dashboard.switchToChild', { name: child.name })}
                onPress={() => onActiveChange(i)}
                style={[styles.tab, isActive && styles.tabActive]}
              >
                <AppText
                  size={fontSize.bodySm}
                  weight="700"
                  color={isActive ? colors.onAccent : colors.textPrimary}
                >
                  {child.name}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
        <SettingsButton onPress={onOpenSettings} />
      </View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.tabCard, cardStyle]}>
          <ChildCard
            child={active}
            entries={entries}
            now={now}
            timerNow={timerNow}
            onQuickAction={(type) => onQuickAction(active.id, type)}
            onOpenMedBreakdown={() => onOpenMedBreakdown(active)}
            onLogDose={(status) => onLogDose(active.id, status)}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  tabsScroll: {
    flex: 1,
  },
  tabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tab: {
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing['2xl'],
    backgroundColor: colors.card,
  },
  tabActive: {
    backgroundColor: colors.accent,
  },
  tabCard: {
    marginTop: spacing.xs,
  },
});
