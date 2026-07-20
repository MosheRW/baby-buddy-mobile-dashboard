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
| `Entry Icon Options.dc.html` | **committed** (17 122 bytes, 192 lines). Verified: all 12 option ids present exactly once, balanced markup, and the four *chosen* shapes byte-identical to the independently-committed prototype's inline versions — that last check is the one that matters, since Batch C builds from those. |

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

### Batch B — pure logic ✅ done

`npm test` 174 passing (+44), typecheck and lint clean. All pure, no UI yet.

Decisions made while implementing, worth review:

- **Pair scoping is structural, not a caller contract.** `medLimitSummaries`
  and `medBreakdown24h` key on `childId` + name (NUL-separated), so they're
  correct even on a mixed-child list. The existing `neededMeds`/`eligibleMeds`
  rely on the caller having scoped by child first; the new ones don't need to.
  Tested with two children sharing a medicine name and different limits.
- **`eligibleMeds` now excludes meds that carry a limit.** The prototype does
  this (`eligibleList` filters `maxDose24h == null`) and without it the same
  medicine renders in two dashboard sections at once. No interim regression:
  nothing can set a limit until Batch D, so the exclusion is a no-op on today's
  data.
- **Limit resolution: newest entry that *specifies* a limit wins** — not the
  newest entry outright. See open question below.
