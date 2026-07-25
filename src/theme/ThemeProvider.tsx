/**
 * Theme context — the one thing components read colour through.
 *
 * The pattern for a themed component is three lines:
 *
 * ```tsx
 * export function Thing() {
 *   const { colors, tints } = useTheme();          // for inline / prop colours
 *   const styles = useThemedStyles(makeStyles);    // for the StyleSheet
 *   ...
 * }
 * const makeStyles = ({ colors }: AppTheme) => StyleSheet.create({ ... });
 * ```
 *
 * `StyleSheet.create` at module scope snapshots colour values at import time,
 * which is why a runtime switch needs the factory form — the sheet has to be
 * rebuilt per scheme. Destructuring `colors`/`tints` in the component body and
 * in the factory signature keeps every *usage* spelled exactly as it was before
 * theming, so the migration touched imports and wrappers rather than the 295
 * individual colour references.
 */

import React, { createContext, useContext, useLayoutEffect, useMemo } from 'react';
import { PALETTES, type Scheme, type ThemePalette } from './palette';
import { setActiveScheme } from './scheme';

export type AppTheme = ThemePalette;

const ThemeContext = createContext<AppTheme>(PALETTES.light);

export function ThemeProvider({ scheme, children }: { scheme: Scheme; children: React.ReactNode }) {
  // Mirrored into the module-level accessor twice, deliberately.
  //
  // During render, because pure helpers and glyph default props read it in
  // this same pass — an effect alone would paint the first frame after a
  // switch in the *old* scheme, and since writing a module variable schedules
  // no re-render, nothing would come along to correct it. The write is
  // idempotent and derived purely from the prop, so a StrictMode double render
  // is harmless.
  //
  // Then again after commit, so a render that React starts and abandons (a
  // concurrent feature, or StrictMode) can't leave the global ahead of what is
  // actually on screen: whichever render *commits* gets the last word.
  setActiveScheme(scheme);
  useLayoutEffect(() => {
    setActiveScheme(scheme);
  }, [scheme]);

  return <ThemeContext.Provider value={PALETTES[scheme]}>{children}</ThemeContext.Provider>;
}

/** The active palette. Subscribes the component to scheme changes. */
export function useTheme(): AppTheme {
  return useContext(ThemeContext);
}

/**
 * Build a StyleSheet for the active scheme, rebuilt only when the scheme
 * changes. `factory` must be a stable module-scope function — an inline arrow
 * would defeat the memo and rebuild the sheet on every render.
 */
export function useThemedStyles<T>(factory: (theme: AppTheme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}
