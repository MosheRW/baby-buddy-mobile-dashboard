import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActionButton,
  AppText,
  BottleGlyph,
  Card,
  CapsuleGlyph,
  ChevronLeftGlyph,
  ChipRow,
  CloseGlyph,
  DiaperGlyph,
  DotsGlyph,
  FieldLabel,
  GearGlyph,
  MoonGlyph,
  SegmentedToggle,
  Stepper,
  StatTile,
  TagRow,
  TextField,
  ThermometerGlyph,
  ToggleSwitch,
  TummyGlyph,
} from '../components';
import { colors, fontSize, spacing, tints } from '../theme';

/**
 * Visual QA surface for the design system. Not a shipped screen — a scrollable
 * gallery to compare each primitive against the prototype during Phase 1.
 */
export function GalleryScreen() {
  const [loginMode, setLoginMode] = useState<'babybuddy' | 'homeassistant'>('babybuddy');
  const [feedType, setFeedType] = useState<string | null>('formula');
  const [filter, setFilter] = useState<string | null>('all');
  const [amount, setAmount] = useState(120);
  const [dose, setDose] = useState(2.5);
  const [temp, setTemp] = useState(37.2);
  const [sleeping, setSleeping] = useState(true);
  const [tags, setTags] = useState<string[]>(['left breast']);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText size={fontSize.screenTitle} weight="800">
          Design System
        </AppText>

        <Section title="Glyphs">
          <View style={styles.glyphRow}>
            <DiaperGlyph />
            <BottleGlyph />
            <CapsuleGlyph />
            <ThermometerGlyph />
            <MoonGlyph />
            <TummyGlyph />
            <DotsGlyph />
            <ChevronLeftGlyph />
            <CloseGlyph />
            <GearGlyph />
          </View>
        </Section>

        <Section title="Segmented toggle">
          <SegmentedToggle
            value={loginMode}
            onChange={setLoginMode}
            options={[
              { value: 'babybuddy', label: 'Baby Buddy server' },
              { value: 'homeassistant', label: 'Home Assistant' },
            ]}
          />
        </Section>

        <Section title="Text field">
          <TextField label="Server URL" placeholder="https://babybuddy.example.com" />
        </Section>

        <Section title="Chips — wrap (entry types)">
          <ChipRow
            layout="wrap"
            value={feedType}
            onChange={setFeedType}
            options={[
              { value: 'diaper', label: 'Diaper' },
              { value: 'feeding', label: 'Feeding' },
              { value: 'medication', label: 'Medication' },
              { value: 'temp', label: 'Temp' },
              { value: 'tummy', label: 'Tummy time' },
              { value: 'sleep', label: 'Sleep' },
              { value: 'note', label: 'Note' },
            ]}
          />
        </Section>

        <Section title="Chips — scroll (feed filter)">
          <ChipRow
            layout="scroll"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'diaper', label: 'Diaper' },
              { value: 'feeding', label: 'Feeding' },
              { value: 'medication', label: 'Medication' },
              { value: 'sleep', label: 'Sleep' },
            ]}
          />
        </Section>

        <Section title="Stat tiles">
          <View style={styles.tileRow}>
            <StatTile label="Last pee" value="45m ago" tint={tints.pee} style={styles.tile} />
            <StatTile label="Last poo" value="3h ago" tint={tints.poo} style={styles.tile} />
          </View>
          <StatTile label="Last feeding" value="Formula · 120ml · 1h 20m ago" tint={tints.feeding} />
        </Section>

        <Section title="Steppers">
          <FieldLabel>Amount (ml)</FieldLabel>
          <Stepper value={amount} onChange={setAmount} step={10} min={0} suffix=" ml" />
          <View style={{ height: spacing.lg }} />
          <FieldLabel>Dose (decimal)</FieldLabel>
          <Stepper value={dose} onChange={setDose} step={0.5} min={0} decimals={1} />
          <View style={{ height: spacing.lg }} />
          <FieldLabel>Temperature</FieldLabel>
          <Stepper value={temp} onChange={setTemp} step={0.1} decimals={1} suffix="°" />
        </Section>

        <Section title="Toggle switch (Still sleeping)">
          <View style={styles.switchRow}>
            <AppText weight="700">Still sleeping</AppText>
            <ToggleSwitch value={sleeping} onValueChange={setSleeping} />
          </View>
        </Section>

        <Section title="Tags">
          <TagRow
            authorTag="by Sarah"
            tags={tags}
            onAdd={(t) => setTags((prev) => [...prev, t])}
            onRemove={(i) => setTags((prev) => prev.filter((_, idx) => idx !== i))}
          />
        </Section>

        <Section title="Buttons">
          <ActionButton label="Log in" fullWidth onPress={() => {}} />
          <View style={{ height: spacing.md }} />
          <View style={styles.buttonRow}>
            <ActionButton label="Delete" variant="danger" flex={1} onPress={() => {}} />
            <ActionButton label="Save" variant="accent" flex={2} onPress={() => {}} />
          </View>
          <View style={{ height: spacing.md }} />
          <ActionButton label="Food · 04:12" disabled onPress={() => {}} />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card elevation="none" style={styles.section}>
      <AppText size={fontSize.metaSm} weight="700" color={colors.textSecondary} style={styles.secLabel}>
        {title.toUpperCase()}
      </AppText>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing['2xl'],
    gap: spacing['2xl'],
  },
  section: {
    gap: spacing.lg,
    backgroundColor: colors.card,
  },
  secLabel: {
    letterSpacing: 0.6,
  },
  glyphRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing['2xl'],
    alignItems: 'center',
  },
  tileRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  tile: {
    flex: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
});
