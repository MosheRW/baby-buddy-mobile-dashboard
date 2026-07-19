import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActionButton, AppText, Card, Chip, Stepper } from '../../components';
import { ChevronLeftGlyph } from '../../components/glyphs';
import { avatarTint, colors, fontSize, spacing } from '../../theme';
import type { MainStackParamList } from '../../navigation/types';
import { useAuthStore, useSettingsStore } from '../../stores';
import { useDashboardData } from '../../data/queries';

const FOOD_WINDOWS = [2, 4, 6, 12];

type Props = NativeStackScreenProps<MainStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);
  const { children } = useDashboardData();
  const foodWindow = useSettingsStore((s) => s.foodWindowHours);
  const setFoodWindow = useSettingsStore((s) => s.setFoodWindowHours);
  const defaults = useSettingsStore((s) => s.defaultFoodMl);
  const setDefaultFoodMl = useSettingsStore((s) => s.setDefaultFoodMl);

  const defaultMl = (id: string, fallback: number) => defaults[id] ?? fallback;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          hitSlop={8}
        >
          <ChevronLeftGlyph size={24} />
        </Pressable>
        <AppText size={fontSize.screenTitle} weight="800">
          Settings
        </AppText>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.section}>
          <AppText size={fontSize.bodySm} weight="800">
            Feeding window
          </AppText>
          <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
            Controls the dashboard&apos;s food-total window.
          </AppText>
          <View style={styles.windowRow}>
            {FOOD_WINDOWS.map((h) => (
              <Chip
                key={h}
                label={`${h}h`}
                active={foodWindow === h}
                onPress={() => setFoodWindow(h)}
              />
            ))}
          </View>
        </Card>

        <Card style={styles.section}>
          <AppText size={fontSize.bodySm} weight="800">
            Children &amp; default food quantity
          </AppText>
          {children.map((child) => {
            const tint = avatarTint(child.hue);
            return (
              <View key={child.id} style={styles.childRow}>
                <View style={styles.childInfo}>
                  <View style={[styles.avatar, { backgroundColor: tint.bg }]}>
                    <AppText size={fontSize.body} weight="800" color={tint.fg}>
                      {child.initial}
                    </AppText>
                  </View>
                  <AppText size={fontSize.body} weight="700">
                    {child.name}
                  </AppText>
                </View>
                <View style={styles.stepperWrap}>
                  <Stepper
                    value={defaultMl(child.id, child.defaultFoodMl)}
                    onChange={(v) => setDefaultFoodMl(child.id, v)}
                    step={10}
                    min={0}
                    suffix=" ml"
                  />
                </View>
              </View>
            );
          })}
        </Card>

        <Card style={styles.section}>
          <AppText size={fontSize.bodySm} weight="800">
            Baby Buddy server
          </AppText>
          <AppText size={fontSize.bodySm} weight="600" color={colors.textMuted}>
            {session?.baseUrl ?? '—'}
          </AppText>
        </Card>

        <ActionButton
          label="Log out"
          variant="danger"
          fullWidth
          onPress={() => {
            signOut();
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  windowRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  childInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperWrap: {
    width: 150,
  },
});
