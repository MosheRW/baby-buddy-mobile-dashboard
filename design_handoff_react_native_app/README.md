# Handoff: Baby Buddy Dashboard — React Native Android App

## Overview
A mobile dashboard client for [Baby Buddy](https://github.com/babybuddy/babybuddy) (a self-hosted baby-tracking server). Lets a caregiver managing 1+ children log diapers, feedings, medications, temperature, tummy time, and sleep; see time-since-last stats and medication due/eligible windows at a glance; and run background timers for feeding/sleep/tummy time. Target platform: **Android, built in React Native** (project name/package TBD by dev).

## About the Design Files
The files in this bundle are **HTML/CSS design references** built as an interactive prototype — they show intended layout, states, copy, and interaction flow, not production code to copy directly. The task is to **rebuild this UI and behavior natively in React Native** (View/Text/Pressable/FlatList, a navigation library like React Navigation, AsyncStorage, etc.), matching the visual design closely while using RN's own layout system (flexbox via StyleSheet, not inline CSS strings) and idiomatic state management (React hooks/Context, or Redux/Zustand if the team prefers).

The bundled `android-frame.jsx` is only a **prototyping bezel** (renders a phone chrome around the HTML in the browser preview) — it is not a component to port; RN provides the real device chrome.

## Fidelity
**High-fidelity.** Colors, spacing, type sizes, border radii, and copy in the prototype are final/intentional — recreate them precisely (converting `oklch()` colors to hex/RGB, see Design Tokens below). Interaction flows (which screen opens from which button, conditional field visibility, timer behavior) are also final and specified below, not just illustrative.

## Screens / Views

### 1. Login
- **Purpose:** Authenticate against either a direct Baby Buddy server or a Home Assistant instance running the Baby Buddy add-on.
- **Layout:** Centered column, 44px top padding, 22px side padding. Logo mark (64×64 rounded-20 square, accent color) → app title (800 weight, 22px) → subtitle (600, 13px, muted) → segmented pill toggle (two tabs, 14px border-radius container, 4px inner padding, active tab white bg + subtle shadow) → mode-specific fields → full-width CTA button (accent bg, white text, 800 14px, 16px radius, ~15px vertical padding).
- **Baby Buddy mode fields:** Server URL, Username, Password (password masked). Button label "Log in".
- **Home Assistant mode fields:** Home Assistant URL, Long-lived access token, helper caption ("Uses the Baby Buddy add-on running on this Home Assistant instance"). Button label "Connect".
- **Inputs:** white bg, 14px radius, 14×16px padding, 13px 600-weight text, field label above in 11px 700-weight uppercase muted caption.
- **State:** `loginMode` ('babybuddy' | 'homeassistant'), plus the 5 text fields. On submit → navigate to Dashboard (real app: perform auth request, store token, then navigate).

### 2. Dashboard
- **Purpose:** At-a-glance status for the active child (or all, via tabs) + quick-log buttons + recent activity feed.
- **Header:** greeting ("Good morning/afternoon/evening" based on hour) 800/22px + today's date 600/13px muted, settings gear button (38×38, white rounded-12 square, subtle shadow) top-right.
- **Running timers strip** (conditional — only when ≥1 timer active app-wide): horizontal scroll of pill chips, each: 8px colored dot + "ChildName · Type" label (700/12px) + live elapsed mm:ss (800/12px, accent color). Tapping a chip jumps to that child + opens the log form for that entry type.
- **Nav pattern — adaptive:**
  - **≤2 children → swipe carousel.** Active child card (300px wide) + a thin 40px "peek" sliver of the next child's card (rotated vertical name label, tap advances). Page dots below (7px circles, active = accent).
  - **≥3 children → tabs.** Horizontal scrollable pill row, one pill per child, active = accent bg/white text.
- **Child card** (white, 24px radius, 20px padding, soft shadow): avatar circle (44px, initial letter, hue-tinted per child) + name (800/17px) + age (600/11px muted) → 2-col grid: Last pee / Last poo (tinted mini-cards, 14px radius) → Last feeding banner (full width, warm tint) → stacked rows for **needed medications** (scheduled meds due within ±24h, red-tinted if overdue) and **eligible medications** (as-needed meds within last 10 days eligible again, pink-tinted if eligible now) → Food total row for configurable window (default 4h) → quick-action button grid (3-col): Diaper, Food (label swaps to live mm:ss + disabled style when its timer is running), Medication, More(temperature), and the equivalent for Sleep/Tummy — 6 buttons total across the two screens' variants, each: icon glyph (drawn from divs, not icons library — recreate as RN SVG or vector icon set), label 800/10px, 14px radius, colored bg (accent normally, disabled grey while its own timer runs).
- **Recent activity section:** filter chip row (All/Diaper/Feeding/Medication/Sleep, horizontal scroll, active = accent) → day-grouped list ("Today"/"Yesterday"/"Jul 12" headers, 800/11px uppercase muted) → entry rows (white card, 16px radius, 34×34 tinted icon swatch + title 700/13px + relative time 600/11px + optional note 600/12px + tag chips + edit/delete affordance icons). Empty state: centered "No entries for this filter yet." Tapping a row opens Edit form; delete icon opens the delete-confirm sheet.

### 3. Log Entry Form (create/edit — shared across all 7 entry types)
- **Purpose:** single form shell whose fields change based on the selected entry Type chip (Diaper/Feeding/Medication/Temp/Tummy time/Sleep/Note).
- **Header:** title ("New entry"/"Edit entry", 800/17px) + close (X) button (32×32 rounded-10 grey square) top-right.
- **Type chip row:** all 7 types as pills, wraps to multiple lines, active = accent.
- **Time field:** datetime-local-style picker (native RN: use a date/time picker library), 14px radius white field, 700/14px.
- **Diaper fields:** two independent toggle pills, Pee and Poo (**both can be active simultaneously** — not mutually exclusive), tinted per-state (blue for pee, amber for poo, filled when active) → poo-color swatch row (5 colors: yellow/green/brown/black + one more, 30px circles, 2px accent ring on selection) shown always but only meaningful when Poo is toggled on.
- **Feeding fields:**
  - **Type** chips: Breast Milk / Formula / Fortified Breast Milk / Solid Food.
  - **Method** chips — options depend on Type: Breast Milk → Bottle/Left Breast/Right Breast/Both Breasts; Formula → Bottle only; Fortified → Bottle only; Solid → Self Fed/Parent Fed.
  - **Timer:** shown only in create mode when no timer running yet ("Start timer" pill, tinted). Once running: elapsed mm:ss ticking every second, End-time picker, "Stop timer" button (red). Only one feeding timer may run per child at a time; starting it also starts the 1-second UI tick.
  - **Duration stepper** (±5 min): only shown for direct-breast methods (Left/Right/Both) while no timer running (duration is otherwise derived from the timer).
  - **Amount stepper** (±10, ml or g): shown when method is Bottle, or Type is Solid.
- **Medication fields:** "Recent medications" suggestion list (scrollable, max-height 140px, built from the last 20 medication entries deduped by name — tapping one prefills name/dose/repeat/schedule type) → Medicine name text input → Scheduled/As-needed segmented toggle → Dose stepper (±0.5, **decimal-capable**, numeric text input + steppers) → Repeat interval chips (2h/4h/6h/8h/12h + Custom, custom reveals a free-entry hours field, 0.5h step) — label reads "Repeat next dose in" for scheduled, "Eligible again after" for as-needed.
- **Temperature fields:** value stepper (±0.1°) with unit suffix → Method segmented (Oral/Ear/Forehead).
- **Tummy time fields:** Timer (Start/running-elapsed+Stop, same pattern as feeding) shown in create mode; Duration stepper (±5 min) shown while no timer running.
- **Sleep fields:** In create mode: Start-timer / running-elapsed+"Woke up at" end-time picker+Stop-timer. In edit mode: "Still sleeping" toggle switch (44×24 track, animated knob) — when off, reveals a "Woke up at" end-time picker.
- **Common footer fields (all types):** Note textarea (optional, 52px fixed height, resize disabled) → Tags: chip row (first tag is always an auto-generated "by {CreatorName}" chip, non-removable; subsequent are free-text, each with an × remove) + text input & "Add" button to append a new tag.
- **Footer actions:** Delete button (only in edit mode, red-tinted, opens confirm sheet) + Save button (accent, flex 2 vs Delete's flex 1).

### 4. Settings
- **Purpose:** app-level preferences + per-child defaults + server info + logout.
- **Layout:** back-chevron + "Settings" header → "Feeding window" card (4 duration chips: 2h/4h/6h/12h, selected = accent + border) controlling the dashboard's food-total window → "Children & default food quantity" list (one white row per child: avatar + name + ml stepper, ± buttons adjust in 10ml increments — this becomes each child's default feeding amount in the log form) → "Baby Buddy server" info card (read-only URL label, reflects whichever login mode was used) → red "Log out" button (full width, returns to Login).

### 5. Delete Confirmation (modal sheet)
- **Purpose:** confirm irreversible deletion of an entry, invoked from a feed row's delete icon or the form's Delete button.
- **Layout:** bottom sheet over a dimmed (40% black) scrim, background content blurred; sheet: white, top corners 24px radius, drag-handle bar (40×4px pill) centered, title "Delete this entry?" (800/17px), body copy naming the entry + "This can't be undone." (600/13px), Cancel (grey) / Delete (red) buttons side by side.

## Interactions & Behavior
- **Adaptive navigation:** carousel for ≤2 children, tabs for 3+; both share the same card/quick-actions/feed markup.
- **Background timers:** Feeding, Sleep, and Tummy time each support a timer that persists even if the user navigates away from the form (stored in app-level state keyed by `{type, childIndex}`, not form-local state) — reopening the form for that type/child resumes showing the live elapsed time. Only one timer per (type, child) pair may run at once; the quick-action button for a type with a running timer shows the live mm:ss in place of its label and is visually disabled (can't start a second one) until the running timer is opened via the "Running timers" strip or the child card. A global 1-second tick powers all visible timer displays only while ≥1 timer is running (stopped in `componentWillUnmount`/timer-teardown to avoid unnecessary re-renders).
- **Medication logic:**
  - "Needed" (scheduled) meds: dedupe by name to most-recent entry, compute `nextDue = lastDoseTime + repeatHours`; show if nextDue falls within ±24h of now; label shows "Xh Ym" countdown or "overdue" (red tint) if past due.
  - "Eligible" (as-needed/PRN) meds: dedupe by name among entries from the last 10 days; same due-time math but framed as "eligible again" — shows "now"/pink tint once eligible, or a countdown otherwise.
  - Medicine-name suggestions pull from the 20 most recent medication entries (any child), deduped by name, most recent first.
- **Diaper contents:** Pee and Poo are independent booleans, not a 3-way exclusive radio (a diaper can be pee-only, poo-only, or both) — implement as two toggle buttons, not a segmented control.
- **Form field visibility:** Feeding's amount/duration fields and Medication's custom-repeat field appear/disappear based on other field values (method, timer running or not, schedule type) — see per-field notes above.
- **Tags vs Notes:** Tags capture metadata (author "by Sarah" auto-added on entry creation, plus free-text custom tags); Notes remain a separate free-text field for observations. Don't conflate the two.
- **Feed filtering/grouping:** entries filtered by chip selection then grouped by calendar day with sticky-style headers ("Today"/"Yesterday"/short date), most recent first.
- **Delete confirmation:** always routes through the bottom-sheet confirm, whether triggered from a feed row or the form's Delete button.
- **Loading/error states:** not designed in the prototype (it uses static demo data) — the RN app must add its own loading spinners/skeletons for API calls and error banners/toasts for failed requests (auth failure, network error, 4xx/5xx from Baby Buddy).

## State Management
Suggested top-level state (the prototype keeps all of this in one component's state — decompose into Context/hooks/Redux as the team prefers):
- `screen`: 'login' | 'dashboard' | 'form' | 'settings'
- `loginMode`, and the 5 auth fields; persisted auth token/session after login (AsyncStorage/SecureStore)
- `children[]`: each child has id, name, initial, hue (for tinting), age, defaultFoodMl, and its `entries[]` (fetched from Baby Buddy API, not local — see API integration below)
- `activeChildIndex`, `filter` (feed filter)
- `formMode` ('create'|'edit'), `formType`, `formDraft` (the in-progress entry object — shape varies by type, see per-type fields above), `editingEntryId`
- `runningTimers[]`: array of `{type, childIndex, startedAt}` — app-global, survives form close/reopen
- `deleteTarget`, `foodWindowHours` (persisted setting), `tagInput`, `customRepeatMode` (medication form)
- A 60s tick for relative-time labels ("45m ago") and a 1s tick only while timers are running.

**Data fetching (next phase — not yet wired in the prototype):**
- Baby Buddy REST API (token or session auth) or Home Assistant's Baby Buddy add-on API (long-lived token) — the login screen already models both paths; the real app must implement both auth flows and normalize both APIs' responses to the same internal entry shape.
- CRUD needed: GET children + their timeline entries (diaper/feeding/medication/temperature/tummy-time/sleep/notes), POST new entries, PATCH edits, DELETE entries. Medication scheduling math (needed/eligible windows) should run client-side over fetched entries, same as the prototype's `neededList`/`eligibleList` logic.
- Timers: Baby Buddy has native timer endpoints (start/stop) — prefer wiring to those rather than only client-side elapsed-time tracking, so timers survive app kill/reinstall and show up in the Baby Buddy web UI too.

## Design Tokens

**Typography:** Nunito (400/600/700/800/900), loaded via Google Fonts in the prototype — bundle as a local font asset in RN (`react-native.config.js` + `expo-font`, or link natively). Weight map used: 400 (rare), 600 (body/labels), 700 (medium emphasis/chips), 800 (headings/values/buttons), 900 (unused but available).

**Type scale:** 22px (screen titles), 17–18px (card titles/big values), 13–14px (body/buttons), 11–12px (meta/labels), 10px (uppercase micro-labels, button captions).

**Colors** (defined in OKLCH in the prototype — convert to hex for RN `StyleSheet`; approximate sRGB hex given):
- Background: `oklch(0.965 0.012 70)` ≈ `#F7F3EF`
- Card white: `#FFFFFF`
- Accent (primary buttons, active states): `oklch(0.75 0.12 30)` ≈ `#E0906B` (warm terracotta/apricot)
- Text primary: `oklch(0.28 0.02 50)` ≈ `#3A3230`
- Text muted: `oklch(0.55 0.02 50)` ≈ `#8C827E`
- Text secondary/labels: `oklch(0.5 0.02 50)` ≈ `#7D746F`
- Pee tint: `oklch(0.97 0.015 220)` bg / `oklch(0.5 0.08 220)` fg (soft blue)
- Poo tint: `oklch(0.96 0.02 80)` bg / `oklch(0.5 0.08 80)` fg (soft amber)
- Feeding tint: `oklch(0.94 0.04 30)` bg / `oklch(0.45 0.1 30)` fg (warm peach)
- Medication "eligible" tint: `oklch(0.97 0.02 350)` bg / `oklch(0.45 0.12 350)` fg (soft pink)
- Overdue/urgent tint: `oklch(0.95 0.05 20)` bg / `oklch(0.5 0.14 20)` fg (soft red)
- Sleep tint: `oklch(0.95 0.02 260)` (soft lavender)
- Tummy tint: `oklch(0.95 0.02 140)` (soft green)
- Danger (delete): `oklch(0.55 0.16 20)` ≈ `#C4462B`
- Neutral chip/disabled bg: `oklch(0.93–0.94 0.01–0.02 50)` ≈ `#EDE9E6`
- Per-child avatar tint: `oklch(0.93 0.05 {hue})` bg / `oklch(0.5 0.1 {hue})` fg, hue varies per child (30/200/320/100 used in demo data) for quick visual distinction.

**Spacing scale:** 6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 / 22 / 26 / 30px — used consistently for padding/gaps, no arbitrary values.

**Radii:** 8px (small icon buttons) / 10–12px (chips, small cards, stat tiles) / 14px (buttons, inputs, medium cards) / 16px (feed rows) / 20px (pills) / 24px (main cards, sheet top corners).

**Shadows:** cards use a soft, low-opacity warm-toned shadow: `0 6px 20px rgba(0,0,0,0.08)` for primary cards, `0 2px 8px rgba(0,0,0,0.05)` for feed rows — translate to RN `elevation`/`shadowOffset`/`shadowRadius`/`shadowOpacity`.

## Assets
No bitmap/icon assets — all icon-like glyphs (diaper, bottle, moon, medication capsule, sleep, tummy, more/dots, back chevron, close X) are drawn from plain `<div>` shapes with borders/radii/gradients in the prototype. For RN, either recreate as simple vector shapes (View-based) or swap in a proper icon set (e.g. Phosphor/Lucide) matched to the same visual weight — ask the design owner which they'd prefer before substituting an icon library, since the current glyphs are intentionally minimal/geometric.

## Screenshots
`screenshots/01-login.png`, `02-dashboard.png`, `03-log-entry-feeding.png`, `04-settings.png` — reference captures of the live prototype for the core screens.

## Files
- `Baby Buddy Dashboard App.dc.html` — the main interactive prototype: Login, Dashboard (carousel + tabs variants), Log Entry form (all 7 types), Settings, Delete confirmation. This is the primary reference — it's a working state machine, so click through it to see exact conditional logic.
- `Baby Dashboard Options.dc.html` — earlier design exploration/options canvas (nav pattern alternatives, per-type form mockups). Useful for extra screen-state reference (e.g. isolated Diaper/Medication/Temperature/Sleep form screenshots) but superseded by the main file for overall behavior.
- `android-frame.jsx` — prototyping-only phone bezel component; not for porting.
- `support.js` — prototyping runtime; not for porting.
