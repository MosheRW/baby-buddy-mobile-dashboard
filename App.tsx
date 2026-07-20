import 'react-native-reanimated';
import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { useAppFonts } from './src/theme';
import { useAuthStore } from './src/stores';
import { queryClient } from './src/data/queryClient';
import { RootNavigator } from './src/navigation/RootNavigator';

// Keep the splash visible until fonts + persisted state are ready so nothing
// flashes (fallback font, or Login before the stored session rehydrates).
SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Longest we'll hold the splash waiting for fonts or persisted state. Past this
 * the app boots anyway — a missing font or an unreadable saved session is a
 * degraded experience, but a splash screen that never goes away is a dead app.
 */
const BOOT_TIMEOUT_MS = 5_000;

export default function App() {
  const fontsLoaded = useAppFonts();
  const hydrated = useAuthStore((s) => s.hydrated);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), BOOT_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, []);

  const ready = (fontsLoaded && hydrated) || timedOut;

  const onLayout = useCallback(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayout}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
