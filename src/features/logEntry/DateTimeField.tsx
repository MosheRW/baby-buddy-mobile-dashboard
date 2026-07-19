import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { AppText, FieldLabel, TextField } from '../../components';
import { colors, fontSize, radii, spacing } from '../../theme';

interface DateTimeFieldProps {
  label: string;
  /** ISO 8601 timestamp. */
  value: string;
  onChange: (iso: string) => void;
}

/** "2026-07-19 14:30" in the device's local time — the editable web fallback. */
function formatLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Display string for the tappable field on Android. */
function displayLocal(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseLocal(text: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Date + time field. On Android it opens the platform picker (date, then time,
 * chained) — the only shipping target. On web (the emulator-free QA preview) it
 * degrades to a plain "YYYY-MM-DD HH:mm" text field, since the community picker
 * has no web implementation.
 */
export function DateTimeField({ label, value, onChange }: DateTimeFieldProps) {
  if (Platform.OS !== 'android') {
    return (
      <TextField
        label={label}
        defaultValue={formatLocal(value)}
        placeholder="YYYY-MM-DD HH:mm"
        onEndEditing={(e) => {
          const iso = parseLocal(e.nativeEvent.text);
          if (iso) onChange(iso);
        }}
      />
    );
  }

  const open = () => {
    const current = new Date(value);
    DateTimePickerAndroid.open({
      value: current,
      mode: 'date',
      onChange: (_event, date) => {
        if (!date) return;
        // Chain into the time picker so one tap edits the whole timestamp.
        DateTimePickerAndroid.open({
          value: date,
          mode: 'time',
          is24Hour: true,
          onChange: (_e, time) => {
            if (!time) return;
            const merged = new Date(date);
            merged.setHours(time.getHours(), time.getMinutes(), 0, 0);
            onChange(merged.toISOString());
          },
        });
      },
    });
  };

  return (
    <View>
      <FieldLabel>{label}</FieldLabel>
      <Pressable accessibilityRole="button" onPress={open} style={styles.field}>
        <AppText size={fontSize.body} weight="700">
          {displayLocal(value)}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    backgroundColor: colors.card,
    borderRadius: radii.control,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing['2xl'],
    alignItems: 'flex-end',
  },
});
