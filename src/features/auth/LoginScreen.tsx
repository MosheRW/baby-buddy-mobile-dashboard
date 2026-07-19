import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActionButton,
  AppText,
  SegmentedToggle,
  TextField,
} from '../../components';
import { colors, fontSize, spacing } from '../../theme';
import type { LoginMode } from '../../api/types';
import { useAuthStore } from '../../stores';
import { CURRENT_USER } from '../../data/mockData';

export function LoginScreen() {
  const signIn = useAuthStore((s) => s.signIn);
  const [mode, setMode] = useState<LoginMode>('babybuddy');

  // Baby Buddy fields
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  // Home Assistant fields
  const [haUrl, setHaUrl] = useState('');
  const [token, setToken] = useState('');

  const submit = () => {
    // Phase 2: no real auth yet — just establish a mock session.
    signIn({
      mode,
      baseUrl: mode === 'babybuddy' ? serverUrl || 'https://babybuddy.example.com' : haUrl,
      userName: CURRENT_USER,
    });
  };

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
              onChange={setMode}
              options={[
                { value: 'babybuddy', label: 'Baby Buddy server' },
                { value: 'homeassistant', label: 'Home Assistant' },
              ]}
            />
          </View>

          {mode === 'babybuddy' ? (
            <View style={styles.fields}>
              <TextField
                label="Server URL"
                placeholder="https://babybuddy.example.com"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                value={serverUrl}
                onChangeText={setServerUrl}
              />
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
            </View>
          ) : (
            <View style={styles.fields}>
              <TextField
                label="Home Assistant URL"
                placeholder="https://homeassistant.local:8123"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                value={haUrl}
                onChangeText={setHaUrl}
              />
              <TextField
                label="Long-lived access token"
                placeholder="Paste token"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                value={token}
                onChangeText={setToken}
              />
              <AppText size={fontSize.metaSm} weight="600" color={colors.textMuted}>
                Uses the Baby Buddy add-on running on this Home Assistant instance
              </AppText>
            </View>
          )}

          <View style={styles.cta}>
            <ActionButton
              label={mode === 'babybuddy' ? 'Log in' : 'Connect'}
              fullWidth
              onPress={submit}
            />
          </View>
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
  cta: {
    marginTop: spacing['6xl'],
  },
});
