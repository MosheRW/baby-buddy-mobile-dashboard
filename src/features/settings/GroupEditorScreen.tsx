import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ActionButton, AppText, Card, TextField, ToggleSwitch } from '../../components';
import { ChevronLeftGlyph } from '../../components/glyphs';
import {
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
import { AccentPicker } from './AccentPicker';
import { ScheduleEditor } from './ScheduleEditor';

type Props = NativeStackScreenProps<MainStackParamList, 'GroupEditor'>;

export function GroupEditorScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { scheme, colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { groupId } = route.params;
  const { children } = useDashboardData();

  const group = useKidsStore((s) => s.groups[groupId]);
  const childGroupId = useKidsStore((s) => s.childGroupId);
  const renameGroup = useKidsStore((s) => s.renameGroup);
  const setGroupAccent = useKidsStore((s) => s.setGroupAccent);
  const setGroupHidden = useKidsStore((s) => s.setGroupHidden);
  const setGroupSchedule = useKidsStore((s) => s.setGroupSchedule);
  const setChildGroup = useKidsStore((s) => s.setChildGroup);
  const removeGroup = useKidsStore((s) => s.removeGroup);

  const deleteGroup = () => {
    removeGroup(groupId);
    navigation.goBack();
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
          {group?.name ?? t('advanced.groups')}
        </AppText>
      </View>

      {group ? (
        <ScrollView contentContainerStyle={styles.content}>
          <Card style={styles.section}>
            <TextField
              label={t('advanced.groupName')}
              value={group.name}
              onChangeText={(text) => renameGroup(groupId, text)}
              placeholder={t('advanced.newGroupName')}
            />
          </Card>

          <Card style={styles.section}>
            <AppText size={fontSize.bodySm} weight="800">
              {t('advanced.accentColor')}
            </AppText>
            <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
              {t('advanced.accentGroupHint')}
            </AppText>
            <AccentPicker
              value={group.accentHue ?? null}
              onChange={(hue) => setGroupAccent(groupId, hue)}
              autoLabel={t('advanced.accentAuto')}
            />
          </Card>

          <Card style={styles.section}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleText}>
                <AppText size={fontSize.body} weight="700">
                  {t('advanced.groupHidden')}
                </AppText>
                <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
                  {t('advanced.groupHiddenHint')}
                </AppText>
              </View>
              <ToggleSwitch
                value={group.hidden ?? false}
                onValueChange={(value) => setGroupHidden(groupId, value)}
                accessibilityLabel={t('advanced.groupHidden')}
              />
            </View>
          </Card>

          <Card style={styles.section}>
            <AppText size={fontSize.bodySm} weight="800">
              {t('advanced.members')}
            </AppText>
            {children.map((child) => {
              const tint = avatarTint(child.hue, scheme);
              const inGroup = childGroupId[child.id] === groupId;
              return (
                <View key={child.id} style={styles.memberRow}>
                  <View style={[styles.avatar, { backgroundColor: tint.bg }]}>
                    <AppText size={fontSize.body} weight="800" color={tint.fg}>
                      {child.initial}
                    </AppText>
                  </View>
                  <AppText size={fontSize.body} weight="700" style={styles.memberName}>
                    {child.name}
                  </AppText>
                  <ToggleSwitch
                    value={inGroup}
                    onValueChange={(on) => setChildGroup(child.id, on ? groupId : null)}
                    accessibilityLabel={t('advanced.memberToggle', { name: child.name })}
                  />
                </View>
              );
            })}
          </Card>

          <Card style={styles.section}>
            <ScheduleEditor
              value={group.schedule ?? null}
              onChange={(schedule) => setGroupSchedule(groupId, schedule)}
            />
          </Card>

          <ActionButton
            label={t('advanced.deleteGroup')}
            variant="danger"
            fullWidth
            onPress={deleteGroup}
          />
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
    toggleText: {
      flex: 1,
      gap: spacing.xs,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
    },
    memberName: {
      flex: 1,
    },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
