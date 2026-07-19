/**
 * Font loading. Bundles Nunito locally via @expo-google-fonts/nunito so there
 * is no runtime Google Fonts fetch (per the handoff). Weights: 400/600/700/800/900.
 */
import {
  useFonts,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';

export function useAppFonts(): boolean {
  const [loaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });
  return loaded;
}
