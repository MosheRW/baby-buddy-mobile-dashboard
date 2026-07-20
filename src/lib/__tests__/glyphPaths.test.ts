import { circlePath, dropPath, fitToGrid, roundedRect } from '../glyphPaths';

/** Every `A rx,ry` radius pair in a path. */
function arcRadii(d: string): number[] {
  return [...d.matchAll(/A(-?[\d.]+),(-?[\d.]+)/g)].flatMap((m) => [Number(m[1]), Number(m[2])]);
}

describe('roundedRect radius clamping', () => {
  it('shrinks radii that overflow the box, matching CSS', () => {
    // The tummy-time body: `border-radius: 0 7px 7px 0` on 14x7. Unclamped this
    // emits r=7 arcs on a 7-tall box, which renders as a spike rather than a
    // semicircular end. CSS scales by the tightest edge — here the right edge,
    // 7 / (7 + 7) = 0.5 — giving 3.5.
    const d = roundedRect(0, 0, 14, 7, 0, 7, 7, 0);
    expect(Math.max(...arcRadii(d))).toBeCloseTo(3.5);
  });

  it('turns a fully-rounded bar into a pill rather than overflowing', () => {
    // The sleep pillow: 18x8 at radius 6. Clamps to half the height.
    const d = roundedRect(0, 0, 18, 8, 6, 6, 6, 6);
    expect(Math.max(...arcRadii(d))).toBeCloseTo(4);
  });

  it('scales every corner by the same factor, not just the offending one', () => {
    // 16x11 with `6 6 8 8`: the vertical edges are tightest (11 / 14), so all
    // four shrink together and the two pairs stay in proportion.
    const d = roundedRect(0, 0, 16, 11, 6, 6, 8, 8);
    const radii = arcRadii(d);
    const f = 11 / 14;
    expect(Math.min(...radii)).toBeCloseTo(6 * f);
    expect(Math.max(...radii)).toBeCloseTo(8 * f);
  });

  it('leaves radii that already fit alone', () => {
    const d = roundedRect(0, 6, 16, 12, 3, 3, 3, 3);
    expect(Math.max(...arcRadii(d))).toBe(3);
  });

  it('omits arcs for square corners', () => {
    // A rect with no radii should be pure line commands.
    expect(roundedRect(0, 0, 10, 10, 0, 0, 0, 0)).not.toContain('A');
  });

  it('stays inside its declared box', () => {
    const d = roundedRect(0, 0, 14, 7, 0, 7, 7, 0);
    const coords = [...d.matchAll(/[MHV](-?[\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.min(...coords)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...coords)).toBeLessThanOrEqual(14);
  });
});

describe('circlePath', () => {
  it('starts at the left extreme and closes', () => {
    const d = circlePath(10, 5, 3);
    expect(d.startsWith('M7,5')).toBe(true);
    expect(d.trim().endsWith('Z')).toBe(true);
  });
});

describe('dropPath', () => {
  it('starts at the top point and spans the full box', () => {
    const d = dropPath(9, 13);
    expect(d.startsWith('M4.5,0')).toBe(true);
    const coords = [...d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].flatMap((m) => [
      Number(m[1]),
      Number(m[2]),
    ]);
    expect(Math.min(...coords)).toBeGreaterThanOrEqual(0);
  });
});

describe('fitToGrid', () => {
  it('centres a wide drawing and scales it to the inset', () => {
    const { scale, dx, dy } = fitToGrid(22, 15);
    expect(22 * scale).toBeCloseTo(22);
    expect(dx).toBeCloseTo(1);
    // Shorter axis gets more vertical padding.
    expect(dy).toBeGreaterThan(dx);
  });

  it('centres a square drawing evenly', () => {
    const { dx, dy } = fitToGrid(10, 10);
    expect(dx).toBeCloseTo(dy);
  });
});
