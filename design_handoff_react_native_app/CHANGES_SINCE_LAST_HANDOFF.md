# Changes since last handoff

The last handoff bundled a snapshot of the prototype from a few days ago. Since then the prototype went through the 4-batch refactor described in `Refactor Execution Plan.md` (also included in this folder). This file tells you exactly what's different so you (or Claude Code) can update an in-progress native implementation instead of starting over. The base README.md's screen/behavior descriptions are now **out of date in the specific spots listed below** — everything else in it still applies.

`Baby Buddy Dashboard App.dc.html` in this folder has been refreshed to the current version. If you already started porting from the old snapshot, diff your native code against these deltas rather than re-reading the whole file.

## New concept: reserved tag keys
Server-unsupported fields (unit, route, body area, default quantities) are now persisted as hidden tags on the entry, prefix `__key:value` (double underscore, lowercase key). These are filtered out of every tag display and tap-to-filter path — never show them to the user as real tags. Reserved keys in use:
- `__unit:mg|ml|tablets|drops|paste` — medication
- `__route:oral|anal` — medication, tablets only
- `__bodyarea:<free text>` — medication, paste only
- `__foodtype:<fruit|vegetable|...>` — solid food
- `__defaultqty:<number>` — bottle feeding (ml), captured at entry creation
- `__defaulttime:<seconds>` — breastfeeding, captured at entry creation

If your target platform's data model can add real (non-tag) fields for these, prefer that — the tag-prefix scheme is a prototyping workaround for the mock data layer, not a suggestion for your schema.

## 1. Medication form — unit system
- New **unit picker** (mg / ml / tablets / drops / paste) between dose and type. Changes dose field's step, precision, and label to match the unit.
- **Tablets** unit adds a route sub-field: Orally / Anal.
- **Paste** unit adds a free-text "body area" field.
- These persist via `__unit` / `__route` / `__bodyarea` tags (see above).
- Medication icons (dashboard tiles, entries feed, medication list) now vary by unit — 5 distinct glyphs (ml bottle, mg pill/capsule, tablets, drops, paste tube), all hand-drawn from `<div>` shapes.
- New **daily dose limit tracking**: dashboard now shows a med-limit tile with a taken/limit progress bar per medication that has a configured max, separate from the existing "needed" (scheduled) and "eligible" (as-needed) tiles.

## 2. Food — solid
- New **food-type picker** (fruits, vegetables, etc.) in the solid-food form.
- Quantity field hides automatically when the type is fruits or vegetables (assumed unmeasured).
- Persists via `__foodtype`.

## 3. Food — bottle
- Bottle feeding entries now capture a `__defaultqty` tag at creation time (the child's default ml at the moment of entry, decoupled from later Settings changes).

## 4. Food — breastfeeding
- Default time per side (left/right averaged independently over the last 7 days; "both" = sum of both sides' 7-day averages) is computed at entry creation and persisted via `__defaulttime`.

## 5. Tags — quick pick
- The tag input in the entry form now shows up to a few **recently-used tags** (last 30 days, per entry type) as one-tap chips above the free-text input, deduped against tags already applied to the current draft.

## 6 & 7. Entries feed — proportional gauges
- Bottle feeding and breastfeeding entries in the feed now render a **proportional gauge bar** against the entry's `__defaultqty` / `__defaulttime` tag, showing over/under vs. the child's baseline at a glance.
- Dashboard's "Last feeding" card also gained a trend bar + text: today's total vs. the 7-day daily average.

## 8. Entries feed — tag display & filtering
- Entry cards show one line (max) of real tags (reserved `__key:value` tags excluded from display and from tap-to-filter).
- Tapping a tag now filters the feed to that tag — a dismissible "Tag: X ×" chip appears above the feed when active (`hasTagFilter` / `clearTagFilter`).

## 9. Medication list & feed — unit icon
- Unit icon (driven by `__unit`) now shows next to the medicine name/dose everywhere a medication entry appears: dashboard tiles, entries feed, medication suggestions.

## 10–13. Icon system overhaul
- Full icon set is now in place for every entry type and most sub-types: diaper (pee/poo/both, tinted per Baby Buddy convention: blue wet, poo color-scale yellow→green→brown→black), feeding (bottle/breast/solid, and breastmilk/formula/fortified/solid × method), medication (per-unit, see above), temperature (with a colored dot per reading), tummy time, sleep (distinct nap vs. night icon).
- All icons are still hand-drawn `<div>` shape compositions (no icon font/SVG library) — geometric and minimal per the original direction. If your target platform wants a real icon library, treat these shapes purely as a reference for which glyph maps to which sub-type, not literal assets to port.
- Entries feed cards now show a colored left-border accent + tinted icon swatch matching the entry's type/sub-type.

## 14. Entries feed — action icons
- Edit and delete buttons on each entry card now show actual pencil/trash-can icons (previously blank tinted circles).

## 15. Home screen — personalized, dismissible welcome
- Greeting now includes the user's name ("Good morning, Sarah").
- The full greeting block hides after any interaction with the home screen for the rest of the session (`showWelcome` / `dismissWelcome`, in-memory flag on first tap anywhere on the dashboard).

## 16. Settings — server & account details
- The "Baby Buddy server" card is now labeled with whichever backend is active (Baby Buddy vs. Home Assistant) and shows a second row: "Logged in as {username}" for direct Baby Buddy auth, or a masked "Access token" for the Home Assistant path.

## Design tokens — no changes
Colors, type scale, spacing scale, and radii are unchanged from the original handoff's Design Tokens section — only new component patterns (gauge bars, progress bars, icon glyphs) were added, using the same palette/tint conventions already documented.

## Suggested approach for the native update
Because most of this is additive UI on an existing data-and-screen structure, prefer patching the native screens in place over regenerating them:
1. Add the reserved-tag-key handling to whatever create/parse layer maps your Baby Buddy API entries to app-side entry objects (filter them out of any tag list/UI everywhere tags render).
2. Extend the Medication and Feeding forms with the new fields (unit/route/body-area; food-type; the two default-capture tags).
3. Add the new icon set (or your platform's icon-library equivalents mapped 1:1 to the sub-types listed above).
4. Add the gauge/progress-bar components to entry cards and the dashboard feeding card.
5. Wire up tag-tap-to-filter and the dismissible welcome state.
6. Update the Settings server card copy.
