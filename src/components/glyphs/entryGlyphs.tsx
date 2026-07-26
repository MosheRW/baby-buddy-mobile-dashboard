/**
 * Entry-type and sub-type glyphs for the refreshed design (Phase 8, Batch C).
 *
 * These are **filled** shapes, unlike the stroked UI-chrome glyphs in
 * `./index.tsx` — the updated prototype draws every entry icon as solid
 * composed `<div>`s sitting on a tinted swatch, and a stroked outline reads
 * quite differently at 18px. Chrome glyphs (chevron, close, gear, ±) stay
 * stroked; they're affordances, not entry icons.
 *
 * Each glyph is authored in the **prototype's own pixel space** and scaled to
 * the 24×24 grid by `GlyphFrame`. That's deliberate: every number below can be
 * checked directly against `Baby Buddy Dashboard App.dc.html` without mentally
 * converting units. Sizes and offsets are transcribed from the feed's icon
 * block; the sleep/tummy/note shapes additionally match the signed-off
 * `Entry Icon Options.dc.html` picks (tummy 1a, note 2a, nap 3c, night 3d).
 */
import React from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
// `themeColors()` rather than `useTheme()`: `color` is a *default parameter*,
// evaluated on every call, so it already picks up the active scheme — and that
// keeps ~25 tiny glyph functions hook-free. Call sites almost always pass an
// explicit colour anyway.
import { themeColors } from '../../theme';
import type { EntryType } from '../../api/types';
import type { GlyphKind } from '../../lib/entryDisplay';
import { circlePath, dropPath, fitToGrid, roundedRect as rr } from '../../lib/glyphPaths';

export interface EntryGlyphProps {
  size?: number;
  color?: string;
}

/**
 * Scales a glyph authored at `w`×`h` prototype pixels into the shared 24×24
 * viewBox, centred, leaving a little breathing room inside the swatch.
 */
function GlyphFrame({
  size = 18,
  w,
  h,
  children,
}: {
  size?: number;
  w: number;
  h: number;
  children: React.ReactNode;
}) {
  const { scale, dx, dy } = fitToGrid(w, h);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G transform={`translate(${dx}, ${dy}) scale(${scale})`}>{children}</G>
    </Svg>
  );
}

// --- Diaper -----------------------------------------------------------------

export function DiaperPeeGlyph({ size, color = themeColors().textPrimary }: EntryGlyphProps) {
  return (
    <GlyphFrame size={size} w={9} h={13}>
      <Path d={dropPath(9, 13)} fill={color} />
    </GlyphFrame>
  );
}

export function DiaperPooGlyph({ size, color = themeColors().textPrimary }: EntryGlyphProps) {
  return (
    <GlyphFrame size={size} w={16} h={11}>
      <Path d={rr(0, 0, 16, 11, 6, 6, 8, 8)} fill={color} />
    </GlyphFrame>
  );
}

export function DiaperBothGlyph({ size, color = themeColors().textPrimary }: EntryGlyphProps) {
  // Droplet + mound side by side, bottoms aligned, 3px gap.
  return (
    <GlyphFrame size={size} w={21} h={10}>
      <G transform="translate(0, 0)">
        <Path d={dropPath(7, 10)} fill={color} />
      </G>
      <G transform="translate(10, 1)">
        <Path d={rr(0, 0, 11, 9, 5, 5, 6, 6)} fill={color} />
      </G>
    </GlyphFrame>
  );
}

// --- Feeding ----------------------------------------------------------------

export function FeedingBottleGlyph({ size, color = themeColors().textPrimary }: EntryGlyphProps) {
  return (
    <GlyphFrame size={size} w={16} h={18}>
      <Path d={rr(5, 0, 6, 3, 2, 2, 1, 1)} fill={color} />
      <Rect x={5.5} y={3} width={5} height={3} fill={color} />
      <Path d={rr(0, 6, 16, 12, 3, 3, 3, 3)} fill={color} />
    </GlyphFrame>
  );
}

export function FeedingBreastGlyph({ size, color = themeColors().textPrimary }: EntryGlyphProps) {
  // border-radius: 20% 75% 75% 20% / 30% 70% 70% 30% on an 11x15 box — square
  // on the left, strongly rounded on the right.
  const d = [
    'M2.2,0',
    'H2.75',
    'A8.25,10.5 0 0 1 11,7.5',
    'A8.25,10.5 0 0 1 2.75,15',
    'H2.2',
    'A2.2,4.5 0 0 1 0,10.5',
    'V4.5',
    'A2.2,4.5 0 0 1 2.2,0',
    'Z',
  ].join(' ');
  return (
    <GlyphFrame size={size} w={12.5} h={15}>
      <Path d={d} fill={color} />
      <Circle cx={11} cy={7.5} r={1.5} fill={color} />
    </GlyphFrame>
  );
}

