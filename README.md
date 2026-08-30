# Baby Buddy — Mobile Dashboard

A warm, fast Android app for logging your baby's day — diapers, feedings, medications, temperature, tummy time, and sleep — for one child or several. See at a glance how long it's been since the last change, feed, or nap; keep an eye on medication timing; run background timers; and get gentle reminders when something's due. It connects to your [Baby Buddy](https://github.com/babybuddy/babybuddy) server, works through the Home Assistant add-on, or runs entirely **offline** on your phone with no server at all.

> **Independent app.** This is a third-party client for a Baby Buddy server and isn't affiliated with or endorsed by the Baby Buddy project.

---

## Contents

- [Install on your phone](#install-on-your-phone)
- [What you can do with it](#what-you-can-do-with-it)
- [How you connect](#how-you-connect)
- [Getting started in 5 steps](#getting-started-in-5-steps)
- [Full user manual](#full-user-manual)
- [Privacy & your data](#privacy--your-data)
- [For developers](#for-developers)
- [License](#license)

---

## Install on your phone

The app is distributed as an Android `.apk` file on the **[GitHub Releases](https://github.com/MosheRW/baby-buddy-native/releases)** page.

1. On your Android phone, open **[github.com/MosheRW/baby-buddy-native/releases](https://github.com/MosheRW/baby-buddy-native/releases)**.
2. Under the newest release's **Assets**, tap the **`.apk`** file to download it.
3. Open the download. The first time, Android asks whether to allow installing apps from your browser — tap through to **Install unknown apps**, turn it on, then come back and tap **Install**.
4. Open **Baby Buddy** and sign in (see [Getting started](#getting-started-in-5-steps)).

**Updating** is the same: download the newer release's APK and install it over the top. Your data and sign-in are kept.

Android shows an "unknown source" warning because the file isn't delivered through the Google Play Store. That's expected for a directly-distributed app. The release APKs are complete builds, so every feature works — including reminders and the live timer in your notification shade.

## What you can do with it

- **Log everything in seconds.** One quick tap on the dashboard opens a form already set to the right child and type. Diaper (pee and poo tracked separately, with colour and consistency), feeding (breast, bottle, or solids — by amount or by duration), medication (dose, unit, route, and scheduling), temperature, tummy time, sleep, and free-text notes.
- **See "how long since…" at a glance.** Each child's card shows time since the last diaper, feed, and sleep, updating on its own, alongside a 24-hour food summary and a food-trend bar.
- **Stay on top of medications.** The app tells you when a dose is due, overdue, or allowed again, tracks 24-hour limits, and lets you log a repeat dose with one tap.
- **Run timers that don't stop when you close the app.** Start a feeding, sleep, or tummy-time timer and finish it later — it turns into a ready-to-save entry.
- **Get reminders that stay honest.** Medication-due nudges, forgotten-timer alerts, diaper-interval and minimum-feed reminders, a live ticking countdown to the next dose, and a weekly summary of what you logged. Every reminder is re-checked against the server before it shows, so it never nags you about something another caregiver already handled.
- **Tailor it to your family.** Hide children, group them, give each a colour, and set schedules that quietly hide a child during set hours. Shake the phone to peek at hidden children.
- **Make it yours to look at.** Light, dark, or follow-the-system theming; optional Material You colour from your wallpaper (Android 12+); and **English or Hebrew** (right-to-left), following your Baby Buddy profile by default.

## How you connect

You choose one of these when you first sign in — and can switch later by signing out:

| Mode | Use it when | You'll need |
| --- | --- | --- |
| **Baby Buddy** | You host Baby Buddy yourself | The server URL + your username & password (or an API key, or a QR login) |
| **Home Assistant** | You run the Baby Buddy add-on in Home Assistant | The add-on URL + a long-lived access token |
| **Offline** | You want no server at all, just this phone | Nothing — you name your first child on the way in |

The [user manual](docs/USER_MANUAL.md#2-signing-in) walks through exactly what to enter in each.

## Getting started in 5 steps

1. **Sign in** using one of the modes above.
2. On the **dashboard**, tap a quick action — **Diaper, Food, Sleep, Tummy, Medication,** or **More** — to open a pre-filled form, or tap a child's card to see their details.
3. In the form, pick the **Type**, fill in the fields that appear, check the **time**, and tap **Save**. For sleep, feeding, and tummy time you can **Start a timer** instead and stop it when you're done.
4. Back on the dashboard, watch the **time-since-last** stats and **medication windows** keep themselves up to date. Tap a medication row to log a repeat dose.
5. Open **Settings** to set reminders, per-child food defaults, language, theme, and to sign out.

That's the whole loop. Everything else — every entry type, timers, medication windows, notifications, multi-child setup — is covered in the manual.

## Full user manual

The complete, screen-by-screen guide is in **[docs/USER_MANUAL.md](docs/USER_MANUAL.md)**. It covers:

- [Getting the app](docs/USER_MANUAL.md#1-getting-the-app) and [signing in](docs/USER_MANUAL.md#2-signing-in) for every mode
- [The dashboard](docs/USER_MANUAL.md#3-the-dashboard) and [logging an entry](docs/USER_MANUAL.md#4-logging-an-entry)
- [Every entry type in detail](docs/USER_MANUAL.md#5-entry-types-in-detail)
- [Timers](docs/USER_MANUAL.md#6-timers) and [medication windows](docs/USER_MANUAL.md#7-medications-windows--the-breakdown-sheet)
- [Notifications & reminders](docs/USER_MANUAL.md#8-notifications--reminders)
- [Multiple children: hiding, groups, colours & schedules](docs/USER_MANUAL.md#9-multiple-children-hiding-groups-colours--schedules)
- [Appearance, language & time format](docs/USER_MANUAL.md#10-appearance-language--time-format)
- [Sharing with another caregiver](docs/USER_MANUAL.md#11-sharing-your-instance-with-another-caregiver) and [offline mode](docs/USER_MANUAL.md#12-offline-mode)
- [FAQ](docs/USER_MANUAL.md#14-frequently-asked-questions)

## Privacy & your data

- Your **password is never stored.** It's used once to obtain an access token, which is then kept in your phone's secure storage; from then on only the token is used.
- In **offline mode**, everything you log stays on your device — no account, no network.
- In the online modes, your data lives on **your own server**; the app only talks to the server you point it at.

## For developers

Setup, build, architecture, and testing docs are in **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)**. In short: `npm install` then `npx expo start`. The app is built with Expo + React Native (TypeScript), targets Android, and supports English and Hebrew.

## License

Copyright © 2026 Moshe Winberg.

This program is free software: you can redistribute it and/or modify it under the terms of the **GNU General Public License v3.0** as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

It is distributed in the hope that it will be useful, but **WITHOUT ANY WARRANTY**; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the [GNU General Public License](LICENSE) for details.

Baby Buddy itself is a separate project with its own license; this app is an independent client and is not endorsed by or affiliated with it.
