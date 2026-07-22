/**
 * Pure math + parsing behind the {@link Stepper} component's enhanced number
 * inputs. Kept out of the component (and free of any RN/i18n import) so the
 * acceleration curve and input validation are unit-testable in isolation.
 *
 * Two behaviours live here:
 *  - `rampStep` — the press-and-hold acceleration on the ±  buttons. A single
 *    tap always moves by the input's fine `unit`; holding ramps the increment
 *    up, faster the longer you hold *and* the larger the current value, so
 *    500 ml flies while 8 ml stays gentle.
 *  - `parseNumericInput` — turn the manual-entry text into a number (or null),
 *    tolerant of a comma decimal separator and stray whitespace.
 */

/** Decimal places in a number's own representation (0.1 → 1, 5 → 0). */
function decimalsOf(n: number): number {
  if (!Number.isFinite(n) || Number.isInteger(n)) return 0;
  const s = String(n);
  const i = s.indexOf('.');
  return i === -1 ? 0 : s.length - i - 1;
}

/**
 * Snap a positive count to the nearest "nice" number — 1, 2 or 5 times a power
 * of ten — so ramped values land on round numbers (120, 150, 200) rather than
 * arbitrary ones. Anything at or below 1 stays 1 (the fine unit is the floor).
 */
function niceCount(x: number): number {
  if (!Number.isFinite(x) || x <= 1) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(x)));
  const f = x / pow; // in [1, 10)
  const nice = f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10;
  return nice * pow;
}

/** Round to a unit's precision, killing the float drift from `count * unit`. */
function cleanTo(value: number, unit: number): number {
  const p = Math.pow(10, decimalsOf(unit));
  return Math.round(value * p) / p;
}

/**
 * The increment to apply on one press-and-hold tick.
 *
 * @param value  current value (drives the magnitude term)
 * @param unit   the input's fine step — the smallest, single-tap increment and
 *               the floor for the ramp; also fixes the output's precision
 * @param heldMs how long the button has been held, in ms
 * @param min/max bounds; when both are finite the per-tick step is capped to a
 *               fraction of the span so a small bounded range (e.g. a 30–45°
 *               temperature) can't be blown through in a single tick
 *
 * Result is always a multiple of `unit`, at least `unit`, snapped to a nice
 * number, and never NaN.
 */
export function rampStep(
  value: number,
  unit: number,
  heldMs: number,
  min = -Infinity,
  max = Infinity,
): number {
  const u = unit > 0 ? unit : 1;
  // Time factor doubles roughly every 0.7 s of holding, capped at 8× so a long
  // hold stays controllable rather than running away.
  const timeMult = Math.min(8, Math.pow(2, Math.floor(Math.max(0, heldMs) / 700)));
  // Magnitude factor ≈ 2% of the current value, so big numbers stride and small
  // ones creep. Expressed in absolute value units, floored at the fine unit.
  const magnitude = Math.abs(value) * 0.02;
  let raw = Math.max(u, magnitude * timeMult);

  const span = max - min;
  if (Number.isFinite(span)) raw = Math.min(raw, Math.max(u, span / 50));

  return cleanTo(niceCount(raw / u) * u, u);
}

/**
 * Parse manual-entry text into a number. Accepts a comma or dot decimal
 * separator and surrounding whitespace; returns null for anything that isn't a
 * finite number (empty, a lone sign/dot, letters, Infinity).
 */
export function parseNumericInput(raw: string): number | null {
  const cleaned = raw.trim().replace(',', '.');
  if (cleaned === '' || cleaned === '.' || cleaned === '-' || cleaned === '+') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Whether a parsed value sits within the inclusive [min, max] bounds. */
export function isWithinRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}
