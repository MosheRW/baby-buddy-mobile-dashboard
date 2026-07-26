import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ActionButton, AppText, Card, Chip, Stepper, ToggleSwitch } from '../../components';
import { ChevronLeftGlyph } from '../../components/glyphs';
import {
  accentColors,
  avatarTint,
  fontSize,
  spacing,
  useTheme,
  useThemedStyles,
  type AppTheme,
} from '../../theme';
import type { MainStackParamList } from '../../navigation/types';
import { useKidsStore } from '../../stores';
import { useDashboardData } from '../../data/queries';

type Props = NativeStackScreenProps<MainStackParamList, 'AdvancedSettings'>;

export function AdvancedSettingsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { scheme, colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { children } = useDashboardData();
  const defaultVisibility = useKidsStore((s) => s.defaultVisibility);
  const setDefaultVisibility = useKidsStore((s) => s.setDefaultVisibility);
  const groups = useKidsStore((s) => s.groups);
  const childGroupId = useKidsStore((s) => s.childGroupId);
  const hidden = useKidsStore((s) => s.hidden);
  const addGroup = useKidsStore((s) => s.addGroup);
  const shakeReveal = useKidsStore((s) => s.shakeReveal);
  const setShakeReveal = useKidsStore((s) => s.setShakeReveal);

  const groupList = Object.values(groups).sort((a, b) => a.order - b.order);
  const memberCount = (groupId: string) =>
    Object.values(childGroupId).filter((g) => g === groupId).length;

  const createGroup = () => {
    const id = addGroup(t('advanced.newGroupName'));
    navigation.navigate('GroupEditor', { groupId: id });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={() => navigation.goBack()}
          hitSlop={8}
        >
          <ChevronLeftGlyph size={24} color={colors.textPrimary} />
        </Pressable>
        <AppText size={fontSize.screenTitle} weight="800">
          {t('advanced.title')}
        </AppText>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.section}>
          <AppText size={fontSize.bodySm} weight="800">
            {t('settings.newChildren')}
          </AppText>
          <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
            {t('settings.newChildrenHint')}
          </AppText>
          <View style={styles.chipRow}>
            <Chip
              label={t('settings.visibilityVisible')}
              active={defaultVisibility === 'visible'}
              onPress={() => setDefaultVisibility('visible')}
            />
            <Chip
              label={t('settings.visibilityHidden')}
              active={defaultVisibility === 'hidden'}
              onPress={() => setDefaultVisibility('hidden')}
            />
          </View>
        </Card>

        <Card style={styles.section}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <AppText size={fontSize.bodySm} weight="800">
                {t('advanced.shakeTitle')}
              </AppText>
              <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
                {t('advanced.shakeHint')}
              </AppText>
            </View>
            <ToggleSwitch
              value={shakeReveal.enabled}
              onValueChange={(enabled) => setShakeReveal({ enabled })}
              accessibilityLabel={t('advanced.shakeTitle')}
            />
          </View>
          {shakeReveal.enabled ? (
            <View style={styles.durationRow}>
              <AppText size={fontSize.body} weight="700" style={styles.durationLabel}>
                {t('advanced.shakeDuration')}
              </AppText>
              <View style={styles.durationStepper}>
                <Stepper
                  value={shakeReveal.durationMinutes}
                  onChange={(minutes) => setShakeReveal({ durationMinutes: minutes })}
                  step={1}
                  min={1}
                  max={60}
                  suffix={t('advanced.shakeMinSuffix')}
                />
              </View>
            </View>
          ) : null}
        </Card>

        <Card style={styles.section}>
          <AppText size={fontSize.bodySm} weight="800">
            {t('advanced.groups')}
          </AppText>
          {groupList.length === 0 ? (
            <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
              {t('advanced.noGroups')}
            </AppText>
          ) : (
            groupList.map((group) => (
              <Pressable
                key={group.id}
                accessibilityRole="button"
                onPress={() => navigation.navigate('GroupEditor', { groupId: group.id })}
                style={styles.row}
              >
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        group.accentHue != null
                          ? accentColors(group.accentHue, scheme).name
                          : colors.neutral,
                    },
                  ]}
                />
                <AppText size={fontSize.body} weight="700" style={styles.rowLabel}>
                  {group.name}
                </AppText>
                <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
                  {t('advanced.groupMembers', { count: memberCount(group.id) })}
                </AppText>
                <View style={styles.chevron}>
                  <ChevronLeftGlyph size={18} color={colors.textMuted} />
                </View>
              </Pressable>
            ))
          )}
          <ActionButton label={t('advanced.addGroup')} variant="neutral" onPress={createGroup} />
        </Card>

        <Card style={styles.section}>
          <AppText size={fontSize.bodySm} weight="800">
            {t('advanced.kids')}
          </AppText>
          <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
            {t('advanced.kidsHint')}
          </AppText>
          {children.map((child) => {
            const tint = avatarTint(child.hue, scheme);
            return (
              <Pressable
                key={child.id}
                accessibilityRole="button"
                onPress={() => navigation.navigate('KidEditor', { childId: child.id })}
                style={styles.row}
              >
                <View style={[styles.avatar, { backgroundColor: tint.bg }]}>
                  <AppText size={fontSize.body} weight="800" color={tint.fg}>
                    {child.initial}
                  </AppText>
                </View>
                <AppText size={fontSize.body} weight="700" style={styles.rowLabel}>
                  {child.name}
                </AppText>
                {hidden[child.id] ? (
                  <AppText size={fontSize.metaSm} weight="700" color={colors.textMuted}>
                    {t('advanced.hiddenBadge')}
                  </AppText>
                ) : null}
                <View style={styles.chevron}>
                  <ChevronLeftGlyph size={18} color={colors.textMuted} />
                </View>
              </Pressable>
            );
          })}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      paddingHorizontal: spacing['2xl'],
      paddingTop: spacing.lg,
      paddingBottom: spacing.lg,
    },
    content: {
      padding: spacing['2xl'],
      gap: spacing['2xl'],
    },
    section: {
      gap: spacing.lg,
    },
    chipRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.lg,
    },
    toggleText: {
      flex: 1,
      gap: spacing.xs,
    },
    durationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    durationLabel: {
      flex: 1,
    },
    durationStepper: {
      width: 150,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
    },
    rowLabel: {
      flex: 1,
    },
    dot: {
      width: 22,
      height: 22,
      borderRadius: 11,
    },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chevron: {
      // The only chevron glyph points left; flip it to point into the sub-screen.
      transform: [{ rotate: '180deg' }],
    },
  });
