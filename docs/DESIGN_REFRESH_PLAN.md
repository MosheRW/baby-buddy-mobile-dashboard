# Phase 8 — Design refresh (updated prototype)

Implements the 4-batch prototype refactor described in
`design_handoff_react_native_app/CHANGES_SINCE_LAST_HANDOFF.md` and
`Refactor Execution Plan.md`, against the **updated** prototype pulled from the
Claude Design project `a761d5ad-614e-4188-b159-73cb71cbee6d`
(`Baby Buddy Dashboard App.dc.html`, 1948 lines / 170 KB — roughly double the
snapshot currently committed).

Design tokens are unchanged. This is additive UI plus four new persisted fields;
no screen is restructured and no navigation changes.

---

## 0. Refresh the committed handoff — done

The committed `design_handoff_react_native_app/Baby Buddy Dashboard App.dc.html`
was the **pre-refactor snapshot** — it contained zero occurrences of `__unit`,
`__foodtype`, `__defaultqty`, `__defaulttime`, `dismissWelcome`, `hasTagFilter`,
`medLimit`, or `maxDose24h`, while CLAUDE.md points at it as "the behavioral
reference".

Replaced with the current version from the design project
(+1075 / −179 lines; 1948 lines, 170 KB). Post-install check: all eight markers
present.

Checked and deliberately **not** changed:

| File | Finding |
| --- | --- |
| `README.md` | byte-identical to the design project's copy — the base handoff was never refreshed, exactly as `CHANGES_SINCE_LAST_HANDOFF.md` says ("out of date in the specific spots listed below"). Read the two together. |
| `support.js` | byte-identical (64 206 bytes). The prototype renders against the committed runtime. |
| `android-frame.jsx` | not re-fetched — a static bezel, and the prototype passes it the same `title` / `hint-size` props as before. `support.js` being unchanged makes a runtime drift implausible. |
| `Entry Icon Options.dc.html` | left in the design project, not committed — see §3.1 for why, and for the decisions extracted from it. |

Remaining: update CLAUDE.md's Status section to reorder Phase 7 after this work.

---

## 1. The field-mapping decision (do this before any UI)

The CHANGES doc says: *"If your target platform's data model can add real
(non-tag) fields for these, prefer that — the tag-prefix scheme is a prototyping
workaround for the mock data layer, not a suggestion for your schema."*

We are not free-form here: the backend is a real Baby Buddy server whose schema
we already transcribed from its own `openapi-schema.yml` into
`src/api/schemas.ts`. Checking each new field against it splits the work cleanly
in two — and it turns out **three of the prototype's tag hacks are unnecessary
for us, and two things the prototype treats as first-class are fields we're
currently dropping on the floor.**

### 1a. Real server fields — use them, no tags

| Prototype concept | Server field | Current state |
| --- | --- | --- |
| Medication unit `mg` / `ml` / `tablets` / `drops` | `medication.dosage_unit` (`schemas.ts:77`) | already parsed → `MedicationEntry.doseUnit`, but **the form has no unit picker** |
| Diaper amount (`x/10` badge, stepper) | `diaper.amount` (`schemas.ts:54`) | **parsed by the schema, then dropped** — not on `DiaperEntry` |
| Sleep nap vs night (distinct icons) | `sleep.nap` (`schemas.ts:100`) | **parsed by the schema, then dropped** — not on `SleepEntry` |

Note the prototype's `hiddenTagsFor()` only ever emits `__unit:paste`, never
`__unit:mg` etc. That is not an oversight — `paste` is the one unit outside the
server's 4-value `dosage_unit` enum. The CHANGES doc's
`__unit:mg|ml|tablets|drops|paste` overstates it. Only `paste` needs a tag.

### 1b. No server representation — reserved tags

Same `__key:value` scheme, and it slots into the mechanism `normalize.ts`
already uses for the author tag, `as-needed`, and temperature method
(`splitTags` / `buildTags`, `normalize.ts:95–124`).

| Tag | Applies to |
| --- | --- |
| `__unit:paste` | medication, paste only |
| `__route:orally\|anal` | medication, tablets only |
| `__bodyarea:<free text>` | medication, paste only |
| `__foodtype:fruits\|vegetables\|grains\|protein\|dairy` | feeding, solid only |
| `__defaultqty:<ml>` | feeding, bottle — captured at creation |
| `__defaulttime:<minutes>` | feeding, left/right/both — captured at creation |
| `__maxdose24h:<number>` | medication — drives the new daily-limit tile |

