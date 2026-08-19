import { dayHeader, durationLabel, entryTimeLabel, greeting, timeAgo } from '../dates';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const NOW = new Date(2026, 6, 19, 12, 0, 0).getTime();

const iso = (ms: number) => new Date(ms).toISOString();

describe('timeAgo', () => {
  it('shows "now" under a minute', () => {
    expect(timeAgo(iso(NOW - 30 * 1000), NOW)).toBe('now');
  });
  it('shows minutes under an hour', () => {
    expect(timeAgo(iso(NOW - 45 * MIN), NOW)).toBe('45m ago');
  });
  it('shows hours (and minutes) under a day', () => {
    expect(timeAgo(iso(NOW - 3 * HOUR), NOW)).toBe('3h ago');
    expect(timeAgo(iso(NOW - (1 * HOUR + 20 * MIN)), NOW)).toBe('1h 20m ago');
  });
  it('shows days beyond 24h', () => {
    expect(timeAgo(iso(NOW - 2 * DAY), NOW)).toBe('2d ago');
  });

  describe('digital format', () => {
    it('renders the hours band as "h:mm ago"', () => {
      expect(timeAgo(iso(NOW - 3 * HOUR), NOW, 'digital')).toBe('3:00 ago');
      expect(timeAgo(iso(NOW - (3 * HOUR + 20 * MIN)), NOW, 'digital')).toBe('3:20 ago');
      expect(timeAgo(iso(NOW - (1 * HOUR + 5 * MIN)), NOW, 'digital')).toBe('1:05 ago');
    });
    it('keeps minutes and days as text', () => {
      expect(timeAgo(iso(NOW - 45 * MIN), NOW, 'digital')).toBe('45m ago');
      expect(timeAgo(iso(NOW - 2 * DAY), NOW, 'digital')).toBe('2d ago');
    });
  });
});

describe('entryTimeLabel', () => {
  it('uses the relative text form within 12h', () => {
    expect(entryTimeLabel(iso(NOW - 3 * HOUR), NOW)).toBe('3h ago');
    expect(entryTimeLabel(iso(NOW - 45 * MIN), NOW)).toBe('45m ago');
  });
  it('switches to a wall-clock time beyond 12h', () => {
    const label = entryTimeLabel(iso(NOW - 13 * HOUR), NOW);
    expect(label).not.toMatch(/ago/);
    expect(label).toMatch(/\d/);
  });
});

describe('durationLabel', () => {
  it('formats an explicit interval', () => {
    expect(durationLabel(iso(NOW - 80 * MIN), iso(NOW), NOW)).toBe('1h 20m');
  });
  it('formats minutes-only under an hour', () => {
    expect(durationLabel(iso(NOW - 12 * MIN), iso(NOW), NOW)).toBe('12m');
  });
  it('measures to now when no end is given', () => {
    expect(durationLabel(iso(NOW - 30 * MIN), undefined, NOW)).toBe('30m');
  });
  it('renders colon form in digital format', () => {
    expect(durationLabel(iso(NOW - 80 * MIN), iso(NOW), NOW, 'digital')).toBe('1:20');
    expect(durationLabel(iso(NOW - 12 * MIN), iso(NOW), NOW, 'digital')).toBe('0:12');
  });
});

describe('greeting', () => {
  it('varies by hour of day', () => {
    expect(greeting(new Date(2026, 6, 19, 8, 0).getTime())).toBe('Good morning');
    expect(greeting(new Date(2026, 6, 19, 14, 0).getTime())).toBe('Good afternoon');
    expect(greeting(new Date(2026, 6, 19, 20, 0).getTime())).toBe('Good evening');
  });
});

describe('dayHeader', () => {
  it('labels today and yesterday', () => {
    expect(dayHeader(iso(NOW - 2 * HOUR), NOW)).toBe('Today');
    expect(dayHeader(iso(NOW - 1 * DAY - 2 * HOUR), NOW)).toBe('Yesterday');
  });
});
