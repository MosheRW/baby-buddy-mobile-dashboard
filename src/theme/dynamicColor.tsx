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
import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { isDynamicThemeSupported, useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { PALETTES } from './palette';

/**
 * Source colour handed to the Material You theme generator when the device has
 * no dynamic palette. Derived from the light palette's own accent rather than a
 * hardcoded literal, so it can't silently drift if that value ever changes.
 */
const FALLBACK_SOURCE_COLOR = PALETTES.light.colors.accent;

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

interface DynamicAccentValue {
  /** The phone's current system accent hue, or `null` off-Android / unsupported. */
  hue: number | null;
  /**
   * Whether the OS actually exposes a Material You palette — true only on
   * Android 12+ in a real build. Gating UI (the Settings toggle, the "match
   * phone" chip) on this instead of just `Platform.OS === 'android'` keeps a
   * dead, no-effect control off Android <12 and out of Expo Go.
   */
  supported: boolean;
}

/** Stable identity for the non-Android / no-context case, so consumers don't re-render needlessly. */
const UNSUPPORTED: DynamicAccentValue = { hue: null, supported: false };

const DynamicAccentContext = createContext<DynamicAccentValue>(UNSUPPORTED);

/** The current system accent hue, or `null` off-Android / unsupported. */
export function useDynamicAccentHue(): number | null {
  return useContext(DynamicAccentContext).hue;
}

/** Whether the device can source an accent from Material You (Android 12+ real build). */
export function useDynamicColorSupported(): boolean {
  return useContext(DynamicAccentContext).supported;
}

function AndroidDynamicAccent({ children }: { children: ReactNode }) {
  const { theme } = useMaterial3Theme({ fallbackSourceColor: FALLBACK_SOURCE_COLOR });
  const supported = isDynamicThemeSupported && Constants.appOwnership !== 'expo';
  const hue = supported ? hexToHue(theme.light.primary) : null;
  const value = useMemo<DynamicAccentValue>(() => ({ hue, supported }), [hue, supported]);
  return <DynamicAccentContext.Provider value={value}>{children}</DynamicAccentContext.Provider>;
}

/** Wrap the app in this to make `useDynamicAccentHue()` / `useDynamicColorSupported()` available. */
export function DynamicAccentProvider({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'android') {
    return <DynamicAccentContext.Provider value={UNSUPPORTED}>{children}</DynamicAccentContext.Provider>;
  }
  return <AndroidDynamicAccent>{children}</AndroidDynamicAccent>;
}
