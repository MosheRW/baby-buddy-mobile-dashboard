/**
 * Design tokens — the single source of truth for color, spacing, radius, type,
 * and shadow across the app. Values come from
 * `design_handoff_react_native_app/README.md` (Design Tokens section), where the
 * prototype's OKLCH colors are already converted to approximate sRGB hex.
 *
 * Never hardcode a hex or px value in a component — reference these tokens.
 */

import { Platform, type TextStyle, type ViewStyle } from 'react-native';

// --- Colors -----------------------------------------------------------------

export const colors = {
  background: '#F7F3EF',
  card: '#FFFFFF',

  accent: '#E0906B', // warm terracotta/apricot — primary buttons + active states
  danger: '#C4462B', // delete / destructive

  textPrimary: '#3A3230',
  textMuted: '#8C827E',
  textSecondary: '#7D746F',

  // Neutral chip / disabled surfaces
  neutral: '#EDE9E6',

  /**
   * The warmer, lighter cream the prototype uses for *informational* tiles —
   * the "Food, Nh" total and a medication row that isn't urgent yet. Distinct
   * from `neutral`, which reads as "disabled".
   */
  tileNeutral: '#F6F3EE',

  // Feeding-trend gauge: today at or above the 7-day norm, or below it.
  trendUp: '#5F9E62',
  trendDown: '#A8813F',

  // On-accent / on-danger foreground
  onAccent: '#FFFFFF',
} as const;

/**
 * Tinted surface pairs (bg + fg) for the various entry types and states.
 * bg is used for the card/pill fill, fg for text/icon on that fill.
 * Hex approximations of the handoff's OKLCH tint values.
 */
export const tints = {
  pee: { bg: '#EAF1F6', fg: '#3E6E86' }, // soft blue
  poo: { bg: '#F5EEDD', fg: '#8A6A2E' }, // soft amber
  // Warm peach. `track` is the unfilled part of the trend gauge drawn on top of
  // `bg`, so it has to be darker than the card-level neutral the other bars use.
  feeding: { bg: '#F6DFD6', fg: '#9A4A34', track: '#E4D2CB' },
  eligible: { bg: '#F9E7EE', fg: '#9A3560' }, // soft pink (medication eligible)
  overdue: { bg: '#F7DFDA', fg: '#A63A24' }, // soft red (overdue/urgent)
  sleep: { bg: '#E8E9F3' }, // soft lavender
  tummy: { bg: '#E4EFE4' }, // soft green
  // Quick-action buttons: a soft peach wash with terracotta content, not a
  // solid accent fill — six saturated blocks would dominate the card.
  quickAction: { bg: '#F5EBE6', fg: '#9A4A34' },
  // The "More" button, which stands apart from the five typed ones.
  more: { bg: '#EAE3DB', fg: '#5B534E' },
  // Offered-but-not-applied surfaces (the tag quick-pick chips). Carries a
  // border as well, since the dashed outline is what marks them as offers.
  suggestion: { bg: '#FCEFE9', fg: '#96543D', border: '#E6A98D' },
} as const;

/**
 * The poo-color swatches offered in the diaper form. Clinical colors, so these
 * are literal swatch values rather than UI-surface tints. Limited to Baby
 * Buddy's four-value `color` enum (see PooColor) — the handoff drew five.
 */
export const pooSwatch = {
  yellow: '#E8C25C',
  green: '#7FA05A',
  brown: '#8A6242',
  black: '#3A3230',
} as const;

/**
 * Per-child avatar tint, generated from the child's hue (handoff uses
 * hues 30 / 200 / 320 / 100 in demo data). Approximates
 * bg = oklch(0.93 0.05 hue), fg = oklch(0.5 0.1 hue).
 */
export function avatarTint(hue: number): { bg: string; fg: string } {
  const norm = ((hue % 360) + 360) % 360;
  return {
    bg: `hsl(${norm}, 45%, 90%)`,
    fg: `hsl(${norm}, 45%, 42%)`,
  };
}

// --- Spacing ----------------------------------------------------------------
// Handoff spacing scale — no arbitrary values outside this set.

export const spacing = {
  xs: 6,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  '2xl': 16,
  '3xl': 18,
  '4xl': 20,
  '5xl': 22,
  '6xl': 26,
  '7xl': 30,
} as const;

// Numeric spacing scale (for when a raw value from the handoff set is clearer).
export const space = [6, 8, 10, 12, 14, 16, 18, 20, 22, 26, 30] as const;

// --- Radii ------------------------------------------------------------------

export const radii = {
  iconButton: 8, // small icon buttons
  chipSmall: 10, // chips, small cards
  tile: 12, // stat tiles, small cards
  control: 14, // buttons, inputs, medium cards
  feedRow: 16, // feed rows
  pill: 20, // pills
  card: 24, // main cards, sheet top corners
} as const;

// --- Type scale -------------------------------------------------------------

export const fontSize = {
  screenTitle: 22, // screen titles
  cardTitle: 17, // card titles / big values
  cardTitleLg: 18,
  body: 14, // body / buttons
  bodySm: 13,
  meta: 12, // meta / labels
  metaSm: 11,
  micro: 10, // uppercase micro-labels, button captions
} as const;

/** Font family names registered by expo-font (see theme/typography.ts). */
export const fontFamily = {
  regular: 'Nunito_400Regular',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
} as const;

/**
 * Weight → family map. RN can't synthesize Nunito's weights from a single
 * family, so "weight" is expressed by picking the matching family.
 * 600 body/labels · 700 chips/medium · 800 headings/values/buttons.
 */
export const weightFamily = {
  '400': fontFamily.regular,
  '600': fontFamily.semibold,
  '700': fontFamily.bold,
  '800': fontFamily.extrabold,
  '900': fontFamily.black,
} as const;

export type FontWeightKey = keyof typeof weightFamily;

// --- Shadows ----------------------------------------------------------------
// Soft, low-opacity warm-toned shadows translated to RN. iOS uses the
// shadow* props; Android uses elevation.

export const shadows = {
  card: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 20,
      shadowOpacity: 0.08,
    },
    android: { elevation: 4 },
    default: {},
  }),
  feedRow: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 8,
      shadowOpacity: 0.05,
    },
    android: { elevation: 2 },
    default: {},
  }),
} as const;

// --- Text style helper ------------------------------------------------------

/** Build a Nunito text style from a size + weight (+ optional color). */
export function text(
  size: number,
  weight: FontWeightKey = '600',
  color: string = colors.textPrimary,
): TextStyle {
  return {
    fontFamily: weightFamily[weight],
    fontSize: size,
    color,
  };
}