export function FeedingSolidGlyph({ size, color = themeColors().textPrimary }: EntryGlyphProps) {
  // Bowl + a single utensil stem.
  return (
    <GlyphFrame size={size} w={16} h={12}>
      <Path d={rr(0, 3, 16, 9, 0, 0, 8, 8)} fill={color} />
      <Rect x={7} y={0} width={2} height={7} fill={color} />
    </GlyphFrame>
  );
}

export function FeedingFortifiedGlyph({
  size,
  color = themeColors().textPrimary,
}: EntryGlyphProps) {
  // The formula bottle with a small ring at the shoulder — the prototype's mark
  // for fortified breast milk (a bottle "plus something extra").
  return (
    <GlyphFrame size={size} w={16} h={16}>
      <Path d={rr(4, 2, 6, 3, 2, 2, 1, 1)} fill={color} />
      <Rect x={4.5} y={5} width={5} height={2.5} fill={color} />
      <Path d={rr(0, 7, 13, 9, 3, 3, 3, 3)} fill={color} />
      <Circle cx={13.5} cy={3} r={2.7} fill="none" stroke={color} strokeWidth={1.5} />
    </GlyphFrame>
  );
}

/**
 * A single breast, rounded on the feeding side with the nipple on that edge —
 * `side` picks left- or right-facing. Corner radii mirror the prototype's CSS
 * `border-radius` (20%/75% swapped per side). Shared by the Left/Right method
 * chips so the pair reads as a matched set.
 */
function BreastGlyph({
  size,
  color = themeColors().textPrimary,
  side,
}: EntryGlyphProps & { side: 'left' | 'right' }) {
  const W = 8;
  const H = 12;
  const big = 6;
  const sm = 1.6;
  const body =
    side === 'right' ? rr(0, 0, W, H, sm, big, big, sm) : rr(0, 0, W, H, big, sm, sm, big);
  const nx = side === 'right' ? W - 0.3 : 0.3;
  return (
    <GlyphFrame size={size} w={W} h={H}>
      <Path d={body} fill={color} />
      <Circle cx={nx} cy={6} r={1.4} fill={color} />
    </GlyphFrame>
  );
}

export function FeedingLeftBreastGlyph(props: EntryGlyphProps) {
  return <BreastGlyph {...props} side="left" />;
}

export function FeedingRightBreastGlyph(props: EntryGlyphProps) {
  return <BreastGlyph {...props} side="right" />;
}

export function FeedingBothBreastsGlyph({
  size,
  color = themeColors().textPrimary,
}: EntryGlyphProps) {
  // Left- and right-facing breasts side by side.
  const H = 10;
  const big = 4.5;
  const sm = 1.2;
  return (
    <GlyphFrame size={size} w={17} h={H}>
      <Path d={rr(0, 0, 7, H, big, sm, sm, big)} fill={color} />
      <Circle cx={0.3} cy={5} r={1.1} fill={color} />
      <Path d={rr(10, 0, 7, H, sm, big, big, sm)} fill={color} />
      <Circle cx={16.7} cy={5} r={1.1} fill={color} />
    </GlyphFrame>
  );
}

export function FeedingSelfFedGlyph({ size, color = themeColors().textPrimary }: EntryGlyphProps) {
  // A single dot — the prototype's mark for self-feeding.
  return (
    <GlyphFrame size={size} w={12} h={12}>
      <Circle cx={6} cy={6} r={6} fill={color} />
    </GlyphFrame>
  );
}

export function FeedingParentFedGlyph({
  size,
  color = themeColors().textPrimary,
}: EntryGlyphProps) {
  // A spoon: oval bowl over a stem.
  return (
    <GlyphFrame size={size} w={13} h={14}>
      <Ellipse cx={6.5} cy={3.5} rx={4.5} ry={3.5} fill={color} />
      <Rect x={5.5} y={7} width={2} height={7} fill={color} />
    </GlyphFrame>
  );
}

// --- Medication (one per dose unit) -----------------------------------------

export function MedMlGlyph({ size, color = themeColors().textPrimary }: EntryGlyphProps) {
  // Dropper bottle: conical top over a round body.
  return (
    <GlyphFrame size={size} w={9} h={13}>
      <Path d="M4.5,0 L9,7 L0,7 Z" fill={color} />
      <Circle cx={4.5} cy={8.5} r={4.5} fill={color} />
    </GlyphFrame>
  );
}

