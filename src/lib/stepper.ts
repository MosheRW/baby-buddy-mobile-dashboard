/**
 * Pure parsing behind the {@link Stepper} component's manual number entry. Kept
 * out of the component (and free of any RN/i18n import) so input validation is
 * unit-testable in isolation.
 *
 * The ±  buttons deliberately have no acceleration: a tap and a press-and-hold
 * tick both move by the input's fixed `step`. Typing an exact value is what
 * manual entry is for.
 */

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
