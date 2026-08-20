import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ActionButton, AppText } from '../../components';
import { ChevronLeftGlyph } from '../../components/glyphs';
import { fontSize, spacing, useTheme, useThemedStyles, type AppTheme } from '../../theme';
import type { MainStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores';
import { signInWithPassword, signInWithToken } from '../../api/auth';
import { errorMessage } from '../../api/client';
import { InvalidJoinError, parseJoin } from '../../lib/joinCode';

/**
 * Scan-to-login (Issue #34). Reads a join QR and signs in with no typing — the
 * credentials shape drives `signInWithPassword`, the token shape `signInWithToken`.
 * The QR carries the sharer's mode (Baby Buddy vs Home Assistant) so the new
 * device joins the same kind of server.
 */
export function ScanLoginScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const signIn = useAuthStore((s) => s.signIn);
  const [permission, requestPermission] = useCameraPermissions();
  // Once a code is read we stop handling further scans until the attempt resolves.
  const [handling, setHandling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onScan = async (data: string) => {
    if (handling) return;
    setHandling(true);
    setError(null);
    try {
      const payload = parseJoin(data);
      const session =
        payload.kind === 'token'
          ? await signInWithToken(payload.mode, payload.url, payload.token)
          : await signInWithPassword(payload.mode, payload.url, payload.username, payload.password);
      signIn(session);
      // On success the auth stack swaps to the dashboard; nothing more to do.
    } catch (err) {
      setError(err instanceof InvalidJoinError ? err.message : errorMessage(err));
      // Let the user line up another scan.
      setHandling(false);
    }
  };

  const granted = permission?.granted ?? false;

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
          {t('share.scanTitle')}
        </AppText>
      </View>

      <View style={styles.body}>
        {granted ? (
          <View style={styles.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handling ? undefined : (e) => void onScan(e.data)}
            />
          </View>
        ) : (
          <View style={styles.permission}>
            <AppText size={fontSize.body} weight="700" style={styles.center}>
              {t('share.cameraNeeded')}
            </AppText>
            <ActionButton
              label={t('share.grantCamera')}
              fullWidth
              onPress={() => void requestPermission()}
            />
          </View>
        )}

        <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted} style={styles.hint}>
          {t('share.scanHint')}
        </AppText>

        {error ? (
          <AppText size={fontSize.metaSm} weight="700" color={colors.danger} style={styles.center}>
            {error}
          </AppText>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

type Props = NativeStackScreenProps<MainStackParamList, 'ScanLogin'>;

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
    body: {
      flex: 1,
      padding: spacing['2xl'],
      gap: spacing['2xl'],
    },
    cameraWrap: {
      flex: 1,
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: colors.card,
    },
    permission: {
      flex: 1,
      justifyContent: 'center',
      gap: spacing['2xl'],
    },
    center: {
      textAlign: 'center',
    },
    hint: {
      textAlign: 'center',
    },
  });
