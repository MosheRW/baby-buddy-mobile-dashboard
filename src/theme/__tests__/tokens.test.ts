import { avatarTint, text, colors, weightFamily } from '../tokens';

describe('theme tokens', () => {
  it('builds a Nunito text style from size + weight', () => {
    expect(text(17, '800', colors.accent)).toEqual({
      fontFamily: weightFamily['800'],
      fontSize: 17,
      color: colors.accent,
    });
  });

  it('defaults to 600 weight and primary color', () => {
    const style = text(14);
    expect(style.fontFamily).toBe(weightFamily['600']);
    expect(style.color).toBe(colors.textPrimary);
  });

  it('produces a bg/fg pair for a child avatar hue and normalizes out-of-range hues', () => {
    expect(avatarTint(30)).toEqual({ bg: 'hsl(30, 45%, 90%)', fg: 'hsl(30, 45%, 42%)' });
    expect(avatarTint(390)).toEqual(avatarTint(30));
    expect(avatarTint(-330)).toEqual(avatarTint(30));
  });
});
