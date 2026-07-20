/**
 * Medication scheduling math, run client-side over fetched entries (same as the
 * prototype's neededList/eligibleList). Pure and unit-tested.
 *
 * Spec (from the design handoff):
 *  - "Needed" (scheduled): dedupe by name to the most-recent entry, compute
 *    nextDue = lastDose + repeatHours; include only if nextDue is within ±24h of
 *    now. Overdue when nextDue <= now.
 *  - "Eligible" (as-needed / PRN): dedupe by name among entries from the last
 *    10 days; same due math, framed as "eligible again". Eligible when due <= now.
 *  - Name suggestions: the 20 most-recent medication entries (any child),
 *    deduped by name, most recent first.
 */
import type { DosageUnit, Entry, MedicationEntry } from '../api/types';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// --- Dose units -------------------------------------------------------------

export interface DoseUnitSpec {
  /** Stepper increment. */
  step: number;
  /** Decimal places to render. */
  precision: number;
  /** Picker label. */
  label: string;
  /**
   * What follows the number. The word units keep a leading space ("5 tablets")
   * while the symbol units don't ("5mg") — matching the prototype.
   */
  suffix: string;
}

export const DOSE_UNITS: Record<DosageUnit, DoseUnitSpec> = {
  mg: { step: 1, precision: 0, label: 'mg', suffix: 'mg' },
  ml: { step: 0.1, precision: 1, label: 'ml', suffix: 'ml' },
  tablets: { step: 0.5, precision: 1, label: 'Tablets', suffix: ' tablets' },
  drops: { step: 1, precision: 0, label: 'Drops', suffix: ' drops' },
  paste: { step: 0.5, precision: 1, label: 'Paste', suffix: ' paste' },
};

/** The picker's order. */
export const DOSE_UNIT_ORDER: DosageUnit[] = ['mg', 'ml', 'tablets', 'drops', 'paste'];

export function doseFieldLabel(unit: DosageUnit): string {
  return `Dose (${DOSE_UNITS[unit].label})`;
}

/** "2.5ml" / "1 tablets" — the number formatted at its unit's precision. */
export function formatDose(dose: number, unit: DosageUnit): string {
  const spec = DOSE_UNITS[unit];
  return `${dose.toFixed(spec.precision)}${spec.suffix}`;
}

export interface MedStatus {
  name: string;
  /** Epoch ms when the next dose is due / eligible. */
  dueAt: number;
  /** ms until due; <= 0 means due now / overdue. */
  dueInMs: number;
  /** True once due (overdue for scheduled, eligible for PRN). */
  isDue: boolean;
}

function medicationEntries(entries: Entry[]): MedicationEntry[] {
  return entries.filter((e): e is MedicationEntry => e.type === 'medication');
}

function timeOf(e: MedicationEntry): number {
  return new Date(e.time).getTime();
}

/** Keep only the most-recent entry per (case-insensitive) medicine name. */
function dedupeByNameMostRecent(meds: MedicationEntry[]): MedicationEntry[] {
  const byName = new Map<string, MedicationEntry>();
  for (const m of meds) {
    const key = m.name.trim().toLowerCase();
    const existing = byName.get(key);
    if (!existing || timeOf(m) > timeOf(existing)) {
      byName.set(key, m);
    }
  }
  return [...byName.values()];
}

function toStatus(m: MedicationEntry, now: number): MedStatus {
  const dueAt = timeOf(m) + m.repeatHours * HOUR;
  const dueInMs = dueAt - now;
  return { name: m.name, dueAt, dueInMs, isDue: dueInMs <= 0 };
}

/** Scheduled meds whose next dose falls within ±24h of now, soonest first. */
export function neededMeds(entries: Entry[], now: number = Date.now()): MedStatus[] {
  const scheduled = medicationEntries(entries).filter((m) => m.schedule === 'scheduled');
  return dedupeByNameMostRecent(scheduled)
    .map((m) => toStatus(m, now))
    .filter((s) => Math.abs(s.dueInMs) <= DAY)
    .sort((a, b) => a.dueInMs - b.dueInMs);
}

/**
 * As-needed meds from the last 10 days, framed as "eligible again", soonest
 * first.
 *
 * Meds carrying a 24h limit are **excluded** — they get their own med-limit
 * tile instead, so the two dashboard sections stay disjoint rather than showing
 * the same medicine twice.
 */
export function eligibleMeds(entries: Entry[], now: number = Date.now()): MedStatus[] {
  const cutoff = now - 10 * DAY;
  const limited = limitedPairs(medicationEntries(entries));
  const prn = medicationEntries(entries).filter(
    (m) => m.schedule === 'asNeeded' && timeOf(m) >= cutoff && !limited.has(pairKey(m)),
  );
  return dedupeByNameMostRecent(prn)
    .map((m) => toStatus(m, now))
    .sort((a, b) => a.dueInMs - b.dueInMs);
}

/**
 * Medicine-name suggestions for the form: the 20 most-recent medication entries
 * (any child), deduped by name, most recent first. Returns the representative
 * entry per name so the form can prefill dose/repeat/schedule.
 */
export function medicationSuggestions(entries: Entry[]): MedicationEntry[] {
  const recent = medicationEntries(entries)
    .sort((a, b) => timeOf(b) - timeOf(a))
    .slice(0, 20);

  const seen = new Set<string>();
  const out: MedicationEntry[] = [];
  for (const m of recent) {
    const key = m.name.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(m);
    }
  }
  return out;
}

