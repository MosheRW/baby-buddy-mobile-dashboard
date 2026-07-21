import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ActionButton, AppText } from '../../components';
import { colors, fontSize, radii, spacing } from '../../theme';
import type { MainStackParamList } from '../../navigation/types';
import { useDeleteEntry } from '../../data/queries';
import { errorMessage } from '../../api/client';

type Props = NativeStackScreenProps<MainStackParamList, 'DeleteConfirm'>;

/**
 * Bottom-sheet delete confirmation over a dimmed, blurred scrim. Presented as a
 * transparent modal in the stack. All entry deletions route through here.
 */
export function DeleteConfirmSheet({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { entryId, entryLabel } = route.params;

  const close = () => navigation.goBack();
  const deleteEntry = useDeleteEntry();

  const confirm = () => {
    deleteEntry.mutate(entryId, { onSuccess: close });
  };

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
            <AppText size={fontSize.cardTitle} weight="800" style={styles.title}>
              {t('deleteSheet.title')}
            </AppText>
            <AppText
              size={fontSize.bodySm}
              weight="600"
              color={colors.textSecondary}
              style={styles.body}
            >
              {t('deleteSheet.body', { label: entryLabel })}
            </AppText>
            {deleteEntry.isError ? (
              <AppText size={fontSize.metaSm} weight="700" color={colors.danger} style={styles.body}>
                {errorMessage(deleteEntry.error)}
              </AppText>
            ) : null}
            <View style={styles.actions}>
              <ActionButton
                label={t('common.cancel')}
                variant="neutral"
                flex={1}
                disabled={deleteEntry.isPending}
                onPress={close}
              />
              <ActionButton
                label={deleteEntry.isPending ? t('common.deleting') : t('common.delete')}
                variant="danger"
                flex={1}
                disabled={deleteEntry.isPending}
                onPress={confirm}
              />
            </View>
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    backgroundColor: 'rgba(0,0,0,0.4)',
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
  title: {
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
});
