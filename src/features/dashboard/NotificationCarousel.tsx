import React, { useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, Card, CloseGlyph } from '../../components';
import { fontSize, radii, spacing, useTheme, useThemedStyles, type AppTheme } from '../../theme';
import type { Child } from '../../api/types';

/**
 * One card in the carousel. Two kinds share the pager so every dashboard alert —
 * an OS-delivered reminder and an app error — reads as one stack instead of a
 * reminder tray plus a separate red banner.
 *
 * - `reminder`: tappable only when `onPress` is set (the parent decides, from
 *   `notificationAction` + a known child); always dismissable.
 * - `error`: danger-accented. `onRetry` renders a Retry button (the reactive
 *   dashboard fetch error); `onDismiss` renders the ✕ (event errors like a
 *   failed save). The fetch-error card has a retry but no dismiss — it clears
 *   itself when a refetch succeeds, so a manual ✕ would just reappear.
 */
export type CarouselItem =
  | {
      kind: 'reminder';
      id: string;
      title: string;
      body: string;
      childId?: string;
      onPress?: () => void;
      onDismiss: () => void;
    }
  | {
      kind: 'error';
      id: string;
      title: string;
      body: string;
      childId?: string;
      onRetry?: () => void;
      onDismiss?: () => void;
    };

interface NotificationCarouselProps {
  items: CarouselItem[];
  childrenById: Record<string, Child>;
  /** Clears every *clearable* card at once (reminders + dismissable errors). */
  onClearAll: () => void;
}

// The dashboard scroll content is inset by 2xl on each side; a card fills that
// inner width so paging snaps cleanly one notification at a time.
const H_PADDING = spacing['2xl'];
const FALLBACK_WIDTH = Dimensions.get('window').width - H_PADDING * 2;

/**
 * A carousel of dashboard alerts — OS-delivered reminders (see
 * `useDeliveredNotifications`) and app errors (fetch failures via React Query,
 * save/delete failures via `appErrorStore`). Rendered above the child card, and
 * **hidden entirely when there's nothing to show** — the dashboard renders it
 * unconditionally and this returns `null` on an empty list.
 *
 * One card is shown per page with paging + a dot indicator, so a stack of alerts
 * never pushes the child card down the screen. The parent assembles the item
 * list and supplies each card's behaviour; this component is just the pager.
 */
