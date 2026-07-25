/**
 * Scheme-independent design tokens — spacing, radii, type scale, font families.
 * Values come from `design_handoff_react_native_app/README.md` (Design Tokens
 * section).
 *
 * Everything colour-valued moved to `palette.ts` when dark mode landed, because
 * a colour is no longer a constant: it depends on the active scheme. Read
 * colour through `useTheme()` (components) or `themeColors()` (pure modules).
 *
 * Never hardcode a px value in a component — reference these tokens.
 */

import { type TextStyle } from 'react-native';
import { themeColors } from './scheme';

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

// --- Text style helper ------------------------------------------------------

/**
 * Build a Nunito text style from a size + weight (+ optional color). The
 * default colour resolves against the active scheme at call time, so this stays
 * correct inside a `makeStyles` factory.
 */
export function text(
  size: number,
  weight: FontWeightKey = '600',
  color: string = themeColors().textPrimary,
): TextStyle {
  return {
    fontFamily: weightFamily[weight],
    fontSize: size,
    color,
  };
}
