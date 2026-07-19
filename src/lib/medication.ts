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
import type { Entry, MedicationEntry } from '../api/types';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

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

/** As-needed meds from the last 10 days, framed as "eligible again", soonest first. */
export function eligibleMeds(entries: Entry[], now: number = Date.now()): MedStatus[] {
  const cutoff = now - 10 * DAY;
  const prn = medicationEntries(entries).filter(
    (m) => m.schedule === 'asNeeded' && timeOf(m) >= cutoff,
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