export function NotificationCarousel({
  items,
  childrenById,
  onClearAll,
}: NotificationCarouselProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { colors } = theme;
  const styles = useThemedStyles(makeStyles);
  const [width, setWidth] = useState(FALLBACK_WIDTH);
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== width) setWidth(w);
  };

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== page) setPage(next);
  };

  // Keep the active dot valid when a dismissal shrinks the list past the
  // current page (e.g. dismissing the last card).
  const activePage = page < items.length ? page : Math.max(0, items.length - 1);

  const dots = useMemo(() => items.map((n) => n.id), [items]);

  // "Clear all" only makes sense when more than one card can actually be
  // cleared — a lone reactive fetch error isn't dismissable, so it shouldn't
  // offer the affordance.
  const clearableCount = items.filter(
    (n) => n.kind === 'reminder' || n.onDismiss != null,
  ).length;

  if (items.length === 0) return null;

  return (
    <View onLayout={onLayout}>
      <View style={styles.header}>
        <AppText size={fontSize.micro} weight="800" color={colors.textMuted}>
          {t('notifications.carouselHeading').toUpperCase()}
        </AppText>
        {clearableCount > 1 ? (
          <Pressable accessibilityRole="button" onPress={onClearAll} hitSlop={spacing.md}>
            <AppText size={fontSize.metaSm} weight="800" color={colors.accent}>
              {t('notifications.dismissAll')}
            </AppText>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        // A single card needn't scroll; disabling keeps it from rubber-banding.
        scrollEnabled={items.length > 1}
      >
        {items.map((n) => {
          const child = n.childId ? childrenById[n.childId] : undefined;
          return (
            <View key={n.id} style={{ width }}>
              {n.kind === 'error'
                ? renderErrorCard(n, child, t, theme, styles)
                : renderReminderCard(n, child, t, theme, styles)}
            </View>
          );
        })}
      </ScrollView>

      {items.length > 1 ? (
        <View style={styles.dots}>
          {dots.map((id, i) => (
            <View
              key={id}
              style={[styles.dot, i === activePage ? styles.dotActive : styles.dotInactive]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

type Translate = ReturnType<typeof useTranslation>['t'];
type Styles = ReturnType<typeof makeStyles>;

function ChildChip({ child }: { child: Child | undefined }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  if (!child) return null;
  return (
    <View style={styles.childChip}>
      <AppText size={fontSize.metaSm} weight="700" color={colors.textMuted}>
        {child.name}
      </AppText>
    </View>
  );
}

// `theme`/`styles` are threaded in rather than read from a hook because these
// are plain functions called from the render body, not components — the same
// reason `t` is already a parameter here.
function renderReminderCard(
  n: Extract<CarouselItem, { kind: 'reminder' }>,
  child: Child | undefined,
  t: Translate,
  { colors }: AppTheme,
  styles: Styles,
) {
  const tappable = !!n.onPress;
  return (
    // Styled to match the dashboard's inactive-days prompt: a flat cream card
    // (no shadow), control radius, and the same title/body type scale — so the
    // alerts read as one message component.
    <Card elevation="none" radius={radii.control} padding={spacing['2xl']} style={styles.card}>
      <Pressable
        accessibilityRole={tappable ? 'button' : undefined}
        disabled={!tappable}
        onPress={n.onPress}
        style={styles.body}
      >
        <AppText size={fontSize.bodySm} weight="800" numberOfLines={1}>
          {n.title}
        </AppText>
        <AppText
          size={fontSize.metaSm}
          weight="600"
          color={colors.textSecondary}
          numberOfLines={2}
        >
          {n.body}
        </AppText>
        <ChildChip child={child} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('notifications.dismissOne')}
        onPress={n.onDismiss}
        hitSlop={spacing.md}
        style={styles.dismiss}
      >
        <CloseGlyph size={16} color={colors.textMuted} />
      </Pressable>
    </Card>
  );
}

function renderErrorCard(
  n: Extract<CarouselItem, { kind: 'error' }>,
  child: Child | undefined,
  t: Translate,
  { colors }: AppTheme,
  styles: Styles,
) {
  return (
    <Card
      elevation="none"
      radius={radii.control}
      padding={spacing['2xl']}
      style={[styles.card, styles.errorCard]}
    >
      <View style={styles.body}>
        <AppText size={fontSize.bodySm} weight="800" color={colors.danger} numberOfLines={1}>
          {n.title}
        </AppText>
        <AppText
          size={fontSize.metaSm}
          weight="600"
          color={colors.textSecondary}
          numberOfLines={2}
        >
          {n.body}
        </AppText>
        <ChildChip child={child} />
        {n.onRetry ? (
          <Pressable
            accessibilityRole="button"
            onPress={n.onRetry}
            style={styles.retry}
          >
            <AppText size={fontSize.metaSm} weight="800" color={colors.onAccent}>
              {t('common.retry')}
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {n.onDismiss ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('errors.dismissOne')}
          onPress={n.onDismiss}
          hitSlop={spacing.md}
          style={styles.dismiss}
        >
          <CloseGlyph size={16} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </Card>
  );
}

const makeStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  // A danger left-edge marks the error variant apart from cream reminders while
  // reusing the same flat card shell. Width matches the ActivityFeed row accent
  // so the two left-edges read as one system.
  errorCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
  },
  body: {
    flex: 1,
    gap: spacing.xs,
  },
  childChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.neutral,
    borderRadius: radii.chipSmall,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    marginTop: spacing.xs,
  },
  retry: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderRadius: radii.chipSmall,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing['2xl'],
    marginTop: spacing.sm,
  },
  dismiss: {
    padding: spacing.xs,
    marginRight: -spacing.xs,
    marginTop: -spacing.xs,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: colors.accent,
  },
  dotInactive: {
    backgroundColor: colors.neutral,
  },
});
