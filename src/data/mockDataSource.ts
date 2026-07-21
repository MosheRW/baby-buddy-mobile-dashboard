/**
 * In-memory data source used for development and the emulator-free web QA
 * preview (see USE_MOCK_DATA in dataSource.ts). Mirrors the real source's
 * behaviour closely enough to exercise the UI without a server.
 */
import type { DataSource } from '../api/babybuddy';
import type { Entry } from '../api/types';
import type { RunningTimer } from '../lib/timers';
import { mockChildren, mockEntries } from './mockData';

export function createMockDataSource(): DataSource {
  const children = [...mockChildren];
  let entries = [...mockEntries];
  let nextId = 1000;
  // Stands in for the server's timer table so reconciliation has something real
  // to reconcile against in mock mode.
  let timers: RunningTimer[] = [];
  let nextTimerId = 1;

  return {
    async getChildren() {
      return children;
    },
    async getEntries() {
      return [...entries].sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
    },
    async createEntry(entry) {
      // Mimic the server assigning the id, so ids stay namespaced like the real ones.
      const saved: Entry = { ...entry, id: `${entry.type}:${nextId++}` };
      entries = [saved, ...entries];
      return saved;
    },
    async updateEntry(entry) {
      entries = entries.map((e) => (e.id === entry.id ? entry : e));
      return entry;
    },
    async deleteEntry(id) {
      entries = entries.filter((e) => e.id !== id);
    },
    async getTimers() {
      return [...timers];
    },
    async startTimer(type, childId, startedAt) {
      const timer: RunningTimer = { type, childId, startedAt, serverTimerId: nextTimerId++ };
      // One per (type, child), same rule the app enforces locally.
      timers = [...timers.filter((t) => !(t.type === type && t.childId === childId)), timer];
      return timer;
    },
    async stopTimer(serverTimerId) {
      timers = timers.filter((t) => t.serverTimerId !== serverTimerId);
    },
    async updateTimerStart(serverTimerId, startedAt) {
      timers = timers.map((t) => (t.serverTimerId === serverTimerId ? { ...t, startedAt } : t));
      const updated = timers.find((t) => t.serverTimerId === serverTimerId);
      if (!updated) throw new Error(`No mock timer with id ${serverTimerId}.`);
      return updated;
    },
  };
}
