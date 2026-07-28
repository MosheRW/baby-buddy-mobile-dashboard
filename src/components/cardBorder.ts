import { StyleSheet, type ViewStyle } from 'react-native';

/**
 * The border style for an elevated `Card`.
 *
 * A drop shadow is invisible against a dark surface, so the dark palette
 * separates cards with a hairline edge (`colors.cardBorder`); light relies on
 * the shadow and draws no visible edge.
 *
 * The border is returned **unconditionally** — a 0-width, transparent border
 * when the scheme has none — rather than omitted in light. That matters on
 * Android: a border whose style is *dropped* on a dark→light switch isn't
 * repainted, so the dark hairline lingers around every card in light mode (the
 * bug in #27). Updating the width to 0 instead clears it reliably, and a
 * 0-width border — unlike a hairline transparent one — adds no layout inset.
 *
 * @param cardBorder the palette's hairline colour, or `undefined` when the
 *   scheme separates cards with a shadow instead of an edge.
 */
export function elevatedCardBorder(
  cardBorder: string | undefined,
): Pick<ViewStyle, 'borderWidth' | 'borderColor'> {
  return {
    borderWidth: cardBorder != null ? StyleSheet.hairlineWidth : 0,
    borderColor: cardBorder ?? 'transparent',
  };
}
