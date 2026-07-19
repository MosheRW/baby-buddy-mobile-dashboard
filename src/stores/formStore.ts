/**
 * In-progress log-entry form state. Not persisted (ephemeral per edit session).
 * The draft's shape and its conversions to/from a domain `Entry` are pure and
 * live in `src/lib/formDraft.ts`. Timers deliberately live in timerStore, not
 * here, so they survive the form closing.
 */
import { create } from 'zustand';
import type { EntryType } from '../api/types';
import { emptyDraft, type FormDraft } from '../lib/formDraft';

export type { FormDraft };

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
    draft?: FormDraft;
  }) => void;
  setType: (type: EntryType) => void;
  patchDraft: (patch: Partial<FormDraft>) => void;
  reset: () => void;
}

export const useFormStore = create<FormState>((set) => ({
  mode: 'create',
  type: 'diaper',
  childId: null,
  editingEntryId: null,
  draft: emptyDraft(),
  openForm: ({ mode, type, childId, editingEntryId = null, draft }) =>
    set({ mode, type, childId, editingEntryId, draft: draft ?? emptyDraft() }),
  // Switching type keeps the draft: the fields are one flat record, so the
  // user's diaper toggles survive a detour through Feeding and back.
  setType: (type) => set({ type }),
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
