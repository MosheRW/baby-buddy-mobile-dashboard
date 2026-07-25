import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { EntryGlyph } from './glyphs/entryGlyphs';
import { fontSize, radii, spacing, useTheme } from '../theme';
import type { GlyphKind } from '../lib/entryDisplay';

interface StatTileProps {
  /** Uppercase micro-label, e.g. "LAST PEE". */
  label: string;
  /** Big value, e.g. "45m ago". */
  value: string;
  /** Tint pair { bg, fg }. Defaults to a neutral tile. */
  tint?: { bg: string; fg?: string };
  /** Small glyph drawn inline before the label, in the tile's foreground. */
  glyph?: GlyphKind;
  /** Extra content under the value — the feeding tile's trend gauge. */
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Only the label and its glyph take the tint; the value stays in the primary
 * text colour on every tile. Tinting the value too — which this did before —
 * left "46m ago" in pale blue and cost the number the contrast it exists for.
 */
export function StatTile({ label, value, tint, glyph, children, style }: StatTileProps) {
  const { colors } = useTheme();
  const bg = tint?.bg ?? colors.neutral;
  const fg = tint?.fg ?? colors.textSecondary;
  return (
    <View style={[styles.tile, { backgroundColor: bg }, style]}>
      <View style={styles.labelRow}>
        {glyph ? <EntryGlyph kind={glyph} size={11} color={fg} /> : null}
        <AppText size={fontSize.micro} weight="700" color={fg} style={styles.label}>
          {label.toUpperCase()}
        </AppText>
      </View>
      <AppText size={fontSize.cardTitle} weight="800" color={colors.textPrimary}>
        {value}
      </AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: radii.control,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    gap: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: {
    letterSpacing: 0.5,
    opacity: 0.85,
  },
});
