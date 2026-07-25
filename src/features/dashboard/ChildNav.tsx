import React, { useEffect, useState } from 'react';
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
import { fontSize, radii, spacing, useTheme, useThemedStyles, type AppTheme } from '../../theme';
import type { Child, Entry, EntryType } from '../../api/types';
import type { MedStatus } from '../../lib/medication';
import { ChildCard } from './ChildCard';
import { SettingsButton } from './SettingsButton';

// Reanimated shared values (useSharedValue) are mutable refs; writing `.value`
// is their intended API, including from effects and layout callbacks. The
// React-Compiler immutability rule models them as frozen render values and flags
// every legitimate write, so it's disabled for this file — the only shared-value
// user in the app.
/* eslint-disable react-hooks/immutability */

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
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const active = childList[activeIndex] ?? childList[0];
  const translateX = useSharedValue(0);
  // Measured card width, so a committed swipe slides the card exactly one full
  // width off-screen rather than guessing a distance.
  const cardWidth = useSharedValue(0);

  // A committed swipe mounts the neighbour card off-screen and slides it in
  // alongside the outgoing one — so the card that arrives already shows the
  // neighbour, not a stale copy of the current child waiting to re-render. All
  // children are already in memory (React Query cache + the loaded list), so
  // the neighbour renders synchronously with no fetch.
  //
  // `phase` sequences the hand-off so the index swap never flashes the old
  // child: 'animating' (both cards sliding) → 'settling' (index switched, but
  // translateX still parks the freshly-swapped current card off-screen while the
  // already-centred neighbour overlay covers it) → back to idle. Only in the
  // settling effect — after the new current has rendered — is translateX reset
  // to 0 and the overlay removed, so the two are the same child at the same spot.
  const [incoming, setIncoming] = useState<{ index: number; dir: number } | null>(null);
  const [phase, setPhase] = useState<'idle' | 'animating' | 'settling'>('idle');

  const startTransition = (dir: number) => {
    if (phase !== 'idle') return; // one swipe at a time
    const n = childList.length;
    if (n < 2) return;
    // Wrap around: swiping past either end loops to the other side instead of
    // dead-ending, so the children form an endless carousel.
    const neighbour = (((activeIndex + dir) % n) + n) % n;
    setIncoming({ index: neighbour, dir });
    setPhase('animating');
  };

  // Animation done: switch the active child but hold translateX where it is, so
  // the re-rendered current card stays off-screen behind the centred overlay.
  const settle = (index: number) => {
    onActiveChange(index);
    setPhase('settling');
  };

  // Drive the slide once the neighbour overlay is mounted (phase 'animating').
  useEffect(() => {
    if (phase !== 'animating' || !incoming) return;
    const { dir, index } = incoming;
    const w = cardWidth.value || 320;
    translateX.value = withTiming(-dir * w, { duration: 220 }, (finished) => {
      if (finished) runOnJS(settle)(index);
    });
    // translateX / cardWidth are shared values (stable); depend on the phase and
    // the incoming payload only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, incoming]);

  // Post-commit: the new current child has now rendered (off-screen at -dir*w).
  // Snap translateX back to 0 to bring it to centre, then drop the overlay. Both
  // show the same child at the same position, so there's nothing to flash.
  useEffect(() => {
    if (phase !== 'settling') return;
    translateX.value = 0;
    // Stepping the state machine forward from an effect is the intended cascade
    // here — the render that dropped the overlay is exactly what we waited for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIncoming(null);
    setPhase('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Horizontal drag follows the finger for feedback; releasing either snaps back
  // (no commit) or hands off to the slide above.
  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      const distanceSwipe = Math.abs(e.translationX) > SWIPE_DISTANCE;
      const velocitySwipe = Math.abs(e.velocityX) > SWIPE_VELOCITY;
      if (!distanceSwipe && !velocitySwipe) {
        translateX.value = withTiming(0, { duration: 180 });
        return;
      }
      // Take the direction from whichever signal actually crossed its threshold,
      // not always from translationX: a fast fling can trip the velocity
      // threshold while translationX is tiny or has bounced to the opposite
      // sign, which would otherwise flip to the wrong child. Net finger travel
      // (distance) wins when both fired, since it best reflects the intent.
      const signal = distanceSwipe ? e.translationX : e.velocityX;
      const dir = signal < 0 ? 1 : -1; // 1 = next child, -1 = previous
      runOnJS(startTransition)(dir);
    });

  const currentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // The neighbour overlay tracks the same drag/anim offset, one card-width to
  // the side it enters from, so it eases to centre exactly as the current card
  // leaves.
  const incomingDir = incoming?.dir ?? 0;
  const incomingStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value + incomingDir * cardWidth.value }],
  }));

  const incomingChild = incoming ? childList[incoming.index] : undefined;

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
      <View style={styles.cardArea}>
        <GestureDetector gesture={pan}>
          <Animated.View
            style={currentStyle}
            onLayout={(e) => {
              cardWidth.value = e.nativeEvent.layout.width;
            }}
          >
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
        {incomingChild ? (
          <Animated.View style={[styles.overlay, incomingStyle]} pointerEvents="none">
            <ChildCard
              child={incomingChild}
              entries={entries}
              now={now}
              timerNow={timerNow}
              onQuickAction={(type) => onQuickAction(incomingChild.id, type)}
              onOpenMedBreakdown={() => onOpenMedBreakdown(incomingChild)}
              onLogDose={(status) => onLogDose(incomingChild.id, status)}
            />
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
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
    // Relative anchor for the card + the sliding neighbour overlay. Height is set
    // by the current (relative) card; the overlay is absolute so it can't stretch
    // the layout while it slides through.
    cardArea: {
      marginTop: spacing.xs,
      position: 'relative',
    },
    overlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
    },
  });
