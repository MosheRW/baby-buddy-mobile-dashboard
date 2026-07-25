import { text, weightFamily } from '../tokens';
import { avatarTint } from '../palette';
import { themeColors } from '../scheme';

describe('theme tokens', () => {
  it('builds a Nunito text style from size + weight', () => {
    const accent = themeColors().accent;
    expect(text(17, '800', accent)).toEqual({
      fontFamily: weightFamily['800'],
      fontSize: 17,
      color: accent,
    });
  });

  it('defaults to 600 weight and primary color', () => {
    const style = text(14);
    expect(style.fontFamily).toBe(weightFamily['600']);
    expect(style.color).toBe(themeColors().textPrimary);
  });

  it('produces a bg/fg pair for a child avatar hue and normalizes out-of-range hues', () => {
    expect(avatarTint(30)).toEqual({ bg: 'hsl(30, 45%, 90%)', fg: 'hsl(30, 45%, 42%)' });
    expect(avatarTint(390)).toEqual(avatarTint(30));
    expect(avatarTint(-330)).toEqual(avatarTint(30));
  });

  it('flips avatar lightness for the dark scheme', () => {
    expect(avatarTint(30, 'dark')).not.toEqual(avatarTint(30, 'light'));
  });
});
