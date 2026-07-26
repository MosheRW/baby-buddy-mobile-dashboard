/**
 * Per-child / per-group accent colours, derived from a single hue so the same
 * choice can paint the avatar, the name, and the card's gradient background and
 * stay coherent.
 *
 * Both schemes are live. `accentColors(hue, scheme)` defaults `scheme` to the
 * active one via `getScheme()`; components that already hold a theme should pass
 * `theme.scheme` explicitly so the value is tied to the render that produced it.
 *
 * Hues follow the same HSL approach as `avatarTint` in `palette.ts`, so an
 * accent and the avatar it recolours share one colour model.
 */
// `Scheme` is deliberately not re-exported here — `palette.ts` owns it and the
// theme barrel already exports it from there.
import { avatarTint, type Scheme } from './palette';
import { getScheme } from './scheme';

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
 * The current colour scheme.
 *
 * @deprecated Prefer `useTheme().scheme` in components — it re-renders on a
 * switch. This is the module-level read, kept for pure code and default props.
 */
export function resolveScheme(): Scheme {
  return getScheme();
}

const norm = (hue: number): number => ((hue % 360) + 360) % 360;

/**
 * Resolve a hue into the set of coherent colours a card uses. Both schemes keep
 * the same idea: the accent should *tint* the card, not repaint it, so the
 * stops stay a subtle wash and the body text on top keeps its normal contrast.
 * Light washes toward white, dark washes toward the warm near-black surface.
 */
export function accentColors(hue: number, scheme: Scheme = getScheme()): AccentColors {
  const h = norm(hue);
  const tint = avatarTint(h, scheme);

  if (scheme === 'dark') {
    return {
      gradientFrom: `hsl(${h}, 22%, 20%)`,
      gradientTo: `hsl(${h}, 26%, 14%)`,
      name: `hsl(${h}, 55%, 74%)`,
      avatarBg: tint.bg,
      avatarFg: tint.fg,
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
