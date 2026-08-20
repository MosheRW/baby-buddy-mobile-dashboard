import type { EntryType } from '../api/types';

/** Params for the log-entry form when opened for create or edit. */
export interface LogEntryParams {
  mode: 'create' | 'edit';
  childId: string;
  /** Preselected entry type (e.g. from a quick-action button). */
  type?: EntryType;
  /** The entry being edited, when mode === 'edit'. */
  entryId?: string;
  /**
   * Create mode only: an existing medication entry to seed the draft from, so
   * tapping a med row on the dashboard opens a pre-filled repeat dose.
   */
  prefillMedEntryId?: string;
}

export interface DeleteConfirmParams {
  entryId: string;
  /** Human-readable description of the entry, shown in the sheet body. */
  entryLabel: string;
}

export interface MedBreakdownParams {
  childId: string;
  /** Shown as the sheet's subtitle, so the sheet needs no child lookup. */
  childName: string;
}

export interface KidEditorParams {
  childId: string;
}

export interface GroupEditorParams {
  groupId: string;
}

/** All stack screens. `Login`/`ScanLogin` show only while unauthenticated; the
 * rest only while authenticated (React Navigation's conditional-screens pattern). */
export type MainStackParamList = {
  Login: undefined;
  /** Camera QR scanner reached from the login screen (unauthenticated). */
  ScanLogin: undefined;
  Dashboard: undefined;
  LogEntry: LogEntryParams;
  Settings: undefined;
  Notifications: undefined;
  AdvancedSettings: undefined;
  /** Admin-only: manage caregivers and generate join QR codes (Issue #34). */
  ShareInstance: undefined;
  KidEditor: KidEditorParams;
  GroupEditor: GroupEditorParams;
  DeleteConfirm: DeleteConfirmParams;
  MedBreakdown: MedBreakdownParams;
  /**
   * On-demand weekly contribution recap. Takes no params: it reads the timeline
   * from React Query and the caregiver + visibility/grouping from the stores.
   */
  Contribution: undefined;
};
