import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTranslation } from 'react-i18next';
import { AppText, Card } from '../../components';
import { fontSize, radii, spacing, useTheme, useThemedStyles, type AppTheme } from '../../theme';
import { encodeJoin, type JoinPayload } from '../../lib/joinCode';

/**
 * Renders a scannable join QR for a payload, with the security caveat that it
 * carries a live credential. Deliberately display-only — nothing here persists
 * the payload (see the Batch D security note in the plan).
 */
export function JoinQrView({ payload, caption }: { payload: JoinPayload; caption?: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  // The QR renders on a light quiet-zone regardless of theme (scanners want dark
  // modules on a light field), so the code is always foreground-on-white. Those
  // two fixed values live in the palette (`qr*`) so the exception is auditable.
  const value = useMemo(() => encodeJoin(payload), [payload]);

  return (
    <Card style={styles.card}>
      <View style={styles.qrWrap}>
        <QRCode
          value={value}
          size={220}
          backgroundColor={colors.qrBackground}
          color={colors.qrForeground}
        />
      </View>
      {caption ? (
        <AppText size={fontSize.body} weight="700" style={styles.caption}>
          {caption}
        </AppText>
      ) : null}
      <AppText size={fontSize.metaSm} weight="600" color={colors.danger} style={styles.warning}>
        {t('share.qrWarning')}
      </AppText>
    </Card>
  );
}

const makeStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    card: {
      alignItems: 'center',
      gap: spacing.lg,
    },
    qrWrap: {
      padding: spacing.lg,
      borderRadius: radii.control,
      backgroundColor: colors.qrBackground,
    },
    caption: {
      textAlign: 'center',
      color: colors.textPrimary,
    },
    warning: {
      textAlign: 'center',
    },
  });
