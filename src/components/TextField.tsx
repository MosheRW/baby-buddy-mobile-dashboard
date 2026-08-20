import React from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { FieldLabel } from './FieldLabel';
import {
  fontSize,
  radii,
  spacing,
  useTheme,
  useThemedStyles,
  weightFamily,
  type AppTheme,
} from '../theme';

interface TextFieldProps extends TextInputProps {
  /** Optional uppercase caption rendered above the input. */
  label?: string;
  /** Multi-line note textarea style (fixed height, top-aligned). */
  multilineFixed?: boolean;
}

/**
 * White input: 14px radius, 14×16 padding, 13px 600-weight text.
 * Pass `label` to render the standard FieldLabel above it.
 *
 * Forwards its ref to the underlying `TextInput` so a multi-field form can move
 * focus from one field to the next on the keyboard's return key (see
 * `useFieldChain`).
 */
export const TextField = React.forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, multilineFixed, style, ...rest },
  ref,
) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, multilineFixed && styles.multiline, style]}
        multiline={multilineFixed || rest.multiline}
        {...rest}
      />
    </View>
  );
});

const makeStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
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
