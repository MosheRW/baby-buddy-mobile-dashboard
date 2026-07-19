import type { EntryType } from '../api/types';

/** Params for the log-entry form when opened for create or edit. */
export interface LogEntryParams {
  mode: 'create' | 'edit';
  childId: string;
  /** Preselected entry type (e.g. from a quick-action button). */
  type?: EntryType;
  /** The entry being edited, when mode === 'edit'. */
  entryId?: string;
}

export interface DeleteConfirmParams {
  entryId: string;
  /** Human-readable description of the entry, shown in the sheet body. */
  entryLabel: string;
}

/** All stack screens. `Login` shows only while unauthenticated; the rest only
 * while authenticated (React Navigation's conditional-screens pattern). */
export type MainStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  LogEntry: LogEntryParams;
  Settings: undefined;
  DeleteConfirm: DeleteConfirmParams;
};
