import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from '../../components';
import { colors, fontSize, radii, shadows, spacing, tints } from '../../theme';
import type { Child, Entry, EntryType } from '../../api/types';
import type { MedStatus } from '../../lib/medication';
import { ChildCard } from './ChildCard';
import { SettingsButton } from './SettingsButton';

// Width of the vertical "peek" strip that stands in for the inactive child.
const PEEK = 40;

interface ChildNavProps {
  childList: Child[];
  entries: Entry[];
  activeIndex: number;
  onActiveChange: (index: number) => void;
  foodWindowHours: number;
  now: number;
  timerNow: number;
  onQuickAction: (childId: string, type: EntryType) => void;
  onOpenMedBreakdown: (child: Child) => void;
  onLogDose: (childId: string, status: MedStatus) => void;
  onOpenSettings: () => void;
}

/**
 * Adaptive child navigation: an exchange carousel for ≤2 children, a scrollable
 * pill tab row for ≥3. Both wrap the same ChildCard.
 */
export function ChildNav(props: ChildNavProps) {
  return props.childList.length >= 3 ? <TabsNav {...props} /> : <CarouselNav {...props} />;
}

/**
 * ≤2 children: one active card at full width, with a slim vertical "peek" strip
 * on its right edge carrying the *other* child's name. There is no swiping —
 * tapping the strip (or a dot) exchanges which child is active in place, exactly
 * as the prototype does. A single child gets neither strip nor dots.
 */
function CarouselNav({
  childList,
  entries,
  activeIndex,
  onActiveChange,
  foodWindowHours,
  now,
  timerNow,
  onQuickAction,
  onOpenMedBreakdown,
  onLogDose,
  onOpenSettings,
}: ChildNavProps) {
  const active = childList[activeIndex] ?? childList[0];
  const hasPeek = childList.length > 1;
  const nextIndex = (activeIndex + 1) % childList.length;
  const peekChild = childList[nextIndex];

  return (
    <View>
      <View style={styles.exchangeRow}>
        <View style={styles.activeCard}>
          <ChildCard
            child={active}
            entries={entries}
            foodWindowHours={foodWindowHours}
            now={now}
            timerNow={timerNow}
            onQuickAction={(type) => onQuickAction(active.id, type)}
            onOpenMedBreakdown={() => onOpenMedBreakdown(active)}
            onLogDose={(status) => onLogDose(active.id, status)}
            // ≤2 children: the cog floats inline with the name in the card
            // header. (≥3 renders it in the tab row instead — see TabsNav.)
            onOpenSettings={onOpenSettings}
          />
        </View>

        {hasPeek && peekChild ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${peekChild.name}`}
            onPress={() => onActiveChange(nextIndex)}
            style={styles.peek}
          >
            {/* Rotated so the name reads top-to-bottom. numberOfLines + a fixed
                width keep it from wrapping inside the narrow strip; the rotation
                is visual only, so the box re-centers within the strip. */}
            <AppText
              numberOfLines={1}
              size={fontSize.meta}
              weight="800"
              color={tints.feeding.fg}
              style={styles.peekLabel}
            >
              {peekChild.name}
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {hasPeek ? (
        <View style={styles.dots}>
          {childList.map((child, i) => (
            <Pressable
              key={child.id}
              accessibilityRole="button"
              accessibilityLabel={`Show ${child.name}`}
              onPress={() => onActiveChange(i)}
              hitSlop={spacing.md}
            >
              <View style={[styles.dot, i === activeIndex && styles.dotActive]} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function TabsNav({
  childList,
  entries,
  activeIndex,
  onActiveChange,
  foodWindowHours,
  now,
  timerNow,
  onQuickAction,
  onOpenMedBreakdown,
  onLogDose,
  onOpenSettings,
}: ChildNavProps) {
  const active = childList[activeIndex] ?? childList[0];
  return (
    <View>
      {/* ≥3 children: names live on their own pill row, so the cog sits on that
          same line, pinned to the right while the pills scroll under it. */}
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
              <View
                key={child.id}
                style={[styles.tab, isActive && styles.tabActive]}
                onTouchEnd={() => onActiveChange(i)}
              >
                <AppText
                  size={fontSize.bodySm}
                  weight="700"
                  color={isActive ? colors.onAccent : colors.textPrimary}
                >
                  {child.name}
                </AppText>
              </View>
            );
          })}
        </ScrollView>
        <SettingsButton onPress={onOpenSettings} />
      </View>
      <View style={styles.tabCard}>
        <ChildCard
          child={active}
          entries={entries}
          foodWindowHours={foodWindowHours}
          now={now}
          timerNow={timerNow}
          onQuickAction={(type) => onQuickAction(active.id, type)}
          onOpenMedBreakdown={() => onOpenMedBreakdown(active)}
          onLogDose={(status) => onLogDose(active.id, status)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  exchangeRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.lg,
  },
  activeCard: {
    flex: 1,
  },
  peek: {
    width: PEEK,
    borderTopLeftRadius: radii.card,
    borderBottomLeftRadius: radii.card,
    borderTopRightRadius: radii.iconButton,
    borderBottomRightRadius: radii.iconButton,
    backgroundColor: colors.card,
    opacity: 0.55,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  peekLabel: {
    // Overshoot the strip width so a longer name doesn't truncate; the rotation
    // re-centers the box, so the extra width is never visible.
    width: 160,
    textAlign: 'center',
    transform: [{ rotate: '90deg' }],
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.neutral,
  },
  dotActive: {
    backgroundColor: colors.accent,
  },
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
