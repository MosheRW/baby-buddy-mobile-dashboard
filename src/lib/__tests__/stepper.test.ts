import { parseNumericInput, isWithinRange, splitMinutes, joinMinutes } from '../stepper';

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

describe('splitMinutes / joinMinutes', () => {
  it('splits a total into whole hours and remaining minutes', () => {
    expect(splitMinutes(0)).toEqual({ hours: 0, minutes: 0 });
    expect(splitMinutes(45)).toEqual({ hours: 0, minutes: 45 });
    expect(splitMinutes(60)).toEqual({ hours: 1, minutes: 0 });
    expect(splitMinutes(210)).toEqual({ hours: 3, minutes: 30 });
  });

  it('clamps negatives to zero and rounds fractional totals', () => {
    expect(splitMinutes(-10)).toEqual({ hours: 0, minutes: 0 });
    expect(splitMinutes(90.4)).toEqual({ hours: 1, minutes: 30 });
  });

  it('recombines an hours + minutes pair into a total', () => {
    expect(joinMinutes(0, 0)).toBe(0);
    expect(joinMinutes(2, 15)).toBe(135);
    expect(joinMinutes(3, 30)).toBe(210);
  });

  it('round-trips through split then join', () => {
    for (const total of [0, 5, 59, 60, 125, 210, 1440]) {
      const { hours, minutes } = splitMinutes(total);
      expect(joinMinutes(hours, minutes)).toBe(total);
    }
  });
});