export function MedMgGlyph({ size, color = themeColors().textPrimary }: EntryGlyphProps) {
  // Powder heap with grains above it.
  return (
    <GlyphFrame size={size} w={14} h={12}>
      <Path d="M7,4 L14,12 L0,12 Z" fill={color} />
      <Circle cx={2.7} cy={0.7} r={0.7} fill={color} />
      <Circle cx={7} cy={1.7} r={0.7} fill={color} />
      <Circle cx={11.2} cy={0.7} r={0.7} fill={color} />
    </GlyphFrame>
  );
}

export function MedTabletsGlyph({ size, color = themeColors().textPrimary }: EntryGlyphProps) {
  // Two overlapping tablets. In the prototype each 11px disc carries a 1.5px
  // white ring inside its own box, so the coloured disc is r=4 and the ring is
  // what separates them. Reproduced here as an even-odd bite out of the rear
  // disc, which — unlike a background-coloured stroke — works on any swatch.
  const R = 4;
  const rear = `${circlePath(12.5, 5.5, R)} ${circlePath(5.5, 5.5, R + 1.5)}`;
  return (
    <GlyphFrame size={size} w={18} h={11}>
      <Path d={rear} fill={color} fillRule="evenodd" />
      <Circle cx={5.5} cy={5.5} r={R} fill={color} />
    </GlyphFrame>
  );
}

export function MedDropsGlyph({ size, color = themeColors().textPrimary }: EntryGlyphProps) {
  // Dropper with a falling drop beneath it.
  return (
    <GlyphFrame size={size} w={10} h={16}>
      <Rect x={3.5} y={0} width={3} height={4} fill={color} />
      <Path d="M5,4 L10,11 L0,11 Z" fill={color} />
      <G transform="translate(3, 12)">
        <Path d={dropPath(4, 4)} fill={color} />
      </G>
    </GlyphFrame>
  );
}

export function MedPasteGlyph({ size, color = themeColors().textPrimary }: EntryGlyphProps) {
  // Tube with a squeeze of paste above the nozzle. Authored on a box extended
  // upward by 3px so the blob isn't clipped.
  return (
    <GlyphFrame size={size} w={11} h={19}>
      <G transform="translate(0, 3)">
        <Path d={dropPath(3, 3)} transform="translate(4, -3)" fill={color} />
        <Rect x={4.5} y={0} width={2} height={3} fill={color} />
        <Path d={rr(2.5, 3, 6, 2, 1, 1, 1, 1)} fill={color} />
        <Path d={rr(1, 7, 9, 9, 1, 1, 3, 3)} fill={color} />
      </G>
    </GlyphFrame>
  );
}

// --- Medication schedule (the Scheduled / As-needed toggle) -----------------

export function ScheduledGlyph({ size, color = themeColors().textPrimary }: EntryGlyphProps) {
  // Clock face: outline circle with an hour and minute hand.
  return (
    <GlyphFrame size={size} w={13} h={13}>
      <Circle cx={6.5} cy={6.5} r={5.75} fill="none" stroke={color} strokeWidth={1.5} />
      <Rect x={5.9} y={3} width={1.3} height={4} rx={0.6} fill={color} />
      <Rect x={6.5} y={5.9} width={3.5} height={1.3} rx={0.6} fill={color} />
    </GlyphFrame>
  );
}

export function AsNeededGlyph({ size, color = themeColors().textPrimary }: EntryGlyphProps) {
  // Solid upward triangle — the prototype's "as-needed" mark.
  return (
    <GlyphFrame size={size} w={13} h={11}>
      <Path d="M6.5,0 L13,11 L0,11 Z" fill={color} />
    </GlyphFrame>
  );
}

// --- Temperature ------------------------------------------------------------

export function TemperatureGlyph({ size, color = themeColors().textPrimary }: EntryGlyphProps) {
  return (
    <GlyphFrame size={size} w={10} h={18}>
      <Path d={rr(2, 0, 6, 14, 3, 3, 3, 3)} fill={color} />
      <Circle cx={5} cy={13} r={5} fill={color} />
    </GlyphFrame>
  );
}

