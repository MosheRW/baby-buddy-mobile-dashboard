import { parseNumericInput, isWithinRange } from '../stepper';

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
