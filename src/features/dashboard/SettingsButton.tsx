import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GearGlyph } from '../../components/glyphs';
import { radii, useTheme, useThemedStyles, type AppTheme } from '../../theme';

interface SettingsButtonProps {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * The cog that opens Settings. Rendered next to the child names — inline in the
 * tab row when there are ≥3 children, floating over the card header otherwise —
 * so it never takes a row of its own.
 */
export function SettingsButton({ onPress, style }: SettingsButtonProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      // Was a hardcoded English "Settings"; localized so a screen reader
      // announces it correctly in Hebrew too.
      accessibilityLabel={t('settings.title')}
      // The button is 38px; nudge the touch area to the ~44px guideline.
      hitSlop={3}
      onPress={onPress}
      style={[styles.button, style]}
    >
      <GearGlyph size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const makeStyles = ({ colors, shadows }: AppTheme) =>
  StyleSheet.create({
    button: {
      width: 38,
      height: 38,
      borderRadius: radii.tile,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      ...(shadows.feedRow as object),
    },
  });
