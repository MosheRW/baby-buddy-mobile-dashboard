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
import { DEFAULT_SLEEP_FORGOTTEN_MINUTES } from '../lib/notificationDefaults';
import type {
  CaseSettings,
  NotificationSettings,
  PerChildThresholds,
  TimingPrefs,
  WeeklySummarySettings,
} from '../lib/notifications';

export type { PerChildThresholds } from '../lib/notifications';

/** Cases that use the before/at/after timing model. */
export type TimingCaseId = 'scheduledMeds' | 'medEligibility' | 'foodMin';

/** Cases that are a single on/off with per-child thresholds. */
export type IntervalCaseId = 'diaperInterval';

export type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unsupported';

/**
 * Live OS state of the background-refresh capability — never persisted (the user
 * can change battery-optimization settings out from under us, so it's queried).
 * `available` = WorkManager will run our task; `restricted` = the OS is throttling
 * background work (battery optimization); `unsupported` = web/Expo Go; `unknown` =
 * not yet queried this launch.
 */
export type BackgroundStatus = 'available' | 'restricted' | 'unsupported' | 'unknown';

interface NotificationState {
  masterEnabled: boolean;
  scheduledMeds: CaseSettings;
  medEligibility: CaseSettings;
  forgottenTimer: { enabled: boolean; thresholdMinutes: number; sleepThresholdMinutes: number };
  diaperInterval: { enabled: boolean };
  foodMin: CaseSettings;
  liveTimer: { enabled: boolean };
  liveMed: { enabled: boolean };
  weeklySummary: WeeklySummarySettings;
  perChild: Record<string, PerChildThresholds>;
  /**
   * Opt-in periodic background refresh (`expo-background-task`). Off by default —
   * it's an extra battery cost the user approves. When on (and master on), a
   * WorkManager job re-fetches and re-plans notifications every ~15 min so a
   * reminder firing while the app is closed carries fresher data. See
   * `src/notifications/backgroundTask.ts`.
   */
  backgroundRefresh: { enabled: boolean };
  /**
   * Minutes to postpone a reminder by when the user taps "remind later" on the
   * forgotten-timer / diaper / food-min notifications (see
   * `src/notifications/service.ts`'s action categories). One global value —
   * these are all "time since X" nudges, so a single snooze length is enough.
   */
  snoozeMinutes: number;
  /**
   * Active snoozes, keyed by the `PlannedNotification.key` the reminder was
   * scheduled under, value = the epoch ms it's postponed to. Read by
   * `useNotificationSync` and folded into `buildNotifications` via
   * `NotificationBuildInput.snoozedUntil`. Persisted so a snooze survives the
   * app being killed before it re-fires; entries past their time are simply
   * ignored by the planner rather than actively pruned (see `snoozeNotification`).
   */
  snoozedUntil: Record<string, number>;
  /**
   * Reminders the user promoted with "remind me on time", keyed by the
   * **at-phase** key they asked for (`…:at`), value = the epoch ms the request
   * expires. Folded into `buildNotifications` via
   * `NotificationBuildInput.remindOnTime`, which makes the planner emit that
   * anchor's on-time reminder even though the "at" offset is switched off.
   * Persisted, for the same reason `snoozedUntil` is: the promotion has to
   * outlive the app being killed before the reminder fires.
   */
  remindOnTime: Record<string, number>;
  /** Live OS permission state — not persisted. */
  permissionStatus: PermissionStatus;
  /** Live background-task availability — not persisted. */
  backgroundStatus: BackgroundStatus;

