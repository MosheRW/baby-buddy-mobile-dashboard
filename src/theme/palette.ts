/**
 * Colour palettes — one per scheme. Everything colour-valued lives here; the
 * scheme-independent tokens (spacing, radii, type scale) stay in `tokens.ts`.
 *
 * **Light is the handoff, dark is authored.** The light palette is the design
 * handoff's Design Tokens section verbatim (OKLCH already converted to hex
 * there) and must not drift. The handoff and the prototype have no dark spec at
 * all, so the dark palette is derived from the light one on a single rule:
 * *keep the warmth*. Surfaces are warm near-black browns rather than neutral
 * greys, the terracotta accent stays the accent, and every pastel tint becomes
 * a deep, desaturated version of the same hue rather than a different colour.
 * The app should read as the same app with the lights off.
 *
 * Two things invert rather than translate:
 * - `onAccent` is white on light but *dark* on dark. The dark accent is lifted
 *   to stay visible against a dark surface, which makes it too light to carry
 *   white text.
 * - `textSecondary` is *darker* than `textMuted` in light and *lighter* in
 *   dark. The pair is "more emphasis / less emphasis", and on a dark surface
 *   more emphasis means brighter, not darker.
 *
 * Never read a palette directly from a component — go through `useTheme()`, or
 * `themeColors()` for pure modules and default props. See `ThemeProvider.tsx`.
 */

import { Platform, type ViewStyle } from 'react-native';
import type { PooColor } from '../api/types';

export type Scheme = 'light' | 'dark';

// --- Shapes -----------------------------------------------------------------

export interface Palette {
  background: string;
  card: string;
  /**
   * Hairline card outline. Undefined in light, where the drop shadow does the
   * separating; a drop shadow is invisible on a dark surface, so dark needs an
   * explicit edge instead. Consumers must treat `undefined` as "draw no border"
   * rather than defaulting to a colour — a transparent border would still inset
   * the light layout by a hairline.
   */
  cardBorder?: string;

  accent: string;
  danger: string;

  textPrimary: string;
  textMuted: string;
  textSecondary: string;

  /** Neutral chip / disabled surfaces. */
  neutral: string;
  /** Warmer surface for *informational* tiles — distinct from `neutral`, which reads as "disabled". */
  tileNeutral: string;

  /** Feeding-trend gauge: today at or above the 7-day norm, or below it. */
  trendUp: string;
  trendDown: string;

  /** On-accent / on-danger foreground. */
  onAccent: string;

  /** "Within normal range" dot for temperature readings. */
  feverOk: string;

  /** Dimming layer behind a transparent-modal sheet. */
  scrim: string;
}

export interface TintPair {
  bg: string;
  fg: string;
}

export interface Tints {
  pee: TintPair;
  poo: TintPair;
  /** `track` is the unfilled part of the trend gauge drawn on top of `bg`, so it must contrast with `bg`, not with the card. */
  feeding: TintPair & { track: string };
  eligible: TintPair;
  overdue: TintPair;
  sleep: { bg: string };
  tummy: { bg: string };
  quickAction: TintPair;
  more: TintPair;
  /** Offered-but-not-applied surfaces (tag quick-pick chips); the outline is what marks them as offers. */
  suggestion: TintPair & { border: string };
}

export type PooSwatch = Record<PooColor, string>;

export interface Shadows {
  card: ViewStyle;
  feedRow: ViewStyle;
}

// --- Light (from the handoff) ----------------------------------------------

const lightColors: Palette = {
  background: '#F7F3EF',
  card: '#FFFFFF',

  accent: '#E0906B', // warm terracotta/apricot — primary buttons + active states
  danger: '#C4462B', // delete / destructive

  textPrimary: '#3A3230',
  textMuted: '#8C827E',
  textSecondary: '#7D746F',

  neutral: '#EDE9E6',
  // Deepened from the prototype's near-white so it stays a distinct surface on
  // the pale accent-gradient child card instead of blending into it.
  tileNeutral: '#EBE4D8',

  trendUp: '#5F9E62',
  trendDown: '#A8813F',

  onAccent: '#FFFFFF',

  feverOk: '#4E8A5B',

  scrim: 'rgba(0,0,0,0.4)',
};

// Tile background tints are deepened a notch from the prototype's near-white
// pastels so they read as distinct surfaces on the pale accent-gradient child
// card rather than washing into it. Foregrounds are unchanged and stay readable.
const lightTints: Tints = {
  pee: { bg: '#D8E6F1', fg: '#3E6E86' }, // soft blue
  poo: { bg: '#EEE1C6', fg: '#8A6A2E' }, // soft amber
  feeding: { bg: '#F2D0C1', fg: '#9A4A34', track: '#DBC0B5' }, // warm peach
  eligible: { bg: '#F4D8E4', fg: '#9A3560' }, // soft pink (medication eligible)
  overdue: { bg: '#F3CFC7', fg: '#A63A24' }, // soft red (overdue/urgent)
  sleep: { bg: '#DDDEF0' }, // soft lavender
  tummy: { bg: '#D3E6D3' }, // soft green
  // A soft peach wash with terracotta content, not a solid accent fill — six
  // saturated blocks would dominate the card.
  quickAction: { bg: '#F5EBE6', fg: '#9A4A34' },
  // The "More" button, which stands apart from the five typed ones.
  more: { bg: '#EAE3DB', fg: '#5B534E' },
  suggestion: { bg: '#FCEFE9', fg: '#96543D', border: '#E6A98D' },
};

