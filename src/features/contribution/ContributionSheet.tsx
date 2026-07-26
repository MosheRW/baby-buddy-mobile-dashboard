import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ActionButton, AppText } from '../../components';
import { fontSize, radii, spacing, useTheme, useThemedStyles, type AppTheme } from '../../theme';
import type { MainStackParamList } from '../../navigation/types';
import { useDashboardData } from '../../data/queries';
import { useAuthStore, useKidsStore } from '../../stores';
import {
  computeContribution,
  computeGroupContributions,
  entriesForChildren,
  SUMMARY_WINDOW_DAYS,
} from '../../lib/contribution';
import { entryTint, entryTypeLabel } from '../../lib/entryDisplay';
import { hiddenCount, visibleChildren } from '../../lib/visibility';

type Props = NativeStackScreenProps<MainStackParamList, 'Contribution'>;

/**
 * The weekly caregiver-contribution recap, on demand.
 *
 * Same numbers the weekly notification would deliver — `computeContribution` is
 * the single source — but rendered with the room a notification line doesn't
 * have: an overall share, a per-category split, and a per-group split.
 *
 * Scope matches the dashboard: hidden children (and children in hidden groups)
 * are excluded, so the recap only covers what the caregiver actually watches.
 * Reveal ("show hidden") deliberately doesn't widen it — a temporary peek isn't
 * a change of scope, and the notification computes it the same way.
 */
export function ContributionSheet({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { children, entries } = useDashboardData();
  const me = useAuthStore((s) => s.session?.userName) ?? '';

  const hidden = useKidsStore((s) => s.hidden);
  const childGroupId = useKidsStore((s) => s.childGroupId);
  const groups = useKidsStore((s) => s.groups);
  const childSchedule = useKidsStore((s) => s.childSchedule);
  const visibilityState = { hidden, childGroupId, groups, childSchedule };

  // Read once per open (lazy initializer, never updated): a sheet that re-tallied
  // on a tick would make the number the user is reading move under them.
  const [now] = React.useState(() => Date.now());

  const visible = visibleChildren(children, visibilityState, now, false);
  const scoped = entriesForChildren(entries, visible.map((c) => c.id));
  const summary = computeContribution(scoped, me, now);
  const buckets = computeGroupContributions(scoped, visible, visibilityState, me, now);
  const hiddenKids = hiddenCount(children, visibilityState, now);

  const solo = summary.caregivers <= 1;
  const close = () => navigation.goBack();

  return (
    <View style={styles.root}>
      <Animated.View entering={FadeIn} exiting={FadeOut} style={StyleSheet.absoluteFill}>
        <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.dismiss')}
          style={[StyleSheet.absoluteFill, styles.scrim]}
          onPress={close}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown} style={styles.sheetWrap}>
        <SafeAreaView edges={['bottom']}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <AppText size={fontSize.cardTitle} weight="800">
              {t('contribution.title')}
            </AppText>
            <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
              {t('contribution.window', { days: SUMMARY_WINDOW_DAYS })}
            </AppText>

            {me.length === 0 ? (
              <AppText
                size={fontSize.bodySm}
                weight="600"
                color={colors.textMuted}
                style={styles.empty}
              >
                {t('contribution.noUser')}
              </AppText>
            ) : summary.allTotal === 0 ? (
              <AppText
                size={fontSize.bodySm}
                weight="600"
                color={colors.textMuted}
                style={styles.empty}
              >
                {t('contribution.empty', { days: SUMMARY_WINDOW_DAYS })}
              </AppText>
            ) : (
              <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
                <View style={styles.headline}>
                  <AppText size={fontSize.metaSm} weight="700" color={colors.textSecondary}>
                    {t('contribution.youLogged')}
                  </AppText>
                  <AppText size={fontSize.screenTitle} weight="800" color={colors.accent}>
                    {summary.myTotal}
                  </AppText>
                  <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
                    {solo
                      ? t('contribution.soloCaption')
                      : t('contribution.shareCaption', {
                          total: summary.allTotal,
                          share: Math.round(summary.overallShare * 100),
                        })}
                  </AppText>
                  {solo ? null : (
                    <ShareBar ratio={summary.overallShare} color={colors.accent} />
                  )}
                </View>

                <AppText size={fontSize.metaSm} weight="700" color={colors.textSecondary}>
                  {t('contribution.byCategory')}
                </AppText>
                {summary.categories.map((c) => (
                  <ContributionRow
                    key={c.type}
                    label={entryTypeLabel(c.type)}
                    mine={c.mine}
                    total={c.total}
                    solo={solo}
                    color={entryTint(c.type).fg}
                  />
                ))}

                {buckets.length > 1 ? (
                  <>
                    <AppText size={fontSize.metaSm} weight="700" color={colors.textSecondary}>
                      {t('contribution.byGroup')}
                    </AppText>
                    {buckets.map((b) => (
                      <ContributionRow
                        key={b.id}
                        label={b.label}
                        mine={b.summary.myTotal}
                        total={b.summary.allTotal}
                        solo={solo}
                        color={colors.accent}
                      />
                    ))}
                  </>
                ) : null}

                {hiddenKids > 0 ? (
                  <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
                    {t('contribution.hiddenNote', { count: hiddenKids })}
                  </AppText>
                ) : null}
              </ScrollView>
            )}

            <ActionButton label={t('common.close')} variant="neutral" onPress={close} />
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

/** One "mine of total" line with a proportional bar. */
function ContributionRow({
  label,
  mine,
  total,
  solo,
  color,
}: {
  label: string;
  mine: number;
  total: number;
  solo: boolean;
  color: string;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <AppText size={fontSize.bodySm} weight="700" style={styles.rowLabel}>
          {label}
        </AppText>
        <AppText size={fontSize.bodySm} weight="800">
          {solo ? `${mine}` : `${mine}/${total}`}
        </AppText>
      </View>
      <ShareBar ratio={total > 0 ? mine / total : 0} color={color} />
    </View>
  );
}

/** Track + fill; `ratio` is clamped to 0..1. */
function ShareBar({ ratio, color }: { ratio: number; color: string }) {
  const styles = useThemedStyles(makeStyles);
  const pct = `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%` as const;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: pct, backgroundColor: color }]} />
    </View>
  );
}

const makeStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    scrim: {
      backgroundColor: colors.scrim,
    },
    sheetWrap: {
      width: '100%',
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: radii.card,
      borderTopRightRadius: radii.card,
      paddingHorizontal: spacing['5xl'],
      paddingTop: spacing.lg,
      paddingBottom: spacing['5xl'],
      gap: spacing.lg,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.neutral,
      alignSelf: 'center',
      marginBottom: spacing.sm,
    },
    empty: {
      paddingVertical: spacing['4xl'],
      textAlign: 'center',
    },
    body: {
      // Long breakdowns scroll inside the sheet rather than pushing Close off.
      maxHeight: 360,
    },
    bodyContent: {
      gap: spacing.md,
    },
    headline: {
      backgroundColor: colors.background,
      borderRadius: radii.tile,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xl,
      gap: spacing.xs,
    },
    row: {
      gap: spacing.sm,
    },
    rowHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    rowLabel: {
      flex: 1,
    },
    track: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.neutral,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: 3,
    },
  });
