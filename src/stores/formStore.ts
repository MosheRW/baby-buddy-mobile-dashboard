/**
 * In-progress log-entry form state. Not persisted (ephemeral per edit session).
 * The `draft` is a loose bag here; Phase 4 gives it a per-type typed shape as it
 * builds the full form. Timers deliberately live in timerStore, not here, so
 * they survive the form closing.
 */
import { create } from 'zustand';
import type { EntryType, Tag } from '../api/types';

export interface FormDraft {
  time: string; // ISO
  note: string;
  tags: Tag[];
  // Per-type fields are added ad hoc in Phase 4 (pee/poo, kind/method, dose, …).
  [key: string]: unknown;
}

interface FormState {
  mode: 'create' | 'edit';
  type: EntryType;
  childId: string | null;
  editingEntryId: string | null;
  draft: FormDraft;
  openForm: (params: {
    mode: 'create' | 'edit';
    type: EntryType;
    childId: string;
    editingEntryId?: string | null;
    draft?: Partial<FormDraft>;
  }) => void;
  patchDraft: (patch: Partial<FormDraft>) => void;
  reset: () => void;
}

function emptyDraft(): FormDraft {
  return { time: new Date().toISOString(), note: '', tags: [] };
}

export const useFormStore = create<FormState>((set) => ({
  mode: 'create',
  type: 'diaper',
  childId: null,
  editingEntryId: null,
  draft: emptyDraft(),
  openForm: ({ mode, type, childId, editingEntryId = null, draft }) =>
    set({
      mode,
      type,
      childId,
      editingEntryId,
      draft: { ...emptyDraft(), ...draft },
    }),
  patchDraft: (patch) => set((state) => ({ draft: { ...state.draft, ...patch } })),
  reset: () =>
    set({
      mode: 'create',
      type: 'diaper',
      childId: null,
      editingEntryId: null,
      draft: emptyDraft(),
    }),
}));
