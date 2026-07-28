/**
 * Mirrors the persisted `timeFormat` preference into the module-level accessor
 * that the pure duration/timer formatters read (`lib/timeFormat.ts`).
 *
 * Written during render — like `ThemeProvider` does for the colour scheme — so
 * the module value is current on the same pass that re-renders the tree when
 * the preference changes. Mounted once at the root by `App`; because `App`
 * subscribes to the store here, a toggle re-renders everything below it, and
 * the formatters (which run during that render) pick up the new value
 * immediately rather than on the next minute/second tick.
 */
import { useSettingsStore } from '../stores';
import { setActiveTimeFormat } from '../lib/timeFormat';

export function useSyncTimeFormat(): void {
  const format = useSettingsStore((s) => s.timeFormat);
  setActiveTimeFormat(format);
}
