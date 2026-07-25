/**
 * Default notification thresholds — plain numeric constants, deliberately kept
 * in their own side-effect-free module.
 *
 * The pure planner (`notifications.ts`) pulls in `i18n`, which self-initializes
 * on import; the persisted store only needs these numbers as seed values, so it
 * imports them from here instead of dragging the whole planner (and its startup
 * side effects) into its module graph. `notifications.ts` re-exports them, so
 * existing importers are unaffected.
 */

/**
 * Applied to every child once the diaper/food case is on, unless that child
 * carries its own threshold (in minutes). A per-child value of 0 opts out.
 */
export const DEFAULT_DIAPER_INTERVAL_MINUTES = 180;
export const DEFAULT_FOOD_INTERVAL_MINUTES = 240;

/**
 * Default forgotten-timer threshold for a *sleep* timer: a baby genuinely sleeps
 * for hours, so the short "you forgot to stop the timer" threshold that's
 * sensible for feeding/tummy-time would nag through every normal nap. Sleep gets
 * its own, longer threshold (user-configurable — see `forgottenTimer`); this is
 * just the default when the user hasn't changed it.
 */
export const DEFAULT_SLEEP_FORGOTTEN_MINUTES = 240;
