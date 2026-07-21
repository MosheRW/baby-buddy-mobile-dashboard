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
import type { CaseSettings, TimingPrefs } from '../lib/notifications';

/** Cases that use the before/at/after timing model. */
export type TimingCaseId = 'scheduledMeds' | 'medEligibility';

export type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unsupported';

/** Per-child thresholds for the deferred diaper/food cases. */
export interface PerChildThresholds {
  diaperIntervalHours?: number;
  foodMinMl?: number;
  foodMinIntervalHours?: number;
}

interface NotificationState {
  masterEnabled: boolean;
  scheduledMeds: CaseSettings;
  medEligibility: CaseSettings;
  forgottenTimer: { enabled: boolean; thresholdMinutes: number };
  perChild: Record<string, PerChildThresholds>;
  /** Live OS permission state — not persisted. */
  permissionStatus: PermissionStatus;

  setMasterEnabled: (enabled: boolean) => void;
  setCaseEnabled: (id: TimingCaseId, enabled: boolean) => void;
  updateTiming: (id: TimingCaseId, patch: Partial<TimingPrefs>) => void;
  setForgottenTimerEnabled: (enabled: boolean) => void;
  setForgottenTimerMinutes: (minutes: number) => void;
  setPerChildThreshold: (childId: string, patch: Partial<PerChildThresholds>) => void;
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

      setPerChildThreshold: (childId, patch) =>
        set((state) => ({
          perChild: { ...state.perChild, [childId]: { ...state.perChild[childId], ...patch } },
        })),

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
