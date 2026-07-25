/**
 * The active colour scheme as a module-level value.
 *
 * Components should use `useTheme()` — it subscribes them to changes. This
 * module exists for the two places a hook can't reach:
 *
 * - **Pure modules.** `src/lib/entryDisplay.ts` picks tints for an entry and is
 *   plain, testable, hook-free code, exactly like the `i18n` singleton those
 *   same helpers call for labels. Its exported functions take an optional
 *   `scheme` that defaults to whatever is active, so call sites that have a
 *   theme pass it explicitly and tests get deterministic light values.
 * - **Default props.** The ~25 glyphs default `color` to the primary text
 *   colour. A default parameter is evaluated on every call, so reading it from
 *   here picks up the current scheme without giving each glyph a hook.
 *
 * `ThemeProvider` keeps this in step with the React tree. Nothing else should
 * call `setActiveScheme`.
 */

import { PALETTES, type Palette, type PooSwatch, type Scheme, type Tints } from './palette';

let active: Scheme = 'light';

/** The scheme currently being rendered. */
export function getScheme(): Scheme {
  return active;
}

/** Called by `ThemeProvider` only. */
export function setActiveScheme(scheme: Scheme): void {
  active = scheme;
}

export function themeColors(scheme: Scheme = active): Palette {
  return PALETTES[scheme].colors;
}

export function themeTints(scheme: Scheme = active): Tints {
  return PALETTES[scheme].tints;
}

export function themePooSwatch(scheme: Scheme = active): PooSwatch {
  return PALETTES[scheme].pooSwatch;
}
