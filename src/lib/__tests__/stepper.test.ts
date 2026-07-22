import { rampStep, parseNumericInput, isWithinRange } from '../stepper';

describe('rampStep', () => {
  it('never goes below the fine unit', () => {
    // The floor is one unit; a small value at t=0 moves by exactly one.
    expect(rampStep(8, 1, 0)).toBe(1);
    expect(rampStep(0, 1, 0)).toBe(1);
    // A large-magnitude value may already stride past the unit on the first
    // hold tick — but never under it. (Only a single tap guarantees exactly 1.)
    expect(rampStep(37, 0.1, 0)).toBeGreaterThanOrEqual(0.1);
  });

  it('grows with how long the button is held', () => {
    // Same value, longer hold → larger (or equal) step, monotonically.
    const held = [0, 700, 1400, 2100, 2800].map((ms) => rampStep(200, 1, ms));
    for (let i = 1; i < held.length; i++) {
      expect(held[i]).toBeGreaterThanOrEqual(held[i - 1]);
    }
    expect(held[held.length - 1]).toBeGreaterThan(held[0]);
  });

  it('grows with the magnitude of the current value', () => {
    // At the same hold duration, a larger value strides further.
    const small = rampStep(20, 1, 1400);
    const large = rampStep(600, 1, 1400);
    expect(large).toBeGreaterThan(small);
  });

  it('snaps ramped steps to nice round numbers', () => {
    // Every ramped increment is a 1/2/5 × 10^k multiple of the unit.
    for (const ms of [0, 700, 1400, 2100, 2800]) {
      const s = rampStep(480, 10, ms);
      const inUnits = Math.round(s / 10);
      const pow = Math.pow(10, Math.floor(Math.log10(inUnits)));
      const f = inUnits / pow;
      expect([1, 2, 5, 10]).toContain(f);
    }
  });

  it('caps the step for a small bounded range so it cannot be blown through', () => {
    // Temperature 30–45 (span 15): even a long hold stays a fraction of a degree.
    const s = rampStep(37, 0.1, 5000, 30, 45);
    expect(s).toBeLessThanOrEqual(15 / 50 + 1e-9);
    expect(s).toBeGreaterThanOrEqual(0.1);
  });

  it('does not cap when the range is open-ended', () => {
    // ml has no upper bound, so a long hold on a big value strides far.
    const s = rampStep(500, 1, 2800, 0, Infinity);
    expect(s).toBeGreaterThan(10);
  });

  it('returns clean, drift-free multiples of a fractional unit', () => {
    const s = rampStep(37, 0.1, 2800, 30, 45);
    // No 0.30000000000000004 nonsense: the value equals its own 1-decimal round.
    expect(s).toBe(Math.round(s * 10) / 10);
  });
});

describe('parseNumericInput', () => {
  it('parses plain and decimal numbers', () => {
    expect(parseNumericInput('42')).toBe(42);
    expect(parseNumericInput('3.5')).toBe(3.5);
    expect(parseNumericInput('  120  ')).toBe(120);
  });

  it('accepts a comma decimal separator', () => {
    expect(parseNumericInput('37,4')).toBe(37.4);
  });

  it('rejects non-numeric and empty input', () => {
    expect(parseNumericInput('')).toBeNull();
    expect(parseNumericInput('  ')).toBeNull();
    expect(parseNumericInput('.')).toBeNull();
    expect(parseNumericInput('-')).toBeNull();
    expect(parseNumericInput('abc')).toBeNull();
    expect(parseNumericInput('12px')).toBeNull();
    expect(parseNumericInput('Infinity')).toBeNull();
  });
});

describe('isWithinRange', () => {
  it('is inclusive of both bounds', () => {
    expect(isWithinRange(0, 0, 10)).toBe(true);
    expect(isWithinRange(10, 0, 10)).toBe(true);
    expect(isWithinRange(11, 0, 10)).toBe(false);
    expect(isWithinRange(-1, 0, 10)).toBe(false);
  });

  it('treats open (infinite) bounds as unbounded', () => {
    expect(isWithinRange(9999, 5, Infinity)).toBe(true);
    expect(isWithinRange(3, 5, Infinity)).toBe(false);
  });
});