/**
 * Clinical stool colours, so these are literal swatch values rather than UI
 * surfaces — they name a real observation and shouldn't be restyled for taste.
 */
const lightPooSwatch: PooSwatch = {
  yellow: '#E8C25C',
  green: '#7FA05A',
  brown: '#8A6242',
  black: '#3A3230',
};

// --- Dark (authored — see the file header) ----------------------------------

const darkColors: Palette = {
  background: '#191512',
  card: '#241E1A',
  cardBorder: '#332B25',

  // Lifted from the light terracotta: the handoff value is tuned for contrast
  // against cream and goes muddy against a dark surface.
  accent: '#E9A588',
  danger: '#E4705A',

  textPrimary: '#F0E9E4',
  textMuted: '#948A85',
  textSecondary: '#B7ACA5',

  neutral: '#302925',
  tileNeutral: '#3A312A',

  trendUp: '#7DBE80',
  trendDown: '#C9A05A',

  // Dark-on-accent, not white — see the header note.
  onAccent: '#231A15',

  feverOk: '#71B27E',

  scrim: 'rgba(0,0,0,0.6)',
};

const darkTints: Tints = {
  pee: { bg: '#22323D', fg: '#9CC8DE' },
  poo: { bg: '#3A3123', fg: '#D6B978' },
  feeding: { bg: '#41291F', fg: '#F0A88E', track: '#5A3B2E' },
  eligible: { bg: '#3E2430', fg: '#EDA0BE' },
  overdue: { bg: '#43241C', fg: '#F19782' },
  sleep: { bg: '#282A3B' },
  tummy: { bg: '#243325' },
  quickAction: { bg: '#33261F', fg: '#EFAC91' },
  more: { bg: '#2E2823', fg: '#C0B5AE' },
  suggestion: { bg: '#332520', fg: '#E9A98F', border: '#7A5340' },
};

/**
 * The clinical swatches lifted just enough to survive a dark card. `black` is
 * the one that can't be faithful: a near-black swatch on a near-black surface
 * is an invisible reading, and "no swatch drawn" is exactly what a *missing*
 * colour looks like. It becomes the darkest warm grey that still resolves as a
 * filled swatch — still unmistakably the darkest of the four.
 */
const darkPooSwatch: PooSwatch = {
  yellow: '#E8C25C',
  green: '#8FB56A',
  brown: '#A87A55',
  black: '#5A4F4A',
};

// --- Shadows ----------------------------------------------------------------
// Soft, low-opacity shadows translated to RN. iOS uses the shadow* props;
// Android uses elevation.

const lightShadows: Shadows = {
  card: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 20,
      shadowOpacity: 0.08,
    },
    android: { elevation: 4 },
    default: {},
  })!,
  feedRow: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 8,
      shadowOpacity: 0.05,
    },
    android: { elevation: 2 },
    default: {},
  })!,
};

/**
 * A black drop shadow does almost nothing against a near-black background, so
 * dark leans on `cardBorder` for separation and keeps only a deep, wide shadow
 * to seat the card. Android elevation is retained for its surface overlay.
 */
const darkShadows: Shadows = {
  card: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 20,
      shadowOpacity: 0.45,
    },
    android: { elevation: 4 },
    default: {},
  })!,
  feedRow: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 8,
      shadowOpacity: 0.3,
    },
    android: { elevation: 2 },
    default: {},
  })!,
};

// --- Avatar tint ------------------------------------------------------------

/**
 * Per-child avatar tint, generated from the child's hue (the handoff uses hues
 * 30 / 200 / 320 / 100 in demo data). Light approximates
 * bg = oklch(0.93 0.05 hue), fg = oklch(0.5 0.1 hue); dark flips the lightness
 * so the circle is a deep wash with a bright glyph on it.
 */
export function avatarTint(hue: number, scheme: Scheme = 'light'): TintPair {
  const norm = ((hue % 360) + 360) % 360;
  if (scheme === 'dark') {
    return {
      bg: `hsl(${norm}, 30%, 26%)`,
      fg: `hsl(${norm}, 52%, 74%)`,
    };
  }
  return {
    bg: `hsl(${norm}, 45%, 90%)`,
    fg: `hsl(${norm}, 45%, 42%)`,
  };
}

// --- Assembled schemes ------------------------------------------------------

export interface ThemePalette {
  scheme: Scheme;
  colors: Palette;
  tints: Tints;
  pooSwatch: PooSwatch;
  shadows: Shadows;
}

/**
 * Frozen, one object per scheme. Referential stability matters: it's the
 * dependency `useThemedStyles` memoizes on, so a new object per render would
 * rebuild every StyleSheet on every render.
 */
export const PALETTES: Record<Scheme, ThemePalette> = {
  light: {
    scheme: 'light',
    colors: lightColors,
    tints: lightTints,
    pooSwatch: lightPooSwatch,
    shadows: lightShadows,
  },
  dark: {
    scheme: 'dark',
    colors: darkColors,
    tints: darkTints,
    pooSwatch: darkPooSwatch,
    shadows: darkShadows,
  },
};
