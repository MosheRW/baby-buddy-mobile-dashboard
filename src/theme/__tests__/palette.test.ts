import { PALETTES, type Scheme } from '../palette';

/** Recursively collect leaf paths → values, so nested tint objects are compared too. */
function leaves(value: unknown, prefix = ''): Record<string, unknown> {
  if (value == null || typeof value !== 'object') return { [prefix]: value };
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>(
    (acc, [key, v]) => Object.assign(acc, leaves(v, prefix ? `${prefix}.${key}` : key)),
    {},
  );
}

const SCHEMES: Scheme[] = ['light', 'dark'];

describe('palettes', () => {
  // The failure this guards against is specific: a colour key present in light
  // and missing in dark resolves to `undefined`, which React Native renders as
  // *transparent* rather than throwing — so it looks fine in every test and in
  // light mode, and shows up as an invisible label only on a dark device.
  it('define the same colour keys in both schemes', () => {
    // `cardBorder` is the one intentional asymmetry (dark-only) and has its own
    // test below; everything else must exist in both.
    const keys = (scheme: Scheme) =>
      Object.keys(leaves(PALETTES[scheme].colors))
        .filter((k) => k !== 'cardBorder')
        .sort();
    expect(keys('dark')).toEqual(keys('light'));
  });

  it('define the same tint keys in both schemes', () => {
    const light = Object.keys(leaves(PALETTES.light.tints)).sort();
    const dark = Object.keys(leaves(PALETTES.dark.tints)).sort();
    expect(dark).toEqual(light);
  });

  it('offer a swatch for every stool colour in both schemes', () => {
    for (const scheme of SCHEMES) {
      expect(Object.keys(PALETTES[scheme].pooSwatch).sort()).toEqual([
        'black',
        'brown',
        'green',
        'yellow',
      ]);
    }
  });

  it.each(SCHEMES)('has no empty or undefined colour values (%s)', (scheme) => {
    const { colors, tints, pooSwatch } = PALETTES[scheme];
    for (const [path, value] of Object.entries(leaves({ colors, tints, pooSwatch }))) {
      // `cardBorder` is deliberately absent in light — see the Card component.
      if (path === 'colors.cardBorder') continue;
      expect(typeof value === 'string' && value.length > 0).toBe(true);
    }
  });

  it('actually differs between the schemes on the core surfaces', () => {
    const { colors: light } = PALETTES.light;
    const { colors: dark } = PALETTES.dark;
    expect(dark.background).not.toBe(light.background);
    expect(dark.card).not.toBe(light.card);
    expect(dark.textPrimary).not.toBe(light.textPrimary);
  });

  it('only gives the dark scheme a card border', () => {
    // `Card` keys the hairline outline off this being defined, because a drop
    // shadow is invisible on a dark surface and a transparent border would
    // still inset the light layout by a hairline.
    expect(PALETTES.light.colors.cardBorder).toBeUndefined();
    expect(PALETTES.dark.colors.cardBorder).toBeDefined();
  });
});
