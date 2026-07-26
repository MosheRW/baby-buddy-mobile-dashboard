import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AppText } from './AppText';
import { CloseGlyph } from './glyphs';
import {
  fontSize,
  radii,
  spacing,
  useTheme,
  useThemedStyles,
  weightFamily,
  type AppTheme,
} from '../theme';

interface TagRowProps {
  /** The auto-generated "by {name}" author tag, always shown first, non-removable. */
  authorTag: string;
  /** Free-text tags the user has added. */
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (index: number) => void;
}

/**
 * Tags: first chip is the non-removable "by {CreatorName}" author tag; the rest
 * are free-text with an × to remove. A text input + Add button appends new ones.
 */
export function TagRow({ authorTag, tags, onAdd, onRemove }: TagRowProps) {
  const [draft, setDraft] = useState('');
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const commit = () => {
    const t = draft.trim();
    if (t) {
      onAdd(t);
      setDraft('');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.chips}>
        <View style={[styles.chip, styles.authorChip]}>
          <AppText size={fontSize.metaSm} weight="700" color={colors.textSecondary}>
            {authorTag}
          </AppText>
        </View>
        {tags.map((tag, i) => (
          <View key={`${tag}-${i}`} style={styles.chip}>
            <AppText size={fontSize.metaSm} weight="700" color={colors.textPrimary}>
              {tag}
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove tag ${tag}`}
              hitSlop={8}
              onPress={() => onRemove(i)}
            >
              <CloseGlyph size={14} color={colors.textMuted} />
            </Pressable>
          </View>
        ))}
      </View>
      <View style={styles.addRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={commit}
          placeholder="Add a tag"
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          onPress={commit}
          style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
        >
          <AppText size={fontSize.bodySm} weight="800" color={colors.onAccent}>
            Add
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    container: {
      gap: spacing.md,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.neutral,
      borderRadius: radii.pill,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    authorChip: {
      backgroundColor: colors.background,
    },
    addRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    input: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: radii.control,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing['2xl'],
      fontFamily: weightFamily['600'],
      fontSize: fontSize.bodySm,
      color: colors.textPrimary,
    },
    addBtn: {
      backgroundColor: colors.accent,
      borderRadius: radii.control,
      paddingHorizontal: spacing['4xl'],
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: {
      opacity: 0.85,
    },
  });
