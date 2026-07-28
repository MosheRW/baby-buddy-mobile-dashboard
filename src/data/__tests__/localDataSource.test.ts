/**
 * The offline data source, tested over a hermetic vanilla store (the slice
 * creator with no persistence), so there's no AsyncStorage or singleton state to
 * reset between cases.
 */
import { createStore } from 'zustand/vanilla';
import { createLocalDataSlice, type LocalDataState } from '../localDataStore';
import { createLocalDataSource } from '../localDataSource';
import type { DiaperEntry, Entry } from '../../api/types';

// The store module pulls in storage.ts → AsyncStorage at import time. These tests
// use a persistence-free vanilla store, but the import still needs the native
// module mocked out. (jest.mock is hoisted above the imports by babel-jest.)
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

function freshStore() {
  return createStore<LocalDataState>()(createLocalDataSlice);
}

function diaper(childId: string, time: string): DiaperEntry {
  return {
    id: '',
    childId,
    type: 'diaper',
    time,
    tags: [{ label: 'by Me', author: true }],
    creator: 'Me',
    pee: true,
    poo: false,
  };
}

const BIRTH = '2025-01-01T00:00:00.000Z';

describe('createLocalDataSource', () => {
  it('starts with no children and no entries', async () => {
    const source = createLocalDataSource(freshStore());
    expect(await source.getChildren()).toEqual([]);
    expect(await source.getEntries()).toEqual([]);
    expect(await source.getTimers()).toEqual([]);
  });

  it('exposes added children with a recomputed age label and a stable initial', async () => {
    const store = freshStore();
    const source = createLocalDataSource(store);
    const child = store.getState().addChild({ name: 'emma', birthDate: BIRTH });

    const [fetched] = await source.getChildren();
    expect(fetched.id).toBe(child.id);
    expect(fetched.name).toBe('emma');
    expect(fetched.initial).toBe('E');
    // ageLabel is localized+pluralized; here we just assert it produced a label.
    expect(fetched.age).not.toBe('');
  });

  it('folds a per-child default-food override into getChildren', async () => {
    const store = freshStore();
    const source = createLocalDataSource(store, (id) => (id === '1' ? 200 : undefined));
    store.getState().addChild({ name: 'Emma', birthDate: BIRTH, defaultFoodMl: 120 });

    const [child] = await source.getChildren();
    expect(child.id).toBe('1');
    expect(child.defaultFoodMl).toBe(200);
  });

  it('mints a namespaced id on create and round-trips update and delete', async () => {
    const store = freshStore();
    const source = createLocalDataSource(store);

    const created = await source.createEntry(diaper('1', '2026-01-01T10:00:00.000Z'));
    expect(created.id).toBe('diaper:1');

    const edited = await source.updateEntry({ ...created, poo: true } as DiaperEntry);
    expect((edited as DiaperEntry).poo).toBe(true);
    expect((await source.getEntries())[0]).toMatchObject({ id: 'diaper:1', poo: true });

    await source.deleteEntry(created.id);
    expect(await source.getEntries()).toEqual([]);
  });

  it('returns entries newest-first regardless of insertion order', async () => {
    const store = freshStore();
    const source = createLocalDataSource(store);
    await source.createEntry(diaper('1', '2026-01-01T08:00:00.000Z'));
    await source.createEntry(diaper('1', '2026-01-01T12:00:00.000Z'));
    await source.createEntry(diaper('1', '2026-01-01T10:00:00.000Z'));

    const times = (await source.getEntries()).map((e) => e.time);
    expect(times).toEqual([
      '2026-01-01T12:00:00.000Z',
      '2026-01-01T10:00:00.000Z',
      '2026-01-01T08:00:00.000Z',
    ]);
  });

  it('keeps one timer per (type, child) and drops it on stop', async () => {
    const store = freshStore();
    const source = createLocalDataSource(store);

    const first = await source.startTimer('feeding', '1', 1000);
    const second = await source.startTimer('feeding', '1', 2000);
    const timers = await source.getTimers();
    expect(timers).toHaveLength(1);
    expect(timers[0].startedAt).toBe(2000);
    expect(second.serverTimerId).not.toBe(first.serverTimerId);

    await source.stopTimer(second.serverTimerId as number);
    expect(await source.getTimers()).toEqual([]);
  });

  it('adjusts a running timer start and rejects an unknown id', async () => {
    const store = freshStore();
    const source = createLocalDataSource(store);
    const timer = await source.startTimer('sleep', '1', 1000);

    const moved = await source.updateTimerStart(timer.serverTimerId as number, 500);
    expect(moved.startedAt).toBe(500);
    await expect(source.updateTimerStart(9999, 0)).rejects.toThrow();
  });

  it('removing a child cascades to its entries and timers, sparing siblings', async () => {
    const store = freshStore();
    const source = createLocalDataSource(store);
    const emma = store.getState().addChild({ name: 'Emma', birthDate: BIRTH });
    const noah = store.getState().addChild({ name: 'Noah', birthDate: BIRTH });

    await source.createEntry(diaper(emma.id, '2026-01-01T10:00:00.000Z'));
    const keep = (await source.createEntry(
      diaper(noah.id, '2026-01-01T11:00:00.000Z'),
    )) as Entry;
    await source.startTimer('feeding', emma.id, 1000);

    store.getState().removeChild(emma.id);

    expect((await source.getChildren()).map((c) => c.id)).toEqual([noah.id]);
    expect((await source.getEntries()).map((e) => e.id)).toEqual([keep.id]);
    expect(await source.getTimers()).toEqual([]);
  });

  it('starts un-hydrated and flips on setHydrated', () => {
    const store = freshStore();
    expect(store.getState().hydrated).toBe(false);
    store.getState().setHydrated();
    expect(store.getState().hydrated).toBe(true);
  });

  it('renaming a child refreshes its initial', () => {
    const store = freshStore();
    const child = store.getState().addChild({ name: 'Emma', birthDate: BIRTH });
    store.getState().updateChild(child.id, { name: 'zoe' });
    const updated = store.getState().children[0];
    expect(updated.name).toBe('zoe');
    expect(updated.initial).toBe('Z');
  });
});
