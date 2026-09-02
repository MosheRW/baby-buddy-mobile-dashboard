import React, { useRef } from 'react';
import { Linking, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ActionButton, AppText, Card } from '../../components';
import { ChevronLeftGlyph } from '../../components/glyphs';
import { fontSize, spacing, useTheme, useThemedStyles, type AppTheme } from '../../theme';
import type { MainStackParamList } from '../../navigation/types';
import {
  aboutLinks,
  appVersion,
  donateEnabled,
  donateUrl,
  shareUrl,
} from '../../config/about';

type Props = NativeStackScreenProps<MainStackParamList, 'About'>;

/** Two taps within this window count as the version double-tap. */
const DOUBLE_TAP_MS = 400;

/** Open an external URL, swallowing the rejection an unopenable link would throw. */
function openUrl(url: string): void {
  if (!url) return;
  void Linking.openURL(url).catch(() => {
    /* A malformed or unhandled scheme shouldn't crash the screen. */
  });
}

export function AboutScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const lastTap = useRef(0);

  // "Touch it twice" opens the release announcement. A ref (not state) keeps the
  // timing without re-rendering the row between the two taps.
  const onVersionPress = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      openUrl(aboutLinks.discussionsAnnouncements);
    } else {
      lastTap.current = now;
    }
  };

  const shareApp = () => {
    void Share.share({ message: t('about.shareBody', { url: shareUrl }) }).catch(() => {
      /* The user dismissing the share sheet rejects — nothing to handle. */
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={() => navigation.goBack()}
          hitSlop={10}
        >
          <ChevronLeftGlyph size={24} color={colors.textPrimary} />
        </Pressable>
        <AppText size={fontSize.screenTitle} weight="800">
          {t('about.title')}
        </AppText>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.section}>
          <AppText size={fontSize.bodySm} weight="800">
            {t('about.aboutMeTitle')}
          </AppText>
          <AppText size={fontSize.bodySm} weight="600" color={colors.textMuted}>
            {t('about.aboutMeBody')}
          </AppText>
          <LinkRow label={t('about.linkedIn')} url={aboutLinks.linkedIn} />
        </Card>

        <Card style={styles.section}>
          <AppText size={fontSize.bodySm} weight="800">
            {t('about.aboutAppTitle')}
          </AppText>
          <AppText size={fontSize.bodySm} weight="600" color={colors.textMuted}>
            {t('about.aboutAppBody')}
          </AppText>
          <LinkRow label={t('about.userManual')} url={aboutLinks.userManual} />
        </Card>

        <Card style={styles.section}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('about.versionValue', { version: appVersion })}
            accessibilityHint={t('about.versionHint')}
            onPress={onVersionPress}
          >
            <AppText size={fontSize.bodySm} weight="800">
              {t('about.versionTitle')}
            </AppText>
            <AppText size={fontSize.body} weight="700">
              {t('about.versionValue', { version: appVersion })}
            </AppText>
          </Pressable>
          <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
            {t('about.versionHint')}
          </AppText>
        </Card>

        <Card style={styles.section}>
          <AppText size={fontSize.bodySm} weight="800">
            {t('about.linksTitle')}
          </AppText>
          <LinkRow label={t('about.webApp')} url={aboutLinks.webApp} />
          <LinkRow label={t('about.discussions')} url={aboutLinks.discussions} />
          <LinkRow label={t('about.playStore')} url={aboutLinks.playStore} />
          <LinkRow label={t('about.privacyPolicy')} url={aboutLinks.privacyPolicy} />
          <LinkRow label={t('about.reportBug')} url={aboutLinks.reportBug} />
          <LinkRow label={t('about.sourceCode')} url={aboutLinks.repo} />
        </Card>

        <Card style={styles.section}>
          <AppText size={fontSize.bodySm} weight="800">
            {t('about.shareTitle')}
          </AppText>
          <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
            {t('about.shareHint')}
          </AppText>
          <ActionButton
            label={t('about.shareButton')}
            variant="neutral"
            fullWidth
            onPress={shareApp}
          />
        </Card>

        {/* Non–Play Store builds only: the donate URL is absent from the AAB, so
            `donateEnabled` is false there and this section never renders. */}
        {donateEnabled ? (
          <Card style={styles.section}>
            <AppText size={fontSize.bodySm} weight="800">
              {t('about.donateTitle')}
            </AppText>
            <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
              {t('about.donateHint')}
            </AppText>
            <ActionButton
              label={t('about.buyMeACoffee')}
              variant="accent"
              fullWidth
              onPress={() => openUrl(donateUrl)}
            />
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * One tappable external link. Renders nothing when `url` is empty, so an
 * unconfigured link (a blank field in `app.json`) simply drops out rather than
 * showing a dead row.
 */
function LinkRow({ label, url }: { label: string; url: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  if (!url) return null;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint={t('about.opensExternally')}
      onPress={() => openUrl(url)}
      style={styles.linkRow}
    >
      <AppText size={fontSize.body} weight="700" style={styles.linkLabel}>
        {label}
      </AppText>
      <View style={styles.chevron}>
        <ChevronLeftGlyph size={18} color={colors.textMuted} />
      </View>
    </Pressable>
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
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      paddingTop: spacing.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.neutral,
    },
    linkLabel: {
      flex: 1,
    },
    chevron: {
      // The only chevron glyph points left; flip it to point outward.
      transform: [{ rotate: '180deg' }],
    },
  });