// Temperature-method sub-glyphs (oral reuses the thermometer above). Transcribed
// from the prototype's method row: an outlined egg for the ear probe, an
// open-bottomed dome for the forehead scanner.
export function TempEarGlyph({ size, color = themeColors().textPrimary }: EntryGlyphProps) {
  return (
    <GlyphFrame size={size} w={11} h={13}>
      <Ellipse cx={5.5} cy={6.5} rx={4.75} ry={5.75} fill="none" stroke={color} strokeWidth={1.5} />
    </GlyphFrame>
  );
}

export function TempForeheadGlyph({ size, color = themeColors().textPrimary }: EntryGlyphProps) {
  return (
    <GlyphFrame size={size} w={14} h={7}>
      <Path
        d="M0.75,7 L0.75,3.5 A6.25,6.25 0 0 1 13.25,3.5 L13.25,7"
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </GlyphFrame>
  );
}

// --- Tummy time (option 1a) -------------------------------------------------

export function TummyTimeGlyph({ size, color = themeColors().textPrimary }: EntryGlyphProps) {
  // Baby lying prone: head + curved body.
  return (
    <GlyphFrame size={size} w={22} h={15}>
      <Circle cx={4.5} cy={4.5} r={4.5} fill={color} />
      <Path d={rr(7, 8, 14, 7, 0, 7, 7, 0)} fill={color} />
    </GlyphFrame>
  );
}

// --- Sleep (options 3c / 3d) ------------------------------------------------

export function NapGlyph({ size, color = themeColors().textPrimary }: EntryGlyphProps) {
  // Plain pillow/cloud.
  return (
    <GlyphFrame size={size} w={18} h={12}>
      <Path d={rr(0, 4, 18, 8, 6, 6, 6, 6)} fill={color} />
      <Circle cx={6} cy={4} r={4} fill={color} />
      <Circle cx={12.5} cy={3.5} r={4.5} fill={color} />
    </GlyphFrame>
  );
}

export function NightGlyph({ size, color = themeColors().textPrimary }: EntryGlyphProps) {
  // Pillow + crescent moon. The prototype fakes the crescent with an inset
  // box-shadow in the swatch's own colour; an even-odd cut-out gives the same
  // silhouette without needing to know the background.
  const moon = `${circlePath(9, 3, 3)} ${circlePath(11, 1.5, 2.3)}`;
  return (
    <GlyphFrame size={size} w={19} h={18}>
      <Path d={moon} fill={color} fillRule="evenodd" />
      <Path d={rr(1, 10, 18, 8, 6, 6, 6, 6)} fill={color} />
      <Circle cx={7} cy={10} r={4} fill={color} />
      <Circle cx={13.5} cy={9.5} r={4.5} fill={color} />
    </GlyphFrame>
  );
}

// --- Note (option 2a) -------------------------------------------------------

export function NoteGlyph({ size, color = themeColors().textPrimary }: EntryGlyphProps) {
  // Document with lines of text; the page itself is a faint wash.
  return (
    <GlyphFrame size={size} w={14} h={18}>
      <Path d={rr(0, 0, 14, 18, 2, 2, 2, 2)} fill={color} opacity={0.18} />
      <Path d={rr(2.5, 4, 9, 1.6, 0.8, 0.8, 0.8, 0.8)} fill={color} />
      <Path d={rr(2.5, 8, 9, 1.6, 0.8, 0.8, 0.8, 0.8)} fill={color} />
      <Path d={rr(2.5, 12, 6, 1.6, 0.8, 0.8, 0.8, 0.8)} fill={color} />
    </GlyphFrame>
  );
}

// --- Feed row actions -------------------------------------------------------

export function PencilGlyph({ size, color = themeColors().textPrimary }: EntryGlyphProps) {
  return (
    <GlyphFrame size={size} w={12} h={12}>
      <Path
        d={rr(4.75, 0, 2.5, 12, 1.25, 1.25, 1.25, 1.25)}
        fill={color}
        transform="rotate(45, 6, 6)"
      />
    </GlyphFrame>
  );
}

export function TrashGlyph({ size, color = themeColors().textPrimary }: EntryGlyphProps) {
  return (
    <GlyphFrame size={size} w={13} h={11}>
      <Rect x={0} y={0} width={13} height={2} fill={color} />
      <Path d={rr(1, 2, 11, 9, 0, 0, 3, 3)} fill={color} />
    </GlyphFrame>
  );
}

// --- Quick-action category glyphs -------------------------------------------
/**
 * The dashboard's quick-action buttons open a *blank* form, so they stand for a
 * category rather than for any entry's sub-type. The prototype draws them with
 * their own shapes — a nappy, a capsule, three dots — not with the sub-type
 * glyph the form happens to default to. Batch E used the latter; these restore
 * the former. Sleep, Food and Tummy reuse the entry glyphs, which already match.
 */

