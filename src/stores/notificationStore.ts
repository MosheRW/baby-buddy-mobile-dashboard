/**
 * Notification preferences. Persisted to AsyncStorage (non-secret).
 *
 * The four fields the pure planner reads (`masterEnabled`, `scheduledMeds`,
 * `medEligibility`, `forgottenTimer`) match `NotificationSettings` in
 * `src/lib/notifications.ts` so the sync hook can hand a slice straight to
 * `buildNotifications`.
 *
 * `perChild` holds the diaper-interval / food-min thresholds for the deferred
 * cases — stored now so those cases can be added without a storage migration.
 * `permissionStatus` mirrors the OS state and is deliberately **not persisted**:
 * the user can revoke permission in system settings, so it's queried live.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { asyncStorage } from './storage';
import type {
  CaseSettings,
  PerChildThresholds,
  TimingPrefs,
  WeeklySummarySettings,
} from '../lib/notifications';

export type { PerChildThresholds } from '../lib/notifications';

/** Cases that use the before/at/after timing model. */
export type TimingCaseId = 'scheduledMeds' | 'medEligibility';

/** Cases that are a single on/off with per-child thresholds. */
export type IntervalCaseId = 'diaperInterval' | 'foodMin';

export type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unsupported';

interface NotificationState {
  masterEnabled: boolean;
  scheduledMeds: CaseSettings;
  medEligibility: CaseSettings;
  forgottenTimer: { enabled: boolean; thresholdMinutes: number };
  diaperInterval: { enabled: boolean };
  foodMin: { enabled: boolean };
  weeklySummary: WeeklySummarySettings;
  perChild: Record<string, PerChildThresholds>;
  /** Live OS permission state — not persisted. */
  permissionStatus: PermissionStatus;

  setMasterEnabled: (enabled: boolean) => void;
  setCaseEnabled: (id: TimingCaseId, enabled: boolean) => void;
  updateTiming: (id: TimingCaseId, patch: Partial<TimingPrefs>) => void;
  setForgottenTimerEnabled: (enabled: boolean) => void;
  setForgottenTimerMinutes: (minutes: number) => void;
  setIntervalCaseEnabled: (id: IntervalCaseId, enabled: boolean) => void;
  setPerChildThreshold: (childId: string, patch: Partial<PerChildThresholds>) => void;
  updateWeeklySummary: (patch: Partial<WeeklySummarySettings>) => void;
  setPermissionStatus: (status: PermissionStatus) => void;
}

const defaultTiming = (over: Partial<TimingPrefs> = {}): TimingPrefs => ({
  before: true,
  beforeMinutes: 15,
  at: true,
  after: false,
  afterMinutes: 15,
  ...over,
});

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      masterEnabled: false,
      scheduledMeds: { enabled: true, timing: defaultTiming() },
      medEligibility: { enabled: true, timing: defaultTiming({ before: false, afterMinutes: 30 }) },
      forgottenTimer: { enabled: true, thresholdMinutes: 30 },
      diaperInterval: { enabled: false },
      foodMin: { enabled: false },
      // On by default (it's the point of the feature); the toggle is the opt-out.
      // Sunday 9am is a natural "week in review" slot and the start of the week
      // in the he locale too.
      weeklySummary: { enabled: true, weekday: 0, hour: 9 },
      perChild: {},
      permissionStatus: 'undetermined',

      setMasterEnabled: (enabled) => set({ masterEnabled: enabled }),

      setCaseEnabled: (id, enabled) =>
        set((state) => ({ [id]: { ...state[id], enabled } }) as Pick<NotificationState, TimingCaseId>),

      updateTiming: (id, patch) =>
        set(
          (state) =>
            ({ [id]: { ...state[id], timing: { ...state[id].timing, ...patch } } }) as Pick<
              NotificationState,
              TimingCaseId
            >,
        ),

      setForgottenTimerEnabled: (enabled) =>
        set((state) => ({ forgottenTimer: { ...state.forgottenTimer, enabled } })),

      setForgottenTimerMinutes: (minutes) =>
        set((state) => ({ forgottenTimer: { ...state.forgottenTimer, thresholdMinutes: minutes } })),

      setIntervalCaseEnabled: (id, enabled) =>
        set(() => ({ [id]: { enabled } }) as Pick<NotificationState, IntervalCaseId>),

      setPerChildThreshold: (childId, patch) =>
        set((state) => ({
          perChild: { ...state.perChild, [childId]: { ...state.perChild[childId], ...patch } },
        })),

      updateWeeklySummary: (patch) =>
        set((state) => ({ weeklySummary: { ...state.weeklySummary, ...patch } })),

      setPermissionStatus: (status) => set({ permissionStatus: status }),
    }),
    {
      name: 'notifications',
      storage: createJSONStorage(() => asyncStorage),
      // permissionStatus is live OS state, not a preference — never persist it.
      partialize: ({ permissionStatus: _permissionStatus, ...rest }) => rest,
    },
  ),
);
