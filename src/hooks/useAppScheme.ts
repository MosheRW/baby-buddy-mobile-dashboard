/**
 * Resolves the appearance preference into the scheme actually being rendered:
 * an explicit `'light'`/`'dark'` choice wins, `'system'` follows the OS.
 *
 * Mirrors `useAppLanguage`'s override-then-fallback shape. Read at the root by
 * `App`, which feeds it to `ThemeProvider`.
 */
import { useColorScheme } from 'react-native';
import { useThemeStore } from '../stores';
import type { Scheme } from '../theme';

export function useEffectiveScheme(): Scheme {
  const preference = useThemeStore((s) => s.preference);
  // `useColorScheme` is null while the OS value is unknown (and always null on
  // some web/emulator setups), which resolves to light — the app's own default.
  const system = useColorScheme();
  if (preference === 'light' || preference === 'dark') return preference;
  return system === 'dark' ? 'dark' : 'light';
}
