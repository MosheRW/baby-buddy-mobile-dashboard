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
import { colors, fontSize, radii, spacing } from '../../theme';
import type { Child } from '../../api/types';
import { notificationAction } from '../../lib/notifications';
import type { DeliveredNotification } from '../../hooks/useDeliveredNotifications';

interface NotificationCarouselProps {
  items: DeliveredNotification[];
  childrenById: Record<string, Child>;
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  /** Tap a card to open the relevant screen (see `notificationAction`). */
  onPress: (item: DeliveredNotification) => void;
}

// The dashboard scroll content is inset by 2xl on each side; a card fills that
// inner width so paging snaps cleanly one notification at a time.
const H_PADDING = spacing['2xl'];
const FALLBACK_WIDTH = Dimensions.get('window').width - H_PADDING * 2;

/**
 * A carousel of reminders the OS has already delivered (see
 * `useDeliveredNotifications`). Rendered above the child card, and **hidden
 * entirely when there's nothing to show** — the dashboard renders it
 * unconditionally and this returns `null` on an empty list.
 *
 * One notification is shown per page with paging + a dot indicator, so a stack
 * of reminders never pushes the child card down the screen. Tapping a card
 * focuses the child it's about; the ✕ dismisses it from the tray.
 */
export function NotificationCarousel({
  items,
  childrenById,
  onDismiss,
  onDismissAll,
  onPress,
}: NotificationCarouselProps) {
  const { t } = useTranslation();
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

  if (items.length === 0) return null;

  return (
    <View onLayout={onLayout}>
      <View style={styles.header}>
        <AppText size={fontSize.micro} weight="800" color={colors.textMuted}>
          {t('notifications.carouselHeading').toUpperCase()}
        </AppText>
        {items.length > 1 ? (
          <Pressable
            accessibilityRole="button"
            onPress={onDismissAll}
            hitSlop={spacing.md}
          >
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
          // Tappable only when the key maps to a screen we can open — a weekly
          // recap or an unrecognised reminder is a read-only card.
          const tappable = notificationAction(n.id).kind !== 'none';
          return (
            <View key={n.id} style={{ width }}>
              <Card
                elevation="feedRow"
                radius={radii.feedRow}
                padding={spacing['2xl']}
                style={styles.card}
              >
                <Pressable
                  accessibilityRole={tappable ? 'button' : undefined}
                  disabled={!tappable}
                  onPress={tappable ? () => onPress(n) : undefined}
                  style={styles.body}
                >
                  <AppText size={fontSize.body} weight="800" numberOfLines={1}>
                    {n.title}
                  </AppText>
                  <AppText
                    size={fontSize.bodySm}
                    weight="600"
                    color={colors.textSecondary}
                    numberOfLines={2}
                  >
                    {n.body}
                  </AppText>
                  {child ? (
                    <View style={styles.childChip}>
                      <AppText size={fontSize.metaSm} weight="700" color={colors.textMuted}>
                        {child.name}
                      </AppText>
                    </View>
                  ) : null}
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('notifications.dismissOne')}
                  onPress={() => onDismiss(n.id)}
                  hitSlop={spacing.md}
                  style={styles.dismiss}
                >
                  <CloseGlyph size={16} color={colors.textMuted} />
                </Pressable>
              </Card>
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

const styles = StyleSheet.create({
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
