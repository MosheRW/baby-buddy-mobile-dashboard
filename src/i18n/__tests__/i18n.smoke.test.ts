import i18n, { resolveProfileLanguage } from '..';
import { timeAgo, greeting } from '../../lib/dates';
import { ageLabel } from '../../api/normalize';
import { neededStatusLabel } from '../../lib/medication';

const NOW = new Date(2026, 6, 19, 8, 0, 0).getTime();
const iso = (ms: number) => new Date(ms).toISOString();

afterAll(async () => {
  await i18n.changeLanguage('en');
});

describe('i18n Hebrew', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('he');
  });

  it('reports RTL direction for Hebrew', () => {
    expect(i18n.dir()).toBe('rtl');
  });

  it('translates dates and greeting', () => {
    expect(timeAgo(iso(NOW - 30 * 1000), NOW)).toBe('עכשיו');
    expect(timeAgo(iso(NOW - 45 * 60 * 1000), NOW)).toBe('לפני 45 דק׳');
    expect(greeting(NOW)).toBe('בוקר טוב');
  });

  it('pluralizes age with Hebrew CLDR forms', () => {
    expect(ageLabel('2026-07-18', Date.parse('2026-07-19T12:00:00Z'))).toBe('בן יום');
    expect(ageLabel('2026-07-07', Date.parse('2026-07-19T12:00:00Z'))).toBe('בן 12 ימים');
    expect(ageLabel('2024-07-19', Date.parse('2026-07-19T12:00:00Z'))).toBe('בן שנתיים');
  });

  // The notification copy added with the phase-aware action buttons (issue #45).
  // Structural parity is covered by locale-parity.test.ts; this checks the values
  // actually render — interpolation included — with Hebrew active.
  it('renders the notification action buttons in Hebrew', () => {
    expect(i18n.t('notifications.actionOk')).toBe('אישור');
    expect(i18n.t('notifications.actionRemindOnTime')).toBe('תזכיר לי בזמן');
    expect(
      i18n.t('notifications.actionCancelTimer', { activity: i18n.t('timer.typeLabel.sleep') }),
    ).toBe('ביטול שינה');
    expect(
      i18n.t('notifications.actionEndTimer', { activity: i18n.t('timer.typeLabel.tummyTime') }),
    ).toBe('סיום זמן בטן');
  });

  it('renders the feeding-gap phases in Hebrew', () => {
    const args = { child: 'אמה', duration: '15 דק׳', min: 120 };
    expect(i18n.t('notifications.foodBefore', args)).toBe('ההאכלה של אמה מתקרבת — בעוד 15 דק׳.');
    expect(i18n.t('notifications.foodAfter', args)).toBe(
      'ההאכלה של אמה הייתה אמורה להיות לפני 15 דק׳.',
    );
    expect(i18n.t('notifications.foodAfterMin', args)).toContain('120');
  });

  it('renders the log-entry modals in Hebrew', () => {
    expect(
      i18n.t('logEntry.cancelTimerTitle', { activity: i18n.t('logEntry.activity.sleep') }),
    ).toBe('לבטל את טיימר השינה?');
    expect(i18n.t('logEntry.quantityTitle', { child: 'אמה' })).toContain('אמה');
  });

  it('interpolates medication status', () => {
    const status = {
      name: 'x',
      entryId: 'e',
      unit: 'mg' as const,
      lastTakenAt: NOW,
      elapsedMs: 60 * 60 * 1000,
      dueAt: NOW,
      dueInMs: 60 * 60 * 1000,
      isDue: false,
      halfOver: false,
      urgent: false,
    };
    expect(neededStatusLabel(status)).toBe('1 ש׳ 0 דק׳ מאז המנה האחרונה');
  });
});

describe('resolveProfileLanguage', () => {
  it('maps Baby Buddy language codes to shipped languages', () => {
    expect(resolveProfileLanguage('he')).toBe('he');
    expect(resolveProfileLanguage('he-IL')).toBe('he');
    expect(resolveProfileLanguage('en-us')).toBe('en');
    expect(resolveProfileLanguage('fr')).toBe('en');
    expect(resolveProfileLanguage(undefined)).toBe('en');
  });
});
