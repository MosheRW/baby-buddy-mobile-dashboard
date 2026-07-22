import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../theme';

interface ToggleSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  /** Announced by screen readers when the switch has no adjacent text label. */
  accessibilityLabel?: string;
}

const TRACK_W = 44;
const TRACK_H = 24;
const KNOB = 18;
const PAD = 3;

/** 44×24 track with an animated knob (the "Still sleeping" toggle). */
export function ToggleSwitch({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
}: ToggleSwitchProps) {
  // Read-only derived value tracks `value` and animates on every change.
  const progress = useDerivedValue(() => withTiming(value ? 1 : 0, { duration: 160 }), [value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.neutral, colors.accent]),
  }));

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * (TRACK_W - KNOB - PAD * 2) }],
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={disabled && styles.disabled}
    >
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.knob, knobStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    padding: PAD,
    justifyContent: 'center',
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: colors.card,
  },
  disabled: {
    opacity: 0.5,
  },
});
