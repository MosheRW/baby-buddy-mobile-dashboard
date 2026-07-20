# Baby Buddy Dashboard — Refactor Execution Plan

Mock-data prototype. Tag prefix scheme for server-unsupported fields: `__key:value` (double underscore, lowercase key, colon, value). Never rendered as visible tags anywhere in the UI — filtered out of tag display/tap-to-filter everywhere tags are shown.

Reserved keys:
- `__unit:mg|ml|tablets|drops|paste` (medication)
- `__route:oral|anal` (medication, tablets only)
- `__bodyarea:<free text>` (medication, paste only)
- `__foodtype:fruit|vegetable|...` (solid food)
- `__defaultqty:<number>` (bottle feeding, ml)
- `__defaulttime:<seconds>` (breastfeeding)

---

## Batch 1 — Data model & entry-form logic
1. **Medications**: unit picker (mg/ml/tablets/drops/paste) between dose and type; dose field adapts to unit (step/precision/label); route sub-field for tablets (orally/anal); body-area text field for paste. Persist via `__unit`/`__route`/`__bodyarea` tags.
2. **Food — solid**: food-type picker (fruits, vegetables, etc.); hide quantity field when type is fruits/vegetables. Persist via `__foodtype`.
3. **Food — bottle**: capture default quantity tag (`__defaultqty`) at entry creation.
4. **Food — breastfeeding**: compute default time per side (left/right averaged separately over last 7 days; both = sum of both sides' averages) at entry creation; persist via `__defaulttime`.
5. **Tags — quick pick**: surface last 5 tags used (last 30 days) per entry type as selectable chips in the create/edit form.

## Batch 2 — Entries feed & widget consumption of new data
6. Bottle feeding: proportional gauge bar vs. `__defaultqty` in entries feed (extends existing amount-gauge work).
7. Breastfeeding: proportional gauge bar vs. `__defaulttime` in entries feed.
8. Entries feed: single line (max) of visible tags per entry (real tags only, reserved keys excluded); tap a tag → filter feed to that tag.
9. Medication list & entries feed: show unit icon next to dose/name, driven by `__unit`.

## Batch 3 — Icon system (richer, still simple/geometric)
10. Define the expanded icon set: entry-type icons (medication/pill, bottle, breast, diaper, sleep, tummy time, temperature, timer), plus sub-type icons (pee/poo/mixed diaper; breastmilk/formula/fortified/solid food; bottle/left/right/both breast; self/parent feeding; med units; oral/rectal/axillary/tympanic temp; nap/night sleep).
11. Apply icons to editor buttons (one per entry type) and in-form buttons (diaper pee/poo, food method buttons, timer start).
12. Apply diaper type coloring (blue wet, poo-color scale yellow→green→brown→black) consistently across entry screen + feed (already partly in place — extend to new icons).
13. Entries feed + home widget: food icon reflects food-type + feeding-type + method combined; medication icon reflects unit; sleep icon reflects nap/night.
14. Entries feed: add delete icon + edit icon to entry card action buttons.

## Batch 4 — Home screen & settings polish
15. Home screen welcome message: include user's name; hide for the rest of the session after any interaction with the home screen (store in-memory/sessionStorage flag).
16. Settings: show login/server details (server URL + account) in the server card.

---

## Open items to confirm before Batch 3 icon work
- Exact icon set/shapes (I'll propose a small sheet for sign-off before wiring them in broadly).
- Confirm "any interaction with home screen" = any tap/scroll on the home screen (not just navigating away).

Will proceed batch by batch, showing progress after each for review.