  setMasterEnabled: (enabled: boolean) => void;
  setCaseEnabled: (id: TimingCaseId, enabled: boolean) => void;
  updateTiming: (id: TimingCaseId, patch: Partial<TimingPrefs>) => void;
  setForgottenTimerEnabled: (enabled: boolean) => void;
  setForgottenTimerMinutes: (minutes: number) => void;
  setForgottenTimerSleepMinutes: (minutes: number) => void;
  setLiveTimerEnabled: (enabled: boolean) => void;
  setLiveMedEnabled: (enabled: boolean) => void;
  setIntervalCaseEnabled: (id: IntervalCaseId, enabled: boolean) => void;
  setPerChildThreshold: (childId: string, patch: Partial<PerChildThresholds>) => void;
  updateWeeklySummary: (patch: Partial<WeeklySummarySettings>) => void;
  setBackgroundRefreshEnabled: (enabled: boolean) => void;
  setSnoozeMinutes: (minutes: number) => void;
  /** Postpone one reminder's next fire to `untilMs` — see `snoozedUntil`. */
  snoozeNotification: (key: string, untilMs: number) => void;
  /** Ask for one anchor's on-time reminder — see `remindOnTime`. */
  promoteNotification: (key: string, untilMs: number) => void;
  setPermissionStatus: (status: PermissionStatus) => void;
  setBackgroundStatus: (status: BackgroundStatus) => void;
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
      forgottenTimer: {
        enabled: true,
        thresholdMinutes: 30,
        sleepThresholdMinutes: DEFAULT_SLEEP_FORGOTTEN_MINUTES,
      },
      diaperInterval: { enabled: false },
      // Same shape as the medication cases (issue #45): "before" is off by
      // default so enabling feeding-gap reminders doesn't immediately produce two
      // notifications per feed.
      foodMin: { enabled: false, timing: defaultTiming({ before: false }) },
      // On by default — it's the point of this feature; the toggle is the opt-out.
      liveTimer: { enabled: true },
      // On by default too; supplements the fire-once "due" alert with a live
      // countdown. Only materializes on a build with the native chronometer module.
      liveMed: { enabled: true },
      // On by default (it's the point of the feature); the toggle is the opt-out.
      // Sunday 9am is a natural "week in review" slot and the start of the week
      // in the he locale too.
      weeklySummary: { enabled: true, weekday: 0, hour: 9 },
      perChild: {},
      // Opt-in: costs battery, so the user turns it on deliberately.
      backgroundRefresh: { enabled: false },
      snoozeMinutes: 15,
      snoozedUntil: {},
      remindOnTime: {},
      permissionStatus: 'undetermined',
      backgroundStatus: 'unknown',

      setMasterEnabled: (enabled) => set({ masterEnabled: enabled }),

      setCaseEnabled: (id, enabled) =>
        set(
          (state) => ({ [id]: { ...state[id], enabled } }) as Pick<NotificationState, TimingCaseId>,
        ),

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
        set((state) => ({
          forgottenTimer: { ...state.forgottenTimer, thresholdMinutes: minutes },
        })),

      setForgottenTimerSleepMinutes: (minutes) =>
        set((state) => ({
          forgottenTimer: { ...state.forgottenTimer, sleepThresholdMinutes: minutes },
        })),

      setLiveTimerEnabled: (enabled) => set({ liveTimer: { enabled } }),

      setLiveMedEnabled: (enabled) => set({ liveMed: { enabled } }),

      setIntervalCaseEnabled: (id, enabled) =>
        set(() => ({ [id]: { enabled } }) as Pick<NotificationState, IntervalCaseId>),

      setPerChildThreshold: (childId, patch) =>
        set((state) => ({
          perChild: { ...state.perChild, [childId]: { ...state.perChild[childId], ...patch } },
        })),

      updateWeeklySummary: (patch) =>
        set((state) => ({ weeklySummary: { ...state.weeklySummary, ...patch } })),

      setBackgroundRefreshEnabled: (enabled) => set({ backgroundRefresh: { enabled } }),

      setSnoozeMinutes: (minutes) => set({ snoozeMinutes: minutes }),

      snoozeNotification: (key, untilMs) =>
        set((state) => ({ snoozedUntil: { ...state.snoozedUntil, [key]: untilMs } })),

      promoteNotification: (key, untilMs) =>
        set((state) => ({ remindOnTime: { ...state.remindOnTime, [key]: untilMs } })),