export function NappyGlyph({ size, color = themeColors().textPrimary }: EntryGlyphProps) {
  // The side tabs hang outside the 20px body, so the drawing box is 24 wide.
  return (
    <GlyphFrame size={size} w={24} h={13}>
      <Path d={rr(2, 1, 20, 12, 5, 5, 10, 10)} fill={color} />
      <Path d={rr(0, 2, 3, 5, 2, 0, 0, 2)} fill={color} />
      <Path d={rr(21, 2, 3, 5, 0, 2, 2, 0)} fill={color} />
    </GlyphFrame>
  );
}

export function PillGlyph({ size, color = themeColors().textPrimary }: EntryGlyphProps) {
  // Capsule outline with the left half filled — the two-tone pill.
  return (
    <GlyphFrame size={size} w={20} h={10}>
      <Path d={rr(0, 0, 10, 10, 5, 0, 0, 5)} fill={color} />
      <Path d={rr(0, 0, 20, 10, 5, 5, 5, 5)} fill="none" stroke={color} strokeWidth={1.5} />
    </GlyphFrame>
  );
}

export function MoreGlyph({ size, color = themeColors().textPrimary }: EntryGlyphProps) {
  return (
    <GlyphFrame size={size} w={18} h={4}>
      <Circle cx={2} cy={2} r={2} fill={color} />
      <Circle cx={9} cy={2} r={2} fill={color} />
      <Circle cx={16} cy={2} r={2} fill={color} />
    </GlyphFrame>
  );
}

// --- Resolver ---------------------------------------------------------------

/**
 * Maps a glyph key to its component. The *choice* of key is pure logic in
 * `lib/entryDisplay.ts` (unit-tested); this file only draws. Exhaustive by
 * construction — a new `GlyphKind` fails to compile until it's drawn here.
 */
const GLYPHS: Record<GlyphKind, React.ComponentType<EntryGlyphProps>> = {
  diaperPee: DiaperPeeGlyph,
  diaperPoo: DiaperPooGlyph,
  diaperBoth: DiaperBothGlyph,
  feedingBottle: FeedingBottleGlyph,
  feedingBreast: FeedingBreastGlyph,
  feedingSolid: FeedingSolidGlyph,
  medMg: MedMgGlyph,
  medMl: MedMlGlyph,
  medTablets: MedTabletsGlyph,
  medDrops: MedDropsGlyph,
  medPaste: MedPasteGlyph,
  temperature: TemperatureGlyph,
  tummyTime: TummyTimeGlyph,
  nap: NapGlyph,
  night: NightGlyph,
  note: NoteGlyph,
};

export function EntryGlyph({
  kind,
  size = 18,
  color = themeColors().textPrimary,
}: EntryGlyphProps & { kind: GlyphKind }) {
  const Component = GLYPHS[kind];
  return <Component size={size} color={color} />;
}

/**
 * Category glyphs, kept out of `GlyphKind` on purpose: that union is what
 * `entryGlyphKind` must stay exhaustive over, and no entry ever resolves to a
 * nappy or a "more" ellipsis.
 */
export type ActionGlyphKind = 'nappy' | 'pill' | 'more';

const ACTION_GLYPHS: Record<ActionGlyphKind, React.ComponentType<EntryGlyphProps>> = {
  nappy: NappyGlyph,
  pill: PillGlyph,
  more: MoreGlyph,
};

export function ActionGlyph({
  kind,
  size = 18,
  color = themeColors().textPrimary,
}: EntryGlyphProps & { kind: ActionGlyphKind | GlyphKind }) {
  const Component =
    kind in ACTION_GLYPHS ? ACTION_GLYPHS[kind as ActionGlyphKind] : GLYPHS[kind as GlyphKind];
  return <Component size={size} color={color} />;
}

/**
 * The leading glyph for each entry type's selector chip. Like the quick actions,
 * a type chip stands for a whole category, so it uses the category glyphs (nappy,
 * capsule, pillow) rather than the sub-type glyph the form defaults to. Values
 * are transcribed from the prototype's type-chip row. Exhaustive by construction.
 */
export const ENTRY_TYPE_CHIP_GLYPH: Record<EntryType, ActionGlyphKind | GlyphKind> = {
  diaper: 'nappy',
  feeding: 'feedingBottle',
  medication: 'pill',
  temperature: 'temperature',
  tummyTime: 'tummyTime',
  sleep: 'nap',
  note: 'note',
};
