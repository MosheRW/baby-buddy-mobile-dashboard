import { brandAccentColor, DYNAMIC_ACCENT_HUE } from './accent';

describe('brandAccentColor', () => {
  it('reproduces the fixed terracotta accent at its own hue', () => {
    // Light `#E0906B` is ~H19 S65 L65; dark `#E9A588` is ~H18 S69 L72 — see palette.ts.
    expect(brandAccentColor(19, 'light')).toBe('hsl(19, 65%, 65%)');
    expect(brandAccentColor(18, 'dark')).toBe('hsl(18, 69%, 72%)');
  });

  it('normalizes hues outside 0-359', () => {
    expect(brandAccentColor(380, 'light')).toBe(brandAccentColor(20, 'light'));
    expect(brandAccentColor(-10, 'light')).toBe(brandAccentColor(350, 'light'));
  });

  it('changes only hue between schemes, not saturation/lightness character', () => {
    expect(brandAccentColor(200, 'light')).toBe('hsl(200, 65%, 65%)');
    expect(brandAccentColor(200, 'dark')).toBe('hsl(200, 69%, 72%)');
  });
});

describe('DYNAMIC_ACCENT_HUE', () => {
  it('is a sentinel outside the valid 0-359 hue range', () => {
    expect(DYNAMIC_ACCENT_HUE).toBeLessThan(0);
  });
});