      setPermissionStatus: (status) => set({ permissionStatus: status }),
      setBackgroundStatus: (status) => set({ backgroundStatus: status }),
    }),
    {
      name: 'notifications',
      version: 6,
      storage: createJSONStorage(() => asyncStorage),
      // permissionStatus / backgroundStatus are live OS state, not preferences —
      // never persist them.
      partialize: ({
        permissionStatus: _permissionStatus,
        backgroundStatus: _backgroundStatus,
        ...rest
      }) => rest,
      // v0 stored the diaper/food intervals in whole hours; v1 stores minutes so
      // the adaptive-step UI can offer 10-minute resolution. Convert per child.
      migrate: (persisted, version) => {
        let state = persisted as NotificationState;
        if (version < 1 && state?.perChild) {
          const perChild: Record<string, PerChildThresholds> = {};
          for (const [id, t] of Object.entries(state.perChild)) {
            const legacy = t as PerChildThresholds & {
              diaperIntervalHours?: number;
              foodMinIntervalHours?: number;
            };
            const { diaperIntervalHours, foodMinIntervalHours, ...rest } = legacy;
            perChild[id] = {
              ...rest,
              ...(diaperIntervalHours != null
                ? { diaperIntervalMinutes: diaperIntervalHours * 60 }
                : {}),
              ...(foodMinIntervalHours != null
                ? { foodMinIntervalMinutes: foodMinIntervalHours * 60 }
                : {}),
            };
          }
          state = { ...state, perChild };
        }
        // v2 split the forgotten-timer threshold into feeding/tummy-time vs. sleep;
        // pre-v2 state has no sleep threshold, so seed it with the default.
        if (version < 2 && state?.forgottenTimer?.sleepThresholdMinutes == null) {
          state = {
            ...state,
            forgottenTimer: {
              ...state.forgottenTimer,
              sleepThresholdMinutes: DEFAULT_SLEEP_FORGOTTEN_MINUTES,
            },
          };
        }
        // v3 added opt-in background refresh; pre-v3 state has no such preference,
        // so seed it off (the safe, no-extra-battery default).
        if (version < 3 && state?.backgroundRefresh == null) {
          state = { ...state, backgroundRefresh: { enabled: false } };
        }
        // v4 added the live medication countdown; pre-v4 state has no such
        // preference, so seed it on (matching the default) — the toggle is the opt-out.
        if (version < 4 && state?.liveMed == null) {
          state = { ...state, liveMed: { enabled: true } };
        }
        // v5 added the "remind later" notification action; pre-v5 state has
        // neither field, so seed the default snooze length and an empty map.
        if (version < 5 && state?.snoozeMinutes == null) {
          state = { ...state, snoozeMinutes: 15, snoozedUntil: {} };
        }
        // v6 gave the feeding-gap case the before/at/after timing model and added
        // the "remind me on time" promotions map. Pre-v6 state has a bare
        // `{ enabled }` for foodMin, which would leave `timing` undefined and make
        // the planner throw on the first rebuild.
        if (version < 6) {
          const legacyFood = state?.foodMin as Partial<CaseSettings> | undefined;
          if (legacyFood && legacyFood.timing == null) {
            state = {
              ...state,
              foodMin: { enabled: !!legacyFood.enabled, timing: defaultTiming({ before: false }) },
            };
          }
          if (state?.remindOnTime == null) state = { ...state, remindOnTime: {} };
        }
        return state;
      },
    },
  ),
);

/**
 * The slice the pure planner and validator read, picked out of the store state.
 * For imperative reads (`selectNotificationSettings(useNotificationStore.getState())`)
 * from code that runs outside render — notably the delivery-time validator, which
 * fires when the OS hands us a notification, long after any render.
 *
 * Not for use as a zustand selector: it builds a new object each call, which as a
 * subscription would re-render on every store write.
 */
export function selectNotificationSettings(s: NotificationState): NotificationSettings {
  return {
    masterEnabled: s.masterEnabled,
    scheduledMeds: s.scheduledMeds,
    medEligibility: s.medEligibility,
    forgottenTimer: s.forgottenTimer,
    diaperInterval: s.diaperInterval,
    foodMin: s.foodMin,
    liveTimer: s.liveTimer,
    liveMed: s.liveMed,
    weeklySummary: s.weeklySummary,
    perChild: s.perChild,
  };
}
