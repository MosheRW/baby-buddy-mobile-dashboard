/**
 * Data-source seam. Phase 2 uses an in-memory mock; Phase 5 swaps in a real
 * implementation backed by the Baby Buddy / Home Assistant APIs behind the same
 * interface. Screens depend on this interface, never on the mock module directly.
 */
import type { Child, Entry } from '../api/types';
import { mockChildren, mockEntries } from './mockData';

export interface DataSource {
  getChildren(): Promise<Child[]>;
  getEntries(): Promise<Entry[]>;
  createEntry(entry: Entry): Promise<Entry>;
  updateEntry(entry: Entry): Promise<Entry>;
  deleteEntry(id: string): Promise<void>;
}

/** Simple mutable in-memory source for Phase 2 development. */
function createMockDataSource(): DataSource {
  let children = [...mockChildren];
  let entries = [...mockEntries];

  return {
    async getChildren() {
      return children;
    },
    async getEntries() {
      return entries;
    },
    async createEntry(entry) {
      entries = [entry, ...entries];
      return entry;
    },
    async updateEntry(entry) {
      entries = entries.map((e) => (e.id === entry.id ? entry : e));
      return entry;
    },
    async deleteEntry(id) {
      entries = entries.filter((e) => e.id !== id);
    },
  };
}

export const dataSource: DataSource = createMockDataSource();
