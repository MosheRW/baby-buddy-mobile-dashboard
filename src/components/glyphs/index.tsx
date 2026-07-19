/**
 * Minimal geometric glyphs, hand-drawn as SVG to match the prototype's
 * intentionally simple div-shape icons (no icon library — pending design-owner
 * sign-off, see docs/IMPLEMENTATION_PLAN.md open questions).
 *
 * Every glyph accepts a common { size, color } prop and draws on a 24x24 grid.
 */
import React from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { colors } from '../../theme';

export interface GlyphProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

function frame(size: number) {
  return { width: size, height: size, viewBox: '0 0 24 24' } as const;
}

export function DiaperGlyph({ size = 22, color = colors.textPrimary, strokeWidth = 2 }: GlyphProps) {
  return (
    <Svg {...frame(size)}>
      <Path
        d="M4 6h16v3c0 5-3.6 9-8 9S4 14 4 9V6z"
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinejoin="round"
      />
      <Line x1="4" y1="8" x2="20" y2="8" stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function BottleGlyph({ size = 22, color = colors.textPrimary, strokeWidth = 2 }: GlyphProps) {
  return (
    <Svg {...frame(size)}>
      <Path
        d="M10 3h4v2l1 2v11a3 3 0 0 1-3 3h0a3 3 0 0 1-3-3V7l1-2V3z"
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinejoin="round"
      />
      <Line x1="9" y1="11" x2="15" y2="11" stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function CapsuleGlyph({
  size = 22,
  color = colors.textPrimary,
  strokeWidth = 2,
}: GlyphProps) {
  return (
    <Svg {...frame(size)}>
      <Rect
        x="4"
        y="8"
        width="16"
        height="8"
        rx="4"
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        transform="rotate(-45 12 12)"
      />
      <Line
        x1="12"
        y1="6.5"
        x2="12"
        y2="17.5"
        stroke={color}
        strokeWidth={strokeWidth}
        transform="rotate(-45 12 12)"
      />
    </Svg>
  );
}

export function ThermometerGlyph({
  size = 22,
  color = colors.textPrimary,
  strokeWidth = 2,
}: GlyphProps) {
  return (
    <Svg {...frame(size)}>
      <Path
        d="M12 4a2 2 0 0 1 2 2v8.2a3.5 3.5 0 1 1-4 0V6a2 2 0 0 1 2-2z"
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="17" r="1.4" fill={color} />
    </Svg>
  );
}

export function MoonGlyph({ size = 22, color = colors.textPrimary, strokeWidth = 2 }: GlyphProps) {
  return (
    <Svg {...frame(size)}>
      <Path
        d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function TummyGlyph({ size = 22, color = colors.textPrimary, strokeWidth = 2 }: GlyphProps) {
  // A baby-on-tummy abstraction: head circle + rounded body.
  return (
    <Svg {...frame(size)}>
      <Circle cx="7" cy="10" r="2.5" stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Path
        d="M9.5 12c3 0 5-1 8-1 1.5 0 2.5 1 2.5 2.5S19 16 16.5 16H10"
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function DotsGlyph({ size = 22, color = colors.textPrimary }: GlyphProps) {
  return (
    <Svg {...frame(size)}>
      <Circle cx="6" cy="12" r="1.7" fill={color} />
      <Circle cx="12" cy="12" r="1.7" fill={color} />
      <Circle cx="18" cy="12" r="1.7" fill={color} />
    </Svg>
  );
}

export function ChevronLeftGlyph({
  size = 22,
  color = colors.textPrimary,
  strokeWidth = 2,
}: GlyphProps) {
  return (
    <Svg {...frame(size)}>
      <Path
        d="M15 5l-7 7 7 7"
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CloseGlyph({ size = 22, color = colors.textPrimary, strokeWidth = 2 }: GlyphProps) {
  return (
    <Svg {...frame(size)}>
      <Line
        x1="6"
        y1="6"
        x2="18"
        y2="18"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="18"
        y1="6"
        x2="6"
        y2="18"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function GearGlyph({ size = 22, color = colors.textPrimary, strokeWidth = 2 }: GlyphProps) {
  return (
    <Svg {...frame(size)}>
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Path
        d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function PlusGlyph({ size = 22, color = colors.textPrimary, strokeWidth = 2 }: GlyphProps) {
  return (
    <Svg {...frame(size)}>
      <Line
        x1="12"
        y1="5"
        x2="12"
        y2="19"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="5"
        y1="12"
        x2="19"
        y2="12"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function MinusGlyph({ size = 22, color = colors.textPrimary, strokeWidth = 2 }: GlyphProps) {
  return (
    <Svg {...frame(size)}>
      <Line
        x1="5"
        y1="12"
        x2="19"
        y2="12"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}
