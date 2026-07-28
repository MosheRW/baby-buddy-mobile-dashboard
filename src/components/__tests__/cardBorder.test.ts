import { StyleSheet } from 'react-native';
import { elevatedCardBorder } from '../cardBorder';

describe('elevatedCardBorder', () => {
  it('draws a hairline edge when the scheme defines a card border (dark)', () => {
    expect(elevatedCardBorder('#332B25')).toEqual({
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: '#332B25',
    });
  });

  it('returns a 0-width transparent border when the scheme has none (light)', () => {
    // Not undefined: a *present* border whose width updates to 0 is what lets
    // Android clear the dark hairline on a dark→light switch (#27). A 0-width
    // border adds no layout inset, so light renders exactly as before.
    expect(elevatedCardBorder(undefined)).toEqual({
      borderWidth: 0,
      borderColor: 'transparent',
    });
  });
});
