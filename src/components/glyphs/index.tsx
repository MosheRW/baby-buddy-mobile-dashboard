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

export function GearGlyph({ size = 22, color = colors.textPrimary }: GlyphProps) {
  // Toothed cog: filled gear outline with the centre hole punched out via
  // the even-odd fill rule (the inner circle winds against the body).
  return (
    <Svg {...frame(size)}>
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        fill={color}
        d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
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