- **`foodTrend`'s baseline excludes the last 24h** (window `(now-192h,
  now-24h]`). Comparing today against a mean containing today would drag the
  bar toward 100% and hide the deviation the card exists to show.
- **`defaultTimeForMethod('bothBreasts')` sums the two sides' independent
  averages** rather than averaging them — a both-sides feed runs about as long
  as a left plus a right. A side with no history contributes 0, but if *neither*
  side has history the result is `null`, so the entry carries no baseline rather
  than a meaningless one.
- **A direct-breast feed with no captured baseline gets no gauge at all**,
  while amounts fall back to 240 ml / 60 g. There's no universal "normal"
  number of minutes at the breast to fall back on.
- `feedingGaugePercent` landed in `lib/feed.ts` rather than `lib/entryDisplay.ts`
  as the plan said — it's feeding math, and it needs the same `FeedingMethod`
  helpers.

**Resolved — an empty limit field means "unchanged", not "cleared".** The last
entry that actually specifies a limit stands; silently losing a safety limit by
omission is worse than needing an explicit edit to change one. So the only way
to remove a limit is to edit the entry that set it and clear the field there.
Batch D's medication form must therefore *not* treat a blank max-dose input as
an instruction to drop `maxDose24h` from the draft — blank means "carry the
pair's current limit forward". No code change; this is what Batch B already
does.

#### Original scope

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

### Batch C — icon system ✅ done

`npm test` 197 passing (+10), typecheck and lint clean. 18 glyphs in
`components/glyphs/entryGlyphs.tsx`, up from 13 stroked ones.

- **The new set is filled, not stroked.** The prototype draws every entry icon
  as solid composed `<div>`s on a tinted swatch, and a stroked outline reads
  quite differently at 18px. UI-chrome glyphs (chevron, close, gear, ±) stay
  stroked — they're affordances, not entry icons.
- **Authored in the prototype's own pixel space** and scaled to the 24×24 grid
  by `GlyphFrame`, so every number in the file can be checked directly against
  the prototype without converting units.
- **Glyph *choice* is pure logic**: `entryGlyphKind` / `entryVisual` in
  `lib/entryDisplay.ts`, unit-tested; `entryGlyphs.tsx` only draws. A new
  `GlyphKind` fails to compile until it's drawn.
- **Path geometry lives in `lib/glyphPaths.ts`**, also unit-tested — see below
  for why that isn't over-engineering.
- Crescents and the tablet gap use **even-odd cut-outs** rather than the
  prototype's background-coloured inset shadows, so they work on any swatch
  colour instead of assuming one.

**Two real bugs, caught by rendering the glyphs rather than by tests passing.**
`roundedRect` didn't implement CSS's radius-overflow rule, so
`border-radius: 0 7px 7px 0` on a 14×7 box (the tummy-time body, and the sleep
pillow at 18×8 r6) emitted arcs larger than the box and rendered as spikes and
blobs. And `medTablets` took too big a bite out of the rear disc, because the
prototype's 1.5px white ring is *inside* each 11px box — the coloured disc is
r=4, not r=5.5. Both now have regression tests; disabling the clamp fails 3.

The lesson worth keeping: a glyph batch can be fully green and completely wrong.
The geometry needed looking at.

`entryDisplay.ts` imports `theme/tokens` rather than the `theme` barrel — the
barrel re-exports `typography`, which pulls in expo-font and can't load in the
plain-node test env.

**Left for Batch E:** `QuickActions` still uses the old stroked glyphs, so the
dashboard's action buttons and the feed rows are in different styles until the
dashboard pass. `ActivityFeed` is already switched over.

#### Original scope

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

### Batch D — Log Entry form ✅ done

`npm test` 220 passing (+23; `formDraft.test.ts` 25 → 48), typecheck and lint
clean. Verified in the web mock preview, field by field: unit → dose
step/label, tablets → Route, paste → no dose + Body area, as-needed → the 24h
limit, suggestion prefill switching unit *and* schedule, Solid Food → food-type
row with Amount hidden on Fruits and back in grams on Grains, the diaper
`5 / 10` stepper with its label following Pee/Poo, Nap/Night above the sleep
timer, and the tag quick-pick adding a tag and dropping it from the offers.

Decisions made while implementing, worth review:

- **A blank 24h limit patches `null`, and `null` means "state nothing".**
  `draftToEntry` turns it into an absent `maxDose24h`, which `medLimitSummaries`
  reads as "this entry is silent about the limit" — so the pair's existing
  limit stands. There's a test that spells this out with a prior limited entry,
  because the naive reading (blank = clear) is one character away and the
  failure is silent. The prototype's helper text ("Leave blank for no limit")
  is wrong for us and was reworded.
- **The limit input keeps its own raw string.** Binding the box to the parsed
  number erases the decimal point as you type it. It re-seeds from the draft
  via React's "adjust state when a prop changes" pattern, which is how a
  suggestion prefill and edit hydration reach the box — with a ref, ESLint's
  `react-hooks/refs` rejects it, and it has to be state.
- **Baselines are stamped at selection, not at save.** `baselinePatch` runs from
  the kind and method handlers. `emptyDraft` also seeds `defaultQtyAtEntry`,
  since a new draft opens on Bottle and would otherwise save without one.
- **Each baseline is gated on its own method on the way out**, mirroring the
  read-side gating in `normalize.ts`: a flat draft keeps whichever baseline an
  earlier selection left behind, and it must not attach to a different method.
- **`entryToDraft` keeps the entry's original baselines** rather than
  re-capturing today's, so editing a week-old feed doesn't re-scale its gauge.
- **`maxDose24h` is gated on as-needed** to match the field being hidden for
  scheduled doses — setting a limit and then switching to Scheduled drops it.
- **`sleepType` defaults from the clock** (nap 07:00–18:59, night otherwise),
  per the prototype, rather than a fixed `'night'`.
- **`emptyDraft`'s medication defaults moved to the prototype's** — `5 ml`,
  not `1 mg`.
- Fixtures gained two real tags (`swaddled`, `white noise` on the nap), since
  nothing in the mock set had a non-author tag and the quick-pick row had
  nothing to render.

Not re-run: `npm run test:live`. Batch D changed no API code — the new fields
were already round-tripped against the real server in Batch A.

#### Original scope

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

### Batch E — Dashboard, feed, settings ✅ done

`npm test` 221 passing (+1), typecheck and lint clean. Verified in the web mock
preview: the personalized greeting and its dismissal surviving a navigation
round-trip, the med-limit tile (`2.5ml / 10.0ml`, 25% bar) opening the
breakdown sheet, the sheet's per-medicine rows including the no-limit case, the
trend line (`220 ml today vs 47 ml daily average`), tag tap → `Tag: swaddled ×`
narrowing the feed, the `3/10` and `8/10` diaper badges, and all eight progress
bars measured in the DOM (limit 25%, trend clamped 100%, feed gauges
120/120, 100/120, 12/15 breast, 110/120 ×3). Settings verified in both
variants by swapping the stored session.

Decisions made while implementing, worth review:

- **No cross-medication total on the breakdown sheet.** The prototype prints
  one, but only because its demo data is all ml. Real rows carry their own
  units and "7 mg + 2 ml = 9" is meaningless, so the sheet shows per-medicine
  rows only.
- **The welcome dismissal hangs off the dashboard's own handlers**, not a
  global touch hook. `onStartShouldSetResponderCapture` on the ScrollView was
  the first attempt and could not be shown to fire on web, so it was replaced
  with an explicit `dismiss()` in each navigation/selection handler plus
  `onScrollBeginDrag`. Less clever, verifiable.
- **It lives in a new non-persisted `uiStore`.** Screen-local state resurrects
  the greeting every time the dashboard remounts (which is every return from
  the form); persisted state would hide it forever after one tap.
- **`MedLimitSummary` gained `lastTakenAt`** for the tile's "last 3h ago" line.
- **`medGlyphKind(unit)` is exported from `entryDisplay`** so the limit tile and
  the sheet can draw a unit's glyph with no entry to read it from.
- **Quick actions now draw the filled entry glyphs**, picking the sub-type the
  form itself opens on (pee diaper, bottle feed, ml medication, night sleep) —
  the dashboard and the feed are finally in one style.
- Fixtures gained a limited as-needed medicine, diaper amounts, captured
  feeding baselines, a direct-breast feed and three older feeds. Without them
  half of this batch renders nothing in the mock preview.

Not re-run: `npm run test:live`. Batch E changed no API code.

#### Original scope

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
   size, **the prototype is the glyph source of truth for Batch C**; the sheet
   is committed alongside it as the sign-off record, including the rejected
   alternatives (1b, 1c, 1d, 2b, 3a, 3b, 3e, 3f).

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
