/**
 * Structural audit of the two locale files.
 *
 * `he.ts` mirrors `en.ts` by convention only — it is exported `as const`, not
 * typed against `Resources`, so a key added to one and forgotten in the other
 * fails *silently at runtime* (i18next falls back to English, or renders the raw
 * key). Nothing in `tsc` or the smoke test catches that, which makes this the
 * only thing standing between a copy change and a half-translated screen.
 *
 * Two checks, both structural rather than linguistic:
 *  1. every leaf exists in both locales, comparing *plural stems* — English needs
 *     `_one`/`_other`, Hebrew's CLDR rule also has `_two`/`_many`, so a raw key
 *     comparison would be wrong in both directions.
 *  2. every leaf interpolates the same `{{placeholders}}` — a translation that
 *     drops `{{child}}` renders a sentence with a hole in it, and one that invents
 *     a placeholder renders the braces literally.
 */
import { en } from '../locales/en';
import { he } from '../locales/he';

type Tree = { [key: string]: string | Tree };

/** CLDR plural suffixes i18next appends; stripped to compare keys across locales. */
const PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other'];

/** The plural forms each locale's rule actually produces, per pluralized stem. */
const REQUIRED_FORMS: Record<string, string[]> = {
  en: ['_one', '_other'],
  he: ['_one', '_two', '_many', '_other'],
};

function pluralStem(key: string): { stem: string; suffix: string } | null {
  const suffix = PLURAL_SUFFIXES.find((s) => key.endsWith(s));
  return suffix ? { stem: key.slice(0, -suffix.length), suffix } : null;
}

/** Flatten to `a.b.c` → value, and collect which plural forms each stem carries. */
function flatten(
  tree: Tree,
  prefix = '',
  out: { leaves: Map<string, string>; plurals: Map<string, Set<string>> } = {
    leaves: new Map(),
    plurals: new Map(),
  },
) {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      const plural = pluralStem(key);
      if (plural) {
        const stemPath = prefix ? `${prefix}.${plural.stem}` : plural.stem;
        const forms = out.plurals.get(stemPath) ?? new Set<string>();
        forms.add(plural.suffix);
        out.plurals.set(stemPath, forms);
        out.leaves.set(`${stemPath}${plural.suffix}`, value);
      } else {
        out.leaves.set(path, value);
      }
    } else {
      flatten(value, path, out);
    }
  }
  return out;
}

const placeholders = (s: string) => (s.match(/\{\{\s*[^}]+\s*\}\}/g) ?? []).sort();

const EN = flatten(en as unknown as Tree);
const HE = flatten(he as unknown as Tree);

/** Every non-plural key, which must exist verbatim in both locales. */
const singularKeys = (f: typeof EN) =>
  [...f.leaves.keys()].filter((k) => !pluralStem(k.split('.').pop() ?? ''));

describe('locale parity', () => {
  it('has the same non-plural keys in en and he', () => {
    expect(singularKeys(HE).sort()).toEqual(singularKeys(EN).sort());
  });

  it('pluralizes the same keys in both locales', () => {
    expect([...HE.plurals.keys()].sort()).toEqual([...EN.plurals.keys()].sort());
  });

  it("carries every plural form each locale's CLDR rule needs", () => {
    for (const [locale, flat] of [
      ['en', EN],
      ['he', HE],
    ] as const) {
      for (const [stem, forms] of flat.plurals) {
        expect({ locale, stem, forms: [...forms].sort() }).toEqual({
          locale,
          stem,
          forms: [...REQUIRED_FORMS[locale]].sort(),
        });
      }
    }
  });

  it('interpolates the same placeholders in both locales', () => {
    // `{{count}}` is exempt on a *plural* form: a locale may legitimately spell
    // the number out in a form it has a word for ("one hidden child", "שני ילדים")
    // while another interpolates it. Every other placeholder is content the
    // sentence can't do without, so a mismatch is a bug either way round.
    const mismatches: { key: string; en: string[]; he: string[] }[] = [];
    for (const [key, enValue] of EN.leaves) {
      const heValue = HE.leaves.get(key);
      if (heValue == null) continue; // reported by the key-parity tests above
      const isPlural = pluralStem(key.split('.').pop() ?? '') != null;
      const strip = (list: string[]) => (isPlural ? list.filter((p) => p !== '{{count}}') : list);
      const enPlaceholders = strip(placeholders(enValue));
      const hePlaceholders = strip(placeholders(heValue));
      if (enPlaceholders.join('|') !== hePlaceholders.join('|')) {
        mismatches.push({ key, en: enPlaceholders, he: hePlaceholders });
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('leaves no value empty', () => {
    for (const [locale, flat] of [
      ['en', EN],
      ['he', HE],
    ] as const) {
      for (const [key, value] of flat.leaves) {
        expect({ locale, key, empty: value.trim().length === 0 }).toEqual({
          locale,
          key,
          empty: false,
        });
      }
    }
  });
});
