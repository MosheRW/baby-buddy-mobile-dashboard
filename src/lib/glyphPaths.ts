/**
 * SVG path builders for the hand-drawn glyphs. Pure geometry, no React — the
 * glyph components in `components/glyphs/entryGlyphs.tsx` just fill these in.
 *
 * They exist as their own module so the geometry is unit-testable. The
 * radius-clamping in `roundedRect` is the reason: without it, a CSS radius the
 * prototype uses freely (`border-radius: 0 7px 7px 0` on a 14x7 box) emits arcs
 * larger than the box and renders as a spike rather than a rounded end.
 */

/**
 * Rounded rect with per-corner radii, following CSS `border-radius: tl tr br bl`
 * — including CSS's overflow rule: if the two radii on any edge exceed that
 * edge's length, *every* radius shrinks by the same factor.
 */
export function roundedRect(
  x: number,
  y: number,
  w: number,
  h: number,
  tl: number,
  tr: number,
  br: number,
  bl: number,
): string {
  const ratio = (extent: number, a: number, b: number) =>
    a + b > 0 ? extent / (a + b) : Infinity;
  const f = Math.min(1, ratio(w, tl, tr), ratio(w, bl, br), ratio(h, tl, bl), ratio(h, tr, br));
  if (f < 1) {
    tl *= f;
    tr *= f;
    br *= f;
    bl *= f;
  }
  return [
    `M${x + tl},${y}`,
    `H${x + w - tr}`,
    tr ? `A${tr},${tr} 0 0 1 ${x + w},${y + tr}` : '',
    `V${y + h - br}`,
    br ? `A${br},${br} 0 0 1 ${x + w - br},${y + h}` : '',
    `H${x + bl}`,
    bl ? `A${bl},${bl} 0 0 1 ${x},${y + h - bl}` : '',
    `V${y + tl}`,
    tl ? `A${tl},${tl} 0 0 1 ${x + tl},${y}` : '',
    'Z',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * A circle as a path, so two of them can be combined into one even-odd path to
 * cut a hole (the crescent moon, and the gap between two tablets).
 */
export function circlePath(cx: number, cy: number, r: number): string {
  return `M${cx - r},${cy} a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 ${-r * 2},0 Z`;
}

/** A teardrop pointing up, filling `w` x `h`. */
export function dropPath(w: number, h: number): string {
  const r = w / 2;
  const cy = h - r;
  return `M${r},0 C${r},0 ${w},${cy - r * 0.4} ${w},${cy} A${r},${r} 0 1,1 0,${cy} C0,${cy - r * 0.4} ${r},0 ${r},0 Z`;
}

/** Scale + centre offsets for fitting a `w` x `h` drawing into the 24x24 grid. */
export function fitToGrid(w: number, h: number, grid = 24, inset = 22) {
  const scale = inset / Math.max(w, h);
  return { scale, dx: (grid - w * scale) / 2, dy: (grid - h * scale) / 2 };
}
