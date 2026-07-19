import React from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { FieldLabel } from './FieldLabel';
import { colors, fontSize, radii, spacing, weightFamily } from '../theme';

interface TextFieldProps extends TextInputProps {
  /** Optional uppercase caption rendered above the input. */
  label?: string;
  /** Multi-line note textarea style (fixed height, top-aligned). */
  multilineFixed?: boolean;
}

/**
 * White input: 14px radius, 14×16 padding, 13px 600-weight text.
 * Pass `label` to render the standard FieldLabel above it.
 */
export function TextField({ label, multilineFixed, style, ...rest }: TextFieldProps) {
  return (
    <View>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, multilineFixed && styles.multiline, style]}
        multiline={multilineFixed || rest.multiline}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.card,
    borderRadius: radii.control,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing['2xl'],
    fontFamily: weightFamily['600'],
    fontSize: fontSize.bodySm,
    color: colors.textPrimary,
  },
  multiline: {
    height: 52,
    textAlignVertical: 'top',
  },
});
