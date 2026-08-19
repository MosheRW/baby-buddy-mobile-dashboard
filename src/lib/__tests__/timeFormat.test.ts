import {
  formatClock,
  formatSpan,
  formatWidgetSpan,
  getActiveTimeFormat,
  setActiveTimeFormat,
} from '../timeFormat';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

describe('formatSpan', () => {
  it('renders "Xh Ym" / "Ym" in text format', () => {
    expect(formatSpan(2 * HOUR + 30 * MIN, 'text')).toBe('2h 30m');
    expect(formatSpan(12 * MIN, 'text')).toBe('12m');
  });
  it('renders "H:MM" (with a leading 0: under an hour) in digital format', () => {
    expect(formatSpan(2 * HOUR + 30 * MIN, 'digital')).toBe('2:30');
    expect(formatSpan(2 * HOUR + 5 * MIN, 'digital')).toBe('2:05');
    expect(formatSpan(12 * MIN, 'digital')).toBe('0:12');
  });
  it('is sign-insensitive and rounds to the nearest minute', () => {
    expect(formatSpan(-(45 * MIN), 'digital')).toBe('0:45');
    expect(formatSpan(90 * 1000, 'digital')).toBe('0:02'); // 1m30s rounds to 2m
  });
});

describe('formatWidgetSpan', () => {
  it('matches formatSpan text output in text mode', () => {
    expect(formatWidgetSpan(2 * HOUR + 30 * MIN, 'text')).toBe('2h 30m');
    expect(formatWidgetSpan(45 * MIN, 'text')).toBe('45m');
  });
  it('uses the colon form only for the 1h–under-24h band in digital mode', () => {
    expect(formatWidgetSpan(2 * HOUR, 'digital')).toBe('2:00');
    expect(formatWidgetSpan(7 * HOUR + 5 * MIN, 'digital')).toBe('7:05');
  });
  it('keeps text minutes under an hour in digital mode', () => {
    expect(formatWidgetSpan(45 * MIN, 'digital')).toBe('45m');
    expect(formatWidgetSpan(12 * MIN, 'digital')).toBe('12m');
  });
  it('falls back to text for a day or more in digital mode', () => {
    expect(formatWidgetSpan(25 * HOUR, 'digital')).toBe('25h 0m');
  });
  it('is sign-insensitive', () => {
    expect(formatWidgetSpan(-(2 * HOUR), 'digital')).toBe('2:00');
  });
});

describe('formatClock', () => {
  it('renders zero-padded mm:ss in text format, minutes unbounded', () => {
    expect(formatClock(5 * 1000, 'text')).toBe('00:05');
    expect(formatClock(65 * 60 * 1000, 'text')).toBe('65:00');
  });
  it('drops the leading zero and rolls into hours in digital format', () => {
    expect(formatClock(5 * 1000, 'digital')).toBe('0:05');
    expect(formatClock(65 * 1000, 'digital')).toBe('1:05');
    expect(formatClock(HOUR + 5 * MIN + 3 * 1000, 'digital')).toBe('1:05:03');
  });
  it('clamps a negative span to zero', () => {
    expect(formatClock(-1000, 'text')).toBe('00:00');
    expect(formatClock(-1000, 'digital')).toBe('0:00');
  });
});

describe('active time format', () => {
  afterEach(() => setActiveTimeFormat('text'));

  it('defaults to text and drives the format argument', () => {
    expect(getActiveTimeFormat()).toBe('text');
    expect(formatSpan(2 * HOUR + 30 * MIN)).toBe('2h 30m');
    setActiveTimeFormat('digital');
    expect(getActiveTimeFormat()).toBe('digital');
    expect(formatSpan(2 * HOUR + 30 * MIN)).toBe('2:30');
    expect(formatClock(65 * 1000)).toBe('1:05');
  });
});
