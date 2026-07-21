import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
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

/** Date half of the tappable field on Android. */
function displayDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Time half of the tappable field on Android. */
function displayTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
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
 * Date + time field. On Android it shows two independent tap targets — tapping
 * the time opens the time picker directly (the common case: nudging minutes or
 * hours), tapping the date opens the date picker. Neither chains into the other,
 * so a "change the time by 10 minutes" edit no longer forces you through a
 * month/day dialog first. On web (the emulator-free QA preview) it degrades to a
 * plain "YYYY-MM-DD HH:mm" text field, since the community picker has no web
 * implementation.
 */
export function DateTimeField({ label, value, onChange }: DateTimeFieldProps) {
  const { t } = useTranslation();
  if (Platform.OS !== 'android') {
    return (
      <TextField
        label={label}
        defaultValue={formatLocal(value)}
        placeholder={t('dateTime.placeholder')}
        onEndEditing={(e) => {
          const iso = parseLocal(e.nativeEvent.text);
          if (iso) onChange(iso);
        }}
      />
    );
  }

  const openDate = () => {
    DateTimePickerAndroid.open({
      value: new Date(value),
      mode: 'date',
      // Keep the existing time; only the Y/M/D changes.
      onValueChange: (_event, picked) => {
        if (!picked) return;
        const merged = new Date(value);
        merged.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
        onChange(merged.toISOString());
      },
    });
  };

  const openTime = () => {
    DateTimePickerAndroid.open({
      value: new Date(value),
      mode: 'time',
      is24Hour: true,
      // Keep the existing date; only H:mm changes.
      onValueChange: (_event, picked) => {
        if (!picked) return;
        const merged = new Date(value);
        merged.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
        onChange(merged.toISOString());
      },
    });
  };

  return (
    <View>
      <FieldLabel>{label}</FieldLabel>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('dateTime.dateAria', { label })}
          onPress={openDate}
          style={[styles.field, styles.dateField]}
        >
          <AppText size={fontSize.body} weight="700">
            {displayDate(value)}
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('dateTime.timeAria', { label })}
          onPress={openTime}
          style={[styles.field, styles.timeField]}
        >
          <AppText size={fontSize.body} weight="700">
            {displayTime(value)}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  field: {
    backgroundColor: colors.card,
    borderRadius: radii.control,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing['2xl'],
    alignItems: 'center',
  },
  dateField: {
    flex: 3,
  },
  timeField: {
    flex: 2,
  },
});
