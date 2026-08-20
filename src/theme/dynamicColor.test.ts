import { hexToHue } from './dynamicColor';

describe('hexToHue', () => {
  it('matches the light palette terracotta accent (~H19)', () => {
    expect(hexToHue('#E0906B')).toBeCloseTo(19, 0);
  });

  it('matches the dark palette terracotta accent (~H18)', () => {
    expect(hexToHue('#E9A588')).toBeCloseTo(18, 0);
  });

  it('resolves primary hues correctly', () => {
    expect(hexToHue('#FF0000')).toBeCloseTo(0, 0);
    expect(hexToHue('#00FF00')).toBeCloseTo(120, 0);
    expect(hexToHue('#0000FF')).toBeCloseTo(240, 0);
  });

  it('returns 0 for a greyscale colour with no hue', () => {
    expect(hexToHue('#808080')).toBe(0);
  });
});
