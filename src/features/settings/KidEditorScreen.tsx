import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { AppText, Card, Chip, ToggleSwitch } from '../../components';
import { ChevronLeftGlyph } from '../../components/glyphs';
import { fontSize, spacing, useTheme, useThemedStyles, type AppTheme } from '../../theme';
import { useDynamicAccentHue } from '../../theme/dynamicColor';
import type { MainStackParamList } from '../../navigation/types';
import { useKidsStore } from '../../stores';
import { useDashboardData } from '../../data/queries';
import { AccentPicker } from './AccentPicker';
import { ScheduleEditor } from './ScheduleEditor';

type Props = NativeStackScreenProps<MainStackParamList, 'KidEditor'>;

export function KidEditorScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { childId } = route.params;
  const { children } = useDashboardData();
  const child = children.find((c) => c.id === childId);
  const systemHue = useDynamicAccentHue();

  const hidden = useKidsStore((s) => s.hidden);
  const setHidden = useKidsStore((s) => s.setHidden);
  const childAccent = useKidsStore((s) => s.childAccent);
  const setChildAccent = useKidsStore((s) => s.setChildAccent);
  const childGroupId = useKidsStore((s) => s.childGroupId);
  const setChildGroup = useKidsStore((s) => s.setChildGroup);
  const childSchedule = useKidsStore((s) => s.childSchedule);
  const setChildSchedule = useKidsStore((s) => s.setChildSchedule);
  const groups = useKidsStore((s) => s.groups);

  const groupList = Object.values(groups).sort((a, b) => a.order - b.order);
  const currentGroup = childGroupId[childId] ?? null;

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
          {child?.name ?? t('advanced.kids')}
        </AppText>
      </View>

      {child ? (
        <ScrollView contentContainerStyle={styles.content}>
          <Card style={styles.section}>
            <View style={styles.toggleRow}>
              <AppText size={fontSize.body} weight="700">
                {t('advanced.kidVisibility')}
              </AppText>
              <ToggleSwitch
                value={!hidden[childId]}
                onValueChange={(visible) => setHidden(childId, !visible)}
                accessibilityLabel={t('settings.visibilityToggle', { name: child.name })}
              />
            </View>
          </Card>

          <Card style={styles.section}>
            <AppText size={fontSize.bodySm} weight="800">
              {t('advanced.accentColor')}
            </AppText>
            <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
              {t('advanced.accentKidHint')}
            </AppText>
            <AccentPicker
              value={childAccent[childId] ?? null}
              onChange={(hue) => setChildAccent(childId, hue)}
              autoLabel={t('advanced.accentAuto')}
              dynamicHue={Platform.OS === 'android' ? systemHue : undefined}
              dynamicLabel={t('advanced.accentMatchPhone')}
            />
          </Card>

          <Card style={styles.section}>
            <AppText size={fontSize.bodySm} weight="800">
              {t('advanced.group')}
            </AppText>
            <View style={styles.chipWrap}>
              <Chip
                label={t('advanced.groupNone')}
                active={currentGroup == null}
                onPress={() => setChildGroup(childId, null)}
              />
              {groupList.map((group) => (
                <Chip
                  key={group.id}
                  label={group.name}
                  active={currentGroup === group.id}
                  onPress={() => setChildGroup(childId, group.id)}
                />
              ))}
            </View>
          </Card>

          <Card style={styles.section}>
            <ScheduleEditor
              value={childSchedule[childId] ?? null}
              onChange={(schedule) => setChildSchedule(childId, schedule)}
            />
          </Card>
        </ScrollView>
      ) : null}
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
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.lg,
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
  });
