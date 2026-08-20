/**
 * Sources a single hue (0–359) from Android's Material You dynamic colour, so
 * the rest of the app can feed it through the same HSL formulas that already
 * drive `accentColors`/`brandAccentColor` — the actual Material tone
 * (saturation, lightness, tonal role) is deliberately discarded. Pasting
 * Android's literal M3 primary colour into this app's warm, pastel design
 * language would clash; sourcing only the hue keeps dynamic colour as
 * coherent as the curated `ACCENT_SWATCHES`.
 *
 * `useDynamicAccentHue()` is a separate context from `ThemeContext` on
 * purpose — `PALETTES[scheme]` is a frozen, referentially-stable singleton
 * that `useThemedStyles` memoizes on, and only the handful of places that
 * resolve an accent hue need to re-render when the OS colour changes.
 *
 * `AndroidDynamicAccent` (the component that actually calls the native hook)
 * is only ever mounted when `Platform.OS === 'android'`, so its native calls
 * never execute on iOS/web, and it's inert under Jest (`Platform.OS` there
 * defaults to `'ios'`) with no file-extension platform-splitting needed.
 *
 * Freshness is free: Android recreates the host Activity when the system
 * dynamic colour changes (an OS config change that can't be disabled), which
 * remounts the RN app and re-invokes `useMaterial3Theme()` — no polling.
 */
import React, { createContext, useContext, type ReactNode } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { isDynamicThemeSupported, useMaterial3Theme } from '@pchmn/expo-material3-theme';

/** The light palette's fixed terracotta accent — see `palette.ts`. */
const TERRACOTTA_HEX = '#E0906B';

/** Pure RGB→HSL, returning only the hue. */
export function hexToHue(hex: string): number {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 0;

  let hue: number;
  if (max === r) {
    hue = ((g - b) / delta) % 6;
  } else if (max === g) {
    hue = (b - r) / delta + 2;
  } else {
    hue = (r - g) / delta + 4;
  }
  hue *= 60;
  return hue < 0 ? hue + 360 : hue;
}

const DynamicAccentContext = createContext<number | null>(null);

/** The current system accent hue, or `null` off-Android / unsupported. */
export function useDynamicAccentHue(): number | null {
  return useContext(DynamicAccentContext);
}

function AndroidDynamicAccent({ children }: { children: ReactNode }) {
  const { theme } = useMaterial3Theme({ fallbackSourceColor: TERRACOTTA_HEX });
  const supported = isDynamicThemeSupported && Constants.appOwnership !== 'expo';
  const hue = supported ? hexToHue(theme.light.primary) : null;
  return <DynamicAccentContext.Provider value={hue}>{children}</DynamicAccentContext.Provider>;
}

/** Wrap the app in this to make `useDynamicAccentHue()` available. */
export function DynamicAccentProvider({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'android') {
    return <DynamicAccentContext.Provider value={null}>{children}</DynamicAccentContext.Provider>;
  }
  return <AndroidDynamicAccent>{children}</AndroidDynamicAccent>;
}