Two corrections to the CHANGES doc, taken from the prototype source, which wins:

- `__defaulttime` is stored in **minutes**, not seconds (`entryVisual()` divides
  `e.durationMin` by it directly).
- `__maxdose24h` isn't in the CHANGES doc at all, but `maxDose24h` is a
  first-class draft field in the prototype (`draftFor`, `onMaxDoseChange`,
  `applyMedSuggestion`) and the whole med-limit feature depends on it.

### 1c. The one invariant that must not break

`splitTags` must strip **every** `__`-prefixed tag from `Tag[]` before UI code
sees it, in one place. If a reserved tag leaks into `tags`, it shows up as a
real chip in `TagRow`, in the entry card's tag line, and as a tappable filter —
three separate bugs from one miss. Add a unit test asserting a round-trip of an
entry carrying all seven reserved keys yields `tags: []` plus correctly typed
fields.

---

## 2. Work batches

Ordered so each batch is independently shippable and testable. Batches 1–2 are
data + logic (unit-testable, `npm test`); 3–5 are UI.

### Batch A — types, normalize, and the reserved-tag layer ✅ done, verified live

`npm test` 130 passing (+14), `npm run test:live` **20/20**, typecheck and lint
clean. No `schemas.ts` change was needed — every field already existed on the
wire schemas.

**The scheme's load-bearing assumption is now proven, not assumed.** Baby Buddy
tags are a Django model with slug generation, so it was entirely possible the
server would mangle or reject a tag starting with `__` and containing a colon
and a space. A live round-trip of `__bodyarea:left cheek` confirms it comes back
verbatim, and `doseUnit: 'paste'` survives the ml + `__unit:paste` detour. That
test is in the live suite permanently — if it ever fails, the scheme needs
rethinking, not the form that tripped it.

