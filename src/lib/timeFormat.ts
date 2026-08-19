/**
 * How elapsed spans and live timers are rendered.
 *
 * - `text`    — "2h 30m" / "12m", live timer "05:03". The original behaviour.
 * - `digital` — "2:30" / "0:12", live timer "5:03" / "1:05:03".
 *
 * The *preference* lives in `settingsStore`; this module keeps a mirror of the
 * active value so the pure formatters below (and the ones in `dates.ts` /
 * `medication.ts` that delegate here) can read it without a hook — exactly the
 * escape hatch `theme/scheme.ts` provides for the colour scheme. Components
 * re-render on a change because `useSyncTimeFormat` (mounted in `App`) writes
 * the value during render, re-rendering the tree beneath it.
 */
import i18n from '../i18n';

export type TimeFormat = 'text' | 'digital';

let active: TimeFormat = 'text';

/** The format currently in effect. Tests and pure callers may override it. */
export function getActiveTimeFormat(): TimeFormat {
  return active;
}

/** Called by `useSyncTimeFormat` only. */
export function setActiveTimeFormat(format: TimeFormat): void {
  active = format;
}

const MIN = 60 * 1000;

/**
 * An hours/minutes duration (minute granularity), e.g. a feeding length or a
 * medication countdown. Under an hour the `text` form drops the hour segment
 * ("0h 12m" reads like a placeholder); `digital` keeps a leading "0:" so it
 * still looks like a clock value.
 */
export function formatSpan(ms: number, format: TimeFormat = active): string {
  const totalMin = Math.round(Math.abs(ms) / MIN);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (format === 'digital') {
    return `${h}:${String(m).padStart(2, '0')}`;
  }
  return h > 0 ? i18n.t('duration.hoursMinutes', { h, m }) : i18n.t('duration.minutes', { m });
}

/**
 * A duration for the dashboard child card ("widget"). Text mode is identical to
 * `formatSpan`. Digital mode uses the clock form (`h:mm`) *only* for the
 * 1h–under-24h band — under an hour it keeps the text minutes ("45m") and a day
 * or more falls back to text too, because "0:12" and "25:00" read badly in the
 * card's compact stats. Scoped to the widget on purpose; `formatSpan` /
 * `countdownLabel` elsewhere keep their original digital form.
 */
export function formatWidgetSpan(ms: number, format: TimeFormat = active): string {
  if (format !== 'digital') {
    return formatSpan(ms, format);
  }
  const totalMin = Math.round(Math.abs(ms) / MIN);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 1 && h < 24) {
    return `${h}:${String(m).padStart(2, '0')}`;
  }
  return formatSpan(ms, 'text');
}

/**
 * A live, second-resolution timer readout.
 *
 * `text` matches the original: `MM:SS` with the minutes unbounded and both
 * fields zero-padded ("05:03", "65:03"). `digital` rolls minutes into an hours
 * segment once past an hour and drops the leading zero — "5:03" / "1:05:03"
 * ("hh:mm:ss when available").
 */
export function formatClock(ms: number, format: TimeFormat = active): string {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const s = totalSec % 60;
  if (format === 'digital') {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  const mm = Math.floor(totalSec / 60);
  return `${String(mm).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
