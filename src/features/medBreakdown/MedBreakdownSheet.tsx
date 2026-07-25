import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ActionButton, AppText } from '../../components';
import { EntryGlyph } from '../../components/glyphs/entryGlyphs';
import { fontSize, radii, spacing, useTheme, useThemedStyles, type AppTheme } from '../../theme';
import type { MainStackParamList } from '../../navigation/types';
import { useDashboardData } from '../../data/queries';
import { formatDose, medBreakdown24h, type MedBreakdownRow } from '../../lib/medication';
import { medGlyphKind } from '../../lib/entryDisplay';
import { entriesForChild } from '../dashboard/selectors';

type Props = NativeStackScreenProps<MainStackParamList, 'MedBreakdown'>;

/**
 * Everything this child has been given in the last 24 hours, one row per
 * medicine, with the remaining headroom where a limit exists.
 *
 * Deliberately no cross-medication total: the prototype sums one, but it can
 * only do that because its demo data is all ml. Real rows carry their own
 * units, and "7 mg + 2 ml = 9" is a number that means nothing.
 */
export function MedBreakdownSheet({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { childId, childName } = route.params;
  const { entries } = useDashboardData();
  const rows = medBreakdown24h(entriesForChild(entries, childId));

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
              {t('med.breakdownTitle')}
            </AppText>
            <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
              {childName}
            </AppText>

            {rows.length === 0 ? (
              <AppText
                size={fontSize.bodySm}
                weight="600"
                color={colors.textMuted}
                style={styles.empty}
              >
                {t('med.breakdownEmpty')}
              </AppText>
            ) : (
              <ScrollView style={styles.rows} contentContainerStyle={styles.rowsContent}>
                {rows.map((row) => (
                  <BreakdownRow key={`${row.childId}:${row.name}`} row={row} />
                ))}
              </ScrollView>
            )}

            <ActionButton label={t('common.close')} variant="neutral" onPress={close} />
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

function BreakdownRow({ row }: { row: MedBreakdownRow }) {
  const { t } = useTranslation();
  const { colors, tints } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const limited = row.limit != null;
  const fg = row.atLimit ? colors.danger : colors.textPrimary;

  const detail = limited
    ? row.atLimit
      ? t('med.maxReached')
      : t('med.stillAvailable', { amount: formatDose(row.remaining as number, row.unit) })
    : t('med.noLimit');

  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <EntryGlyph kind={medGlyphKind(row.unit)} size={14} color={tints.eligible.fg} />
      </View>
      <View style={styles.rowText}>
        <AppText size={fontSize.bodySm} weight="700">
          {row.name}
        </AppText>
        <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
          {t('med.doses', { count: row.doses })}
          {detail}
        </AppText>
      </View>
      <AppText size={fontSize.bodySm} weight="800" color={fg}>
        {formatDose(row.taken, row.unit)}
        {limited ? ` / ${formatDose(row.limit as number, row.unit)}` : ''}
      </AppText>
    </View>
  );
}

const makeStyles = ({ colors, tints }: AppTheme) =>
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
    rows: {
      // Long lists scroll inside the sheet rather than pushing Close off-screen.
      maxHeight: 300,
    },
    rowsContent: {
      gap: spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      backgroundColor: colors.background,
      borderRadius: radii.tile,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xl,
    },
    rowIcon: {
      width: 26,
      height: 26,
      borderRadius: radii.chipSmall,
      backgroundColor: tints.eligible.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowText: {
      flex: 1,
    },
  });