/** "Xh Ym" countdown for a positive ms duration (clamped at 0). */
export function countdownLabel(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m`;
}

// --- 24h dose limits --------------------------------------------------------
/**
 * `maxDose24h` is scoped to the **(medication name, child) pair**. It rides on
 * every entry, but the limit in force is the one from the most recent entry for
 * that pair.
 *
 * The child id is part of the grouping key rather than something the caller is
 * trusted to have filtered out first. That makes the "a limit set on Emma's
 * Tylenol shows up on Noah's" bug structurally impossible instead of merely
 * documented — these functions are correct on a mixed-child list too.
 *
 * Deviation from the prototype, deliberate: the most recent entry that
 * *specifies* a limit wins, rather than the most recent entry outright. Logging
 * a dose without filling the limit field in shouldn't silently erase the pair's
 * limit; editing an entry's limit still changes it.
 */

function pairKey(m: MedicationEntry): string {
  // NUL separator: it cannot appear in an id or a medicine name, so the
  // pair ('1','0a') and the pair ('10','a') cannot collide.
  return `${m.childId}\u0000${m.name.trim().toLowerCase()}`;
}

/** The limit in force per pair, newest-specified-wins. */
function limitsByPair(meds: MedicationEntry[]): Map<string, number> {
  const out = new Map<string, number>();
  const seenAt = new Map<string, number>();
  for (const m of meds) {
    if (m.maxDose24h == null) continue;
    const key = pairKey(m);
    const at = timeOf(m);
    const prev = seenAt.get(key);
    if (prev == null || at > prev) {
      seenAt.set(key, at);
      out.set(key, m.maxDose24h);
    }
  }
  return out;
}

function limitedPairs(meds: MedicationEntry[]): Set<string> {
  return new Set(limitsByPair(meds).keys());
}

export interface MedLimitSummary {
  name: string;
  childId: string;
  unit: DosageUnit;
  /** Total dose given in the trailing 24h. */
  taken: number;
  limit: number;
  /** `limit - taken`, floored at 0. */
  remaining: number;
  /**
   * 0–100 for the progress bar, with a 4% floor so a small first dose still
   * renders a visible sliver.
   */
  percent: number;
  atLimit: boolean;
  /** When the most recent dose of this pair was given, for a "last …" label. */
  lastTakenAt: number;
  /** Next-dose math, same as eligibleMeds. */
  dueAt: number;
  dueInMs: number;
  isDue: boolean;
}

/** One summary per (name, child) pair that has a limit. Sorted by name. */
export function medLimitSummaries(
  entries: Entry[],
  now: number = Date.now(),
): MedLimitSummary[] {
  const meds = medicationEntries(entries);
  const limits = limitsByPair(meds);
  if (limits.size === 0) return [];

  const cutoff = now - DAY;
  const takenByPair = new Map<string, number>();
  for (const m of meds) {
    if (timeOf(m) < cutoff) continue;
    const key = pairKey(m);
    if (!limits.has(key)) continue;
    takenByPair.set(key, (takenByPair.get(key) ?? 0) + m.dose);
  }

  // The representative entry per pair carries the display name and unit, and
  // its time drives the next-dose countdown.
  const latest = new Map<string, MedicationEntry>();
  for (const m of meds) {
    const key = pairKey(m);
    if (!limits.has(key)) continue;
    const prev = latest.get(key);
    if (!prev || timeOf(m) > timeOf(prev)) latest.set(key, m);
  }

  return [...latest.entries()]
    .map(([key, m]) => {
      const limit = limits.get(key) as number;
      const taken = round1(takenByPair.get(key) ?? 0);
      const status = toStatus(m, now);
      const raw = limit > 0 ? Math.round((taken / limit) * 100) : 100;
      return {
        name: m.name,
        childId: m.childId,
        unit: m.doseUnit,
        taken,
        limit,
        remaining: round1(Math.max(0, limit - taken)),
        percent: Math.max(4, Math.min(100, raw)),
        atLimit: taken >= limit,
        lastTakenAt: timeOf(m),
        dueAt: status.dueAt,
        dueInMs: status.dueInMs,
        isDue: status.isDue,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface MedBreakdownRow {
  name: string;
  childId: string;
  unit: DosageUnit;
  /** Total dose in the trailing 24h. */
  taken: number;
  /** Number of doses given in the trailing 24h. */
  doses: number;
  /** The pair's limit, or null when it has none. */
  limit: number | null;
  /** `limit - taken` floored at 0, or null with no limit. */
  remaining: number | null;
  atLimit: boolean;
}

/**
 * Everything given in the last 24h, one row per (name, child) pair — the
 * medication breakdown sheet behind the med-limit tile.
 *
 * The limit is resolved from the pair's full history, not just the 24h window,
 * so it doesn't vanish once the dose that carried it ages out.
 */
export function medBreakdown24h(
  entries: Entry[],
  now: number = Date.now(),
): MedBreakdownRow[] {
  const meds = medicationEntries(entries);
  const limits = limitsByPair(meds);
  const cutoff = now - DAY;

  const rows = new Map<string, MedBreakdownRow>();
  for (const m of meds.slice().sort((a, b) => timeOf(a) - timeOf(b))) {
    if (timeOf(m) < cutoff) continue;
    const key = pairKey(m);
    const row = rows.get(key) ?? {
      name: m.name,
      childId: m.childId,
      unit: m.doseUnit,
      taken: 0,
      doses: 0,
      limit: limits.get(key) ?? null,
      remaining: null,
      atLimit: false,
    };
    row.taken = round1(row.taken + m.dose);
    row.doses += 1;
    // Latest dose in the window decides how the row is labelled.
    row.unit = m.doseUnit;
    row.name = m.name;
    rows.set(key, row);
  }

  return [...rows.values()]
    .map((row) => ({
      ...row,
      remaining: row.limit == null ? null : round1(Math.max(0, row.limit - row.taken)),
      atLimit: row.limit != null && row.taken >= row.limit,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Doses are decimal; keep sums off floating-point noise like 4.699999999. */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
