import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, AppText, SegmentedToggle, TextField } from '../../components';
import { colors, fontSize, radii, spacing } from '../../theme';
import type { LoginMode } from '../../api/types';
import { useAuthStore } from '../../stores';
import { PasswordLoginUnavailable, signInWithPassword, signInWithToken } from '../../api/auth';
import { errorMessage, normalizeBaseUrl } from '../../api/client';
import { USE_MOCK_DATA } from '../../data/dataSource';

/**
 * Sign-in. Baby Buddy exposes no password→token endpoint, so the password
 * fields drive a web-session bootstrap that reads the user's API key off
 * `/api/profile`. Whenever that path can't work — an unexpected login page, a
 * server that won't return the key, or the web build where cookies are blocked
 * cross-origin — the screen falls back to asking for the key directly.
 */
export function LoginScreen() {
  const signIn = useAuthStore((s) => s.signIn);
  const [mode, setMode] = useState<LoginMode>('babybuddy');

  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');

  const [useApiKey, setUseApiKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHa = mode === 'homeassistant';

  const submit = async () => {
    const baseUrl = normalizeBaseUrl(serverUrl);
    if (!baseUrl) {
      setError('Enter your server URL.');
      return;
    }

    if (USE_MOCK_DATA) {
      // Fixture mode: there's no server to authenticate against.
      signIn({ mode, baseUrl, token: 'mock', userName: 'Sarah' });
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const session =
        useApiKey || isHa
          ? await signInWithToken(mode, baseUrl, apiKey.trim())
          : await signInWithPassword(mode, baseUrl, username.trim(), password);
      signIn(session);
    } catch (err) {
      if (err instanceof PasswordLoginUnavailable) {
        // Offer the supported path instead of leaving the user stuck.
        setUseApiKey(true);
        setError(`${err.message} Paste your API key from Baby Buddy's user settings instead.`);
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const showKeyField = useApiKey || isHa;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.logo} />
          <AppText size={fontSize.screenTitle} weight="800" style={styles.title}>
            Baby Buddy Dashboard
          </AppText>
          <AppText
            size={fontSize.bodySm}
            weight="600"
            color={colors.textMuted}
            style={styles.subtitle}
          >
            Connect to your server
          </AppText>

          <View style={styles.toggle}>
            <SegmentedToggle
              value={mode}
              onChange={(m) => {
                setMode(m);
                setError(null);
              }}
              options={[
                { value: 'babybuddy', label: 'Baby Buddy server' },
                { value: 'homeassistant', label: 'Home Assistant' },
              ]}
            />
          </View>

          <View style={styles.fields}>
            <TextField
              label={isHa ? 'Add-on URL' : 'Server URL'}
              placeholder={
                isHa ? 'http://homeassistant.local:8123/addon-slug' : 'https://babybuddy.example.com'
              }
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              value={serverUrl}
              onChangeText={setServerUrl}
            />

            {showKeyField ? (
              <TextField
                label="API key"
                placeholder="Paste from Baby Buddy → user settings"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                value={apiKey}
                onChangeText={setApiKey}
              />
            ) : (
              <>
                <TextField
                  label="Username"
                  placeholder="sarah"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={username}
                  onChangeText={setUsername}
                />
                <TextField
                  label="Password"
                  placeholder="••••••••"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </>
            )}

            {isHa ? (
              <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
                Include the add-on&apos;s ingress path in the URL. The key is the Baby Buddy API key
                from its user settings, not a Home Assistant token.
              </AppText>
            ) : null}
          </View>

          {error ? (
            <View style={styles.error}>
              <AppText size={fontSize.metaSm} weight="700" color={colors.danger}>
                {error}
              </AppText>
            </View>
          ) : null}

          <View style={styles.cta}>
            <ActionButton
              label={busy ? 'Connecting…' : isHa ? 'Connect' : 'Log in'}
              fullWidth
              disabled={busy}
              onPress={() => void submit()}
            />
          </View>

          {!isHa ? (
            <View style={styles.switcher}>
              <ActionButton
                label={showKeyField ? 'Use username and password' : 'Use an API key instead'}
                variant="neutral"
                fullWidth
                disabled={busy}
                onPress={() => {
                  setUseApiKey((v) => !v);
                  setError(null);
                }}
              />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingTop: 44,
    paddingHorizontal: 22,
    paddingBottom: spacing['7xl'],
    alignItems: 'stretch',
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignSelf: 'center',
    marginBottom: spacing['5xl'],
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing['6xl'],
  },
  toggle: {
    marginBottom: spacing['5xl'],
  },
  fields: {
    gap: spacing['2xl'],
  },
  error: {
    marginTop: spacing['2xl'],
    padding: spacing['2xl'],
    borderRadius: radii.control,
    backgroundColor: colors.card,
  },
  cta: {
    marginTop: spacing['6xl'],
  },
  switcher: {
    marginTop: spacing.lg,
  },
});
