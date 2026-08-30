import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppText } from './AppText';
import { ActionButton } from './ActionButton';
import { fontSize, spacing, useTheme, useThemedStyles, type AppTheme } from '../theme';

/**
 * Themed fallback shown in place of the whole navigator when a screen throws
 * during render. A function component so it can use the theme + i18n hooks; the
 * class boundary below renders it. Kept inside the theme/safe-area providers so
 * these hooks resolve.
 */
function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <AppText size={fontSize.screenTitle} weight="800" style={styles.title}>
          {t('errorBoundary.title')}
        </AppText>
        <AppText
          size={fontSize.bodySm}
          weight="600"
          color={colors.textMuted}
          style={styles.body}
        >
          {t('errorBoundary.body')}
        </AppText>
        <ActionButton label={t('errorBoundary.retry')} onPress={onRetry} />
      </View>
    </SafeAreaView>
  );
}

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Last line of defense before publishing: a render-time throw in any screen
 * would otherwise propagate to the app root with no boundary and — in a release
 * build (Hermes, no dev redbox) — unmount the entire tree to a blank screen.
 * This catches it and offers a themed "something went wrong / try again"
 * fallback instead. React error boundaries must be class components.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // No crash-reporting SDK ships in this app (by design). Log a sanitized
    // message so a dev build surfaces it without leaking data — matching the
    // rest of the codebase's console.warn-only convention.
    console.warn('[errorBoundary] a screen crashed:', error instanceof Error ? error.message : error);
  }

  private handleRetry = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}

const makeStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing['4xl'],
      gap: spacing['2xl'],
    },
    title: {
      textAlign: 'center',
    },
    body: {
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
  });
