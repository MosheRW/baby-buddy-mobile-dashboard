/**
 * Per-child / per-group accent colours, derived from a single hue so the same
 * choice can paint the avatar, the name, and the card's gradient background and
 * stay coherent.
 *
 * **Light-only today, but dark-ready.** The app currently ships a single light
 * theme (no color-scheme detection anywhere). Every accent colour is resolved
 * through `accentColors(hue, scheme)`, and `scheme` comes from `resolveScheme()`
 * which returns `'light'` for now. When a dark theme is added, only
 * `resolveScheme` and the dark branch below change — not the call sites.
 *
 * Hues follow the same HSL approach as `avatarTint` in `tokens.ts`, so an accent
 * and the avatar it recolours share one colour model.
 */
import { avatarTint } from './tokens';

export type Scheme = 'light' | 'dark';

/**
 * Curated, on-theme accent hues offered in the colour picker. Kept deliberately
 * small and spread around the wheel so every choice reads as a distinct, warm,
 * muted pastel against the cream background rather than an arbitrary colour.
 */
export const ACCENT_SWATCHES: { id: string; hue: number }[] = [
  { id: 'terracotta', hue: 25 },
  { id: 'amber', hue: 45 },
  { id: 'green', hue: 130 },
  { id: 'teal', hue: 180 },
  { id: 'blue', hue: 205 },
  { id: 'lavender', hue: 255 },
  { id: 'plum', hue: 300 },
  { id: 'pink', hue: 330 },
];

export interface AccentColors {
  /** Gradient stops for the card background (top-left → bottom-right). */
  gradientFrom: string;
  gradientTo: string;
  /** The child's name text colour. */
  name: string;
  /** Avatar circle background + foreground (matches `avatarTint`). */
  avatarBg: string;
  avatarFg: string;
}

/**
 * The current colour scheme. Single future touch-point for dark mode — returns
 * `'light'` until a real light/dark theming layer exists.
 */
export function resolveScheme(): Scheme {
  return 'light';
}

const norm = (hue: number): number => ((hue % 360) + 360) % 360;

/**
 * Resolve a hue into the set of coherent colours a card uses. The light stops
 * are a *subtle* wash over the white card so the existing dark body text stays
 * readable — the accent should tint the card, not repaint it.
 */
export function accentColors(hue: number, scheme: Scheme = resolveScheme()): AccentColors {
  const h = norm(hue);
  const tint = avatarTint(h);

  if (scheme === 'dark') {
    // Defined for when a dark theme lands; unreachable while resolveScheme()
    // returns 'light'. Deeper, desaturated stops for a dark card surface.
    return {
      gradientFrom: `hsl(${h}, 22%, 20%)`,
      gradientTo: `hsl(${h}, 26%, 14%)`,
      name: `hsl(${h}, 55%, 74%)`,
      avatarBg: `hsl(${h}, 30%, 26%)`,
      avatarFg: `hsl(${h}, 55%, 78%)`,
    };
  }

  return {
    gradientFrom: `hsl(${h}, 50%, 97%)`,
    gradientTo: `hsl(${h}, 42%, 90%)`,
    name: `hsl(${h}, 48%, 38%)`,
    avatarBg: tint.bg,
    avatarFg: tint.fg,
  };
}
