import React from 'react';
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from '../../components';
import { colors, fontSize, radii, spacing } from '../../theme';
import type { Child, Entry, EntryType } from '../../api/types';
import { ChildCard } from './ChildCard';

const SCREEN_W = Dimensions.get('window').width;
const CARD_W = Math.min(320, SCREEN_W - spacing['2xl'] * 2 - 40);
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
}

/**
 * Adaptive child navigation: swipe carousel for ≤2 children, a scrollable pill
 * tab row for ≥3. Both wrap the same ChildCard.
 */
export function ChildNav(props: ChildNavProps) {
  return props.childList.length >= 3 ? <TabsNav {...props} /> : <CarouselNav {...props} />;
}

function CarouselNav({
  childList,
  entries,
  activeIndex,
  onActiveChange,
  foodWindowHours,
  now,
  timerNow,
  onQuickAction,
}: ChildNavProps) {
  const step = CARD_W + spacing.lg;
  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        contentContainerStyle={styles.carousel}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / step);
          onActiveChange(Math.max(0, Math.min(childList.length - 1, idx)));
        }}
      >
        {childList.map((child) => (
          <View key={child.id} style={{ width: CARD_W }}>
            <ChildCard
              child={child}
              entries={entries}
              foodWindowHours={foodWindowHours}
              now={now}
              timerNow={timerNow}
              onQuickAction={(type) => onQuickAction(child.id, type)}
            />
          </View>
        ))}
        {/* Peek sliver of the next card is implied by the snap step < screen width. */}
      </ScrollView>

      {childList.length > 1 ? (
        <View style={styles.dots}>
          {childList.map((child, i) => (
            <View
              key={child.id}
              style={[styles.dot, i === activeIndex && styles.dotActive]}
            />
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
}: ChildNavProps) {
  const active = childList[activeIndex] ?? childList[0];
  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
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
      <View style={styles.tabCard}>
        <ChildCard
          child={active}
          entries={entries}
          foodWindowHours={foodWindowHours}
          now={now}
          timerNow={timerNow}
          onQuickAction={(type) => onQuickAction(active.id, type)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carousel: {
    gap: spacing.lg,
    paddingRight: PEEK,
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
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.xl,
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