Also verified live: `diaper.amount` and `sleep.nap` round-trip as real fields,
and every real row of all seven endpoints still parses (the "one bad row drops a
whole endpoint" regression did not happen).

The strip is mutation-tested: disabling the `__` branch in `splitTags` fails 6
tests, so the leak guard isn't passing vacuously.

Implementation notes worth keeping:
- `splitTags` strips **every** `__` tag, known key or not, so an unrecognised
  key from a future version still can't render as a chip. Unknown keys are
  dropped on write rather than echoed — safe today (the scheme is ours alone),
  but it means an older build editing a newer entry would lose the new key.
- `buildTags` also filters `__` labels, so even a leak that reached `Tag[]`
  can't be written back and made permanent.
- Every reserved value is gated on the field that gives it meaning — `route`
  only for tablets, `foodtype` only for solid, `defaultqty` only for bottle.
  A stale tag from before the user switched units can't resurface.
- `sleepType` is required on `SleepEntry` (not optional), which forced the four
  construction sites to state it. `FormDraft` gained `sleepType` defaulting to
  `'night'`; its UI toggle lands in Batch D.

#### Original scope

Files: `src/api/types.ts`, `src/api/normalize.ts`, `src/api/schemas.ts` (likely
no change), `src/api/__tests__/normalize.test.ts`.

- `DosageUnit` → add `'paste'` as an *internal* union member; `toWire` maps
  `paste` → `dosage_unit: 'ml'` + `__unit:paste` tag, `fromWire` reverses it.
- `MedicationEntry` += `route?: 'orally' | 'anal'`, `bodyArea?: string`,
  `maxDose24h?: number`.
- `FeedingEntry` += `solidFoodType?: SolidFoodType`, `defaultQtyAtEntry?: number`,
  `defaultTimeAtEntry?: number`.
- `DiaperEntry` += `amount?: number` (wire it to the existing `diaper.amount`).
- `SleepEntry` += `sleepType: 'nap' | 'night'` (wire it to the existing
  `sleep.nap`).
- Generalize `splitTags`/`buildTags` into a reserved-key codec — one table, so
  adding a key later is a one-line change.

Risk to watch: `blankable()` and the "one unparseable row drops the whole
endpoint" failure mode documented in CLAUDE.md. Every new field must be
`.optional()` and tolerate `""`. Extend `npm run test:live` to assert real rows
still parse **before** shipping.

### Batch B — pure logic

New `src/lib/` modules with unit tests, following the existing
`medication.ts` / `feed.ts` split:

- `src/lib/medication.ts` (extend): `medLimitSummaries` (24h taken vs
  `maxDose24h`, percent clamped to 4–100, red at ≥100), `medBreakdown24h`
  (taken/count/remaining, sorted by name), and dose
  step/precision/label per unit (`mg:1, ml:0.1, tablets:0.5, drops:1,
  paste:0.5`).
- `src/lib/feed.ts` (extend): `avgBreastDuration(child, side, 7d)`,
  `defaultTimeForMethod` (`both` = left avg + right avg, null-tolerant),
  `foodTrend` (last 24h vs the prior 7 days ÷ 7).
- `src/lib/tags.ts` (new): `recentTagSuggestions(type)` — last 30 days, across
  all children, excluding reserved tags and the author tag, deduped, most-recent
  first, top 5.
- `src/lib/entryDisplay.ts` (extend): the gauge percentage —
  `amount / (__defaultqty ?? (solid ? 60 : 240))` for bottle/solid,
  `durationMin / __defaulttime` for direct breast; clamp 6–100%.

### Batch C — icon system (the largest chunk; needs sign-off first)

`src/components/glyphs/` currently exports **13** SVG glyphs. The updated design
uses roughly **25+**, including sub-type variants:

- diaper: pee / poo / both, tinted (blue wet; poo scale yellow→green→brown→black)
- feeding: bottle / breast / solid
- medication: 5 unit glyphs (ml dropper-bottle, mg pill, tablets, drops, paste tube)
- sleep: nap vs night (distinct)
- temperature (with a per-reading colored dot: red ≥38 °C, green below)
- tummy time, note, plus pencil + trash for the entry-card actions

The prototype draws these as composed `<div>` shapes; the CHANGES doc is
explicit that these are *"a reference for which glyph maps to which sub-type,
not literal assets to port"*. We keep the existing hand-drawn `react-native-svg`
approach and translate shape-for-shape.

The icon sign-off the Refactor Execution Plan listed as an open item is
**approved** — build against `Entry Icon Options.dc.html` (see §3.1), which
takes precedence over the dashboard prototype's inline shapes.

### Batch D — Log Entry form

Files: `src/lib/formDraft.ts` (+ its 25 tests), `src/features/logEntry/fields/*`.

`FormDraft` stays one flat record (the Phase 4 decision that lets you switch the
Type chip without losing other types' fields) — just wider.

- **Medication**: unit picker between dose and type; dose stepper adapts
  step/precision/label; `tablets` reveals a route toggle (Orally / Anal);
  `paste` reveals a free-text body-area field; a max-dose-per-24h field.
  `applyMedSuggestion` must also carry unit/route/bodyArea/maxDose24h.
- **Feeding**: solid-food-type picker; **quantity field hides when the type is
  fruits or vegetables**; capture `defaultQtyAtEntry` on selecting bottle and
  `defaultTimeAtEntry` on selecting left/right/both — at the moment of
  selection, so later Settings edits don't retroactively move the baseline.
- **Diaper**: amount stepper (0–10).
- **Sleep**: nap / night toggle.
- **Tags**: up to 5 recently-used chips above the free-text input, deduped
  against the current draft.

### Batch E — Dashboard, feed, settings

- **Feed** (`ActivityFeed.tsx`): colored left-border accent + tinted icon
  swatch per type/sub-type; one line max of real tags; **tap a tag → filter**,
  with a dismissible `Tag: X ×` chip above the feed; proportional gauge bar on
  bottle and breastfeeding entries; real pencil/trash icons on the action
  buttons (currently blank tinted circles); poo swatch + `x/10` amount badge on
  diaper rows; colored dot on temperature rows.
- **Dashboard** (`DashboardScreen.tsx`, `ChildCard.tsx`, `selectors.ts`): new
  med-limit tile with a taken/limit progress bar, alongside the existing needed
  (scheduled) and eligible (as-needed) tiles; tapping it opens a
  **medication 24h breakdown sheet** (new — not in the CHANGES doc, but present
  in the prototype as `openMedBreakdown`); trend bar + text on the "Last
  feeding" card (today vs 7-day daily average); greeting personalized with the
  username, and the whole welcome block hides after **any** interaction with the
  dashboard for the rest of the session (in-memory flag, not persisted).
- **Settings** (`SettingsScreen.tsx`): server card heading switches on the
  active backend ("Baby Buddy server" / "Home Assistant server") and gains a
  second row — `Logged in as {username}` for direct auth, or a masked
  `Access token` (`••••` + last 4) for the HA path. Both values already exist
  on `Session` (`types.ts:147`).

---

## 3. Resolved decisions

1. **Icon sign-off — approved, and the specific picks are resolved.**
   `Entry Icon Options.dc.html` turned out to be a *menu* of labelled
   alternatives ("Reference an id, e.g. use 3c/3d"), not a decision. But the
   updated prototype's inline shapes match four of them byte-for-byte —
   identical dimensions, radii, and offsets — so the picks are unambiguous:

   | Family | Chosen | Shape | Rejected |
   | --- | --- | --- | --- |
   | Tummy time | **1a** | 22×15, 9px head circle + 14×7 curved body | 1b (top-down) |
   | Note | **2a** | 14×18 document, 0.18-opacity fill + 3 lines | 2b (pencil) |
   | Sleep — nap | **3c** | 18×12 plain pillow/cloud | 3a/3b (crescents), 3e/3f (sleepy eye) |
   | Sleep — night | **3d** | 19×14 pillow + 6px inset-shadow moon | as above |

   Also note the sheet's *generic* sleep glyph (1c "Z" / 1d moon+sparkles) is
   dead — the nap/night pair supersedes it, and the prototype uses neither.
   Since every chosen shape is already in the refreshed prototype at final
   size, **the prototype is the glyph source of truth for Batch C**; the options
   sheet is only the sign-off record and stays in the design project.

   The sheet covers just these 4 families. The other ~21 glyphs (diaper
   pee/poo/both, feeding bottle/breast/solid, the 5 medication units,
   temperature, pencil, trash) were never optioned — take them from the
   prototype directly.

2. **`maxDose24h` is scoped to the (medication name, child) pair.** It is not a
   global setting and not a property of one individual dose. It rides on the
   entry on the wire (`__maxdose24h`), but every read path must resolve it as
   *the limit currently in force for this medication, for this child* — i.e.
   the value from the most recent entry with that name for that child, with
   older entries' values ignored rather than averaged or summed.

   Consequences to honor:
   - `medLimitSummaries` and `medBreakdown24h` group by name **within one
     child** (never across children) and take the latest entry's limit.
   - Editing an entry's max dose retroactively changes the limit shown for that
     medication — that is intended, it's how the pair's limit gets corrected.
   - Med suggestions carry the limit forward so logging the next dose keeps it,
     which is the mechanism that makes a per-pair limit persist at all.
   - A limit set for Emma's Tylenol must not appear on Noah's Tylenol tile.
     Worth an explicit unit test — it's the easy bug here.

3. **Dashboard layout — reconcile, don't rebuild.** The native app already
   implements the same threshold: `ChildNav.tsx:28` renders `TabsNav` at ≥3
   children and `CarouselNav` at ≤2, matching the prototype's
   `isCarousel = children.length <= 2`. The current rendering differs from the
   updated prototype in detail, so Batch E includes a pass diffing `ChildNav` /
   `ChildCard` against it — but the switch itself, and its threshold, stay.

4. **Ordering — this refresh lands before Phase 7.** Polish/release (empty
   states, keyboard/back/a11y, 1s-tick perf, EAS build) moves after, since this
   work changes most of the surfaces Phase 7 would polish.

---

## 4. Verification

- `npm test` — extend `normalize.test.ts` (reserved-tag round-trip, all seven
  keys), `formDraft.test.ts` (unit-dependent field visibility, quantity hidden
  for fruits/vegetables), plus new `medication` / `feed` / `tags` cases.
- `npm run test:live` — **the important one.** Per CLAUDE.md, the test that
  catches the whole "one bad row silently drops an entire entry type" class is
  the assertion that every real row of all seven endpoints parses. New optional
  fields must not regress it.
- Visual QA on web (`USE_MOCK_DATA`) against the refreshed prototype opened
  side by side.
