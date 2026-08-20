/**
 * Keyboard "next / done" navigation for a multi-field form.
 *
 * `fieldProps(i)` returns the props a `TextField` needs so the keyboard's return
 * key moves to field `i + 1`, and on the **last** field submits the form instead
 * of just dismissing the keyboard. `blurOnSubmit` is false on every non-final
 * field so the keyboard doesn't flicker shut between them.
 *
 * Usage:
 *   const chain = useFieldChain(4, submit);
 *   <TextField {...chain.fieldProps(0)} … />
 */
import { useCallback, useRef } from 'react';
import type { TextInput } from 'react-native';

export interface FieldChainProps {
  ref: (node: TextInput | null) => void;
  returnKeyType: 'next' | 'done';
  blurOnSubmit: boolean;
  onSubmitEditing: () => void;
}

export function useFieldChain(count: number, onComplete: () => void) {
  const refs = useRef<(TextInput | null)[]>([]);

  const fieldProps = useCallback(
    (index: number): FieldChainProps => {
      const isLast = index === count - 1;
      return {
        ref: (node: TextInput | null) => {
          refs.current[index] = node;
        },
        returnKeyType: isLast ? 'done' : 'next',
        blurOnSubmit: isLast,
        onSubmitEditing: () => {
          if (isLast) onComplete();
          else refs.current[index + 1]?.focus();
        },
      };
    },
    [count, onComplete],
  );

  return { fieldProps };
}
