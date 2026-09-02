import { Locals } from "./locals.interface";

/**
 * English translations — the single source of truth for user-facing copy.
 *
 * IMPORTANT: several values here are relied upon by unit tests that assert the
 * exact rendered string (dates, medication status, ageLabel, foodTrendLabel,
 * …). Those tests run with the default `en` language, so keep these byte-for-
 * byte identical to what the pure functions used to return. `he.ts` mirrors
 * this shape.
 */
export const en: Locals = {
  common: {
    save: 'Save',
    saving: 'Saving…',
    cancel: 'Cancel',
    delete: 'Delete',
    deleting: 'Deleting…',
    close: 'Close',
    back: 'Back',
    dismiss: 'Dismiss',
    retry: 'Retry',
    ok: 'OK',
  },

  errorBoundary: {
    title: 'Something went wrong',
    body: 'This screen ran into an unexpected error. You can try again.',
    retry: 'Try again',
  },

  stepper: {
    increase: 'Increase',
    decrease: 'Decrease',
    editValue: 'Edit value',
    resetHint: 'Long-press to reset to the default value',
    editTitle: 'Enter a value',
    invalidTitle: 'Invalid value',
    rangeBoth: 'Enter a number between {{min}} and {{max}}.',
    rangeMin: 'Enter a number of at least {{min}}.',
    rangeMax: 'Enter a number of at most {{max}}.',
    rangeAny: 'Enter a valid number.',
    hours: 'Hours',
    minutes: 'Minutes',
  },

  login: {
    title: 'Baby Buddy Mobile Dashboard',
    subtitle: 'Connect to your server',
    modeBabyBuddy: 'Baby Buddy server',
    modeHomeAssistant: 'Home Assistant',
    modeLocal: 'Offline',
    serverUrl: 'Server URL',
    addOnUrl: 'Add-on URL',
    serverUrlPlaceholder: 'https://babybuddy.example.com',
    httpWarning:
      'This address uses http://, so your API token and data are sent unencrypted. Only use it on a network you trust; prefer https:// otherwise.',
    addOnUrlPlaceholder: 'http://homeassistant.local:8123/addon-slug',
    apiKey: 'API key',
    apiKeyPlaceholder: 'Paste from Baby Buddy → user settings',
    username: 'Username',
    usernamePlaceholder: 'sarah',
    password: 'Password',
    passwordPlaceholder: '••••••••',
    haHint:
      "Include the add-on's ingress path in the URL. The key is the Baby Buddy API key from its user settings, not a Home Assistant token.",
    enterServerUrl: 'Enter your server URL.',
    passwordFallback: '{{message}} Paste your API key from Baby Buddy’s user settings instead.',
    connecting: 'Connecting…',
    connect: 'Connect',
    logIn: 'Log in',
    useUsernamePassword: 'Use username and password',
    useApiKey: 'Use an API key instead',
    subtitleLocal: 'Track everything on this device',
    offlineHint: 'No server needed — everything is saved on this device only.',
    babyName: "Baby's name",
    babyNamePlaceholder: 'Emma',
    babyBirthDate: 'Birth date',
    enterBabyName: "Enter your baby's name.",
    startOffline: 'Start offline',
    continueOffline: 'Continue offline',
    offlineExistingData: 'Offline data ready for {{names}}.',
    scanQr: 'Scan a sign-in QR code',
  },

  dashboard: {
    greetingWithName: '{{greeting}}, {{name}}',
    recentActivity: 'RECENT ACTIVITY',
    noEntries: 'No entries for this filter yet.',
    tagFilter: 'Tag: {{tag}} ×',
    clearTagFilter: 'Clear tag filter {{tag}}',
    editEntry: 'Edit entry',
    deleteEntry: 'Delete entry',
    filterByTag: 'Filter by tag {{tag}}',
    addTag: 'Add tag {{tag}}',
    switchToChild: 'Switch to {{name}}',
    showHidden_one: 'Show one hidden child',
    showHidden_other: 'Show {{count}} hidden children',
  },

  filter: {
    all: 'All',
  },

  quickAction: {
    diaper: 'Diaper',
    food: 'Food',
    sleep: 'Sleep',
    tummy: 'Tummy',
    medication: 'Medication',
    more: 'More',
  },

  childCard: {
    lastPee: 'Last pee',
    lastPoo: 'Last poo',
    lastFeeding: 'Last feeding',
    lastFeedingValue: '{{title}} · {{ago}}',
    foodWindow: 'Food, {{window}}',
    foodValue: '{{amount}} ml',
    logDose: 'Log a dose of {{name}}',
    lastAt: 'last {{time}}',
    limitAria: '{{name}} 24-hour total, {{taken}} of {{limit}}',
  },

  med: {
    unitLabel: {
      mg: 'mg',
      ml: 'ml',
      tablets: 'Tablets',
      drops: 'Drops',
      paste: 'Paste',
    },
    // The word units keep a leading space ("5 tablets"), symbol units don't.
    unitSuffix: {
      mg: 'mg',
      ml: 'ml',
      tablets: ' tablets',
      drops: ' drops',
      paste: ' paste',
    },
    doseFieldLabel: 'Dose ({{unit}})',
    status: {
      sinceLastDose: '{{duration}} since last dose',
      overdueBy: 'overdue by {{duration}}',
      dueIn: 'due in {{duration}}',
      eligibleNow: 'eligible now',
      eligibleIn: 'eligible in {{duration}}',
    },
    eligibleNowShort: 'now',
    eligibleInShort: 'in {{duration}}',
    repeatLabel: {
      scheduled: 'Repeat next dose in',
      asNeeded: 'Eligible again after',
    },
    breakdownTitle: 'Medication · last 24h',
    breakdownEmpty: 'Nothing given in the last 24 hours.',
    doses_one: 'one dose',
    doses_other: '{{count}} doses',
    maxReached: ' · max dose reached',
    stillAvailable: ' · {{amount}} still available',
    noLimit: ' · no 24h limit set',
  },

  entryType: {
    diaper: 'Diaper',
    feeding: 'Feeding',
    medication: 'Medication',
    temperature: 'Temp',
    tummyTime: 'Tummy time',
    sleep: 'Sleep',
    note: 'Note',
  },

  entryTitle: {
    diaperBoth: 'Wet + dirty diaper',
    diaperDirty: 'Dirty diaper',
    diaperWet: 'Wet diaper',
    sleeping: 'Sleeping',
    sleep: 'Sleep',
    tummyTime: 'Tummy time',
    note: 'Note',
  },

  feeding: {
    kind: {
      breastMilk: 'Breast Milk',
      formula: 'Formula',
      fortifiedBreastMilk: 'Fortified Breast Milk',
      solidFood: 'Solid Food',
    },
    method: {
      bottle: 'Bottle',
      leftBreast: 'Left Breast',
      rightBreast: 'Right Breast',
      bothBreasts: 'Both Breasts',
      selfFed: 'Self Fed',
      parentFed: 'Parent Fed',
    },
    solid: {
      fruits: 'Fruits',
      vegetables: 'Vegetables',
      grains: 'Grains',
      protein: 'Protein',
      dairy: 'Dairy',
    },
    // Leading spaces are intentional — the stepper concatenates them.
    amountUnitSolid: ' g',
    amountUnitLiquid: ' ml',
    trendLabel: '{{last24}}ml today vs {{avg}}ml/day (7d avg)',
    trendLabelActive: '{{last24}}ml today vs {{avg}}ml/day ({{days}}d active avg)',
    typeLabel: 'Type',
    methodLabel: 'Method',
    foodTypeLabel: 'Food type',
    amountLabel: 'Amount',
    durationLabel: 'Duration',
    durationSuffix: ' min',
  },

  temperature: {
    method: {
      oral: 'Oral',
      ear: 'Ear',
      forehead: 'Forehead',
    },
    valueLabel: 'Temperature (°C)',
    valueSuffix: '°C',
    methodLabel: 'Method',
  },

  diaper: {
    contents: 'Contents',
    pee: 'Pee',
    poo: 'Poo',
    pooColor: 'Poo color',
    pooColorAria: '{{color}} poo color',
    amountSuffix: ' / 10',
    amountLabel: {
      both: 'Amount',
      poo: 'Poo amount',
      pee: 'Pee amount',
    },
    selectOne: 'Select pee, poo, or both to save.',
  },

  medForm: {
    recent: 'Recent medications',
    recentMeta: '{{dose}} · every {{hours}}h',
    name: 'Medicine name',
    namePlaceholder: 'e.g. Tylenol',
    schedule: 'Schedule',
    scheduled: 'Scheduled',
    asNeeded: 'As-needed',
    unit: 'Unit',
    route: 'Route',
    routeOrally: 'Orally',
    routeAnal: 'Anal',
    bodyArea: 'Body area',
    bodyAreaPlaceholder: 'e.g. chest, back',
    once: 'Once',
    custom: 'Custom',
    customSuffix: ' h',
    maxDose: 'Max dose per 24h (optional)',
    maxDoseHint:
      'Leave blank to keep whatever limit this medicine already has. We’ll warn before a dose would exceed it in a rolling 24h window.',
    noLimitPlaceholder: 'No limit ({{unit}})',
  },

  sleep: {
    typeLabel: 'Type',
    nap: 'Nap',
    night: 'Night',
    stillSleeping: 'Still sleeping',
    wokeUpAt: 'Woke up at',
    turnOffHint: 'Turn off to record a wake time',
  },

  timer: {
    start: 'Start timer',
    running: 'Timer running',
    stop: 'Stop',
    startAria: 'Start timer',
    stopAria: 'Stop timer',
    typeLabel: {
      feeding: 'Feeding',
      sleep: 'Sleep',
      tummyTime: 'Tummy time',
    },
  },

  logEntry: {
    editTitle: 'Edit entry',
    newTitle: 'New entry',
    readOnlyOthers: 'Only the caregiver who logged this can edit or delete it.',
    readOnlyOthersBy: 'Only {{name}}, who logged this, can edit or delete it.',
    close: 'Close',
    time: 'Time',
    endTime: 'End time',
    note: 'Note',
    notePlaceholder: 'Optional note',
    tags: 'Tags',
    addTagOffer: '+ {{tag}}',
    addTagPlaceholder: 'Add a tag',
    addTagButton: 'Add',
    removeTag: 'Remove tag {{tag}}',
    saveDetails: 'Save details',
    saveAndEnd: 'Save and end {{activity}}',
    // The two modals a notification action button can open this form with
    // (issue #45): "cancel <timer>" asks for confirmation before discarding a
    // running timer, "end feeding" asks for the amount before saving.
    cancelTimerTitle: 'Discard the {{activity}} timer?',
    cancelTimerBody: 'The timer stops and nothing is saved.',
    cancelTimerConfirm: 'Discard timer',
    cancelTimerKeep: 'Keep running',
    quantityTitle: 'How much did {{child}} take?',
    activity: {
      feeding: 'feeding',
      sleep: 'sleep',
      tummyTime: 'tummy time',
    },
  },

  dateTime: {
    placeholder: 'YYYY-MM-DD HH:mm',
    dateAria: '{{label}} date',
    timeAria: '{{label}} time',
  },

  deleteSheet: {
    title: 'Delete this entry?',
    body: "{{label}}. This can't be undone.",
  },

  settings: {
    title: 'Settings',
    display: 'Display',
    theme: 'Theme',
    children: 'Children',
    mlSuffix: ' ml',
    visibilityToggle: 'Show {{name}} on the dashboard',
    newChildren: 'New children',
    newChildrenHint: 'Whether children added later start out shown or hidden on the dashboard.',
    visibilityVisible: 'Shown',
    visibilityHidden: 'Hidden',
    serverHomeAssistant: 'Home Assistant server',
    serverBabyBuddy: 'Baby Buddy server',
    loggedInAs: 'Logged in as {{name}}',
    accessToken: 'Access token {{token}}',
    logOut: 'Log out',
    language: 'Language',
    languageEnglish: 'English',
    languageHebrew: 'עברית',
    appearance: 'Appearance',
    appearanceSystem: 'System',
    appearanceLight: 'Light',
    appearanceDark: 'Dark',
    appearanceSystemHint: 'Follows your device’s light or dark setting.',
    dynamicColor: 'Match phone color scheme',
    dynamicColorHint: 'Recolours buttons and the header to match your wallpaper (Android 12+).',
    offlineTitle: 'Offline mode',
    offlineHint: 'This device holds all your data. Nothing is sent to a server.',
    childName: 'Name',
    childBirthDate: 'Birth date',
    showOnDashboard: 'Show on the dashboard',
    defaultFood: 'Default food quantity',
    addChild: 'Add child',
    removeChild: 'Remove {{name}}',
    newChildDefault: 'Baby',
    timeFormat: 'Time format',
    timeFormatText: 'Text (2h 30m)',
    timeFormatDigital: 'Digital (2:30)',
    timeFormatHint: 'How durations and running timers are shown.',
  },

  advanced: {
    // Settings-screen navigation row. (Route/keys keep the legacy `advanced`
    // name; the screen now reads as "Children & groups".)
    navTitle: 'Children & groups',
    navHint: "Each child's colour, group, food, and reminders.",
    // Children & groups screen.
    title: 'Children & groups',
    groups: 'Groups',
    noGroups: 'No groups yet.',
    addGroup: 'Add group',
    newGroupName: 'New group',
    groupMembers_one: 'one child',
    groupMembers_other: '{{count}} children',
    kids: 'Children',
    kidsHint: 'Tap a child to set its colour, group, food, visibility, and reminders.',
    hiddenBadge: 'Hidden',
    // Kid editor.
    kidVisibility: 'Show on the dashboard',
    accentColor: 'Accent colour',
    accentAuto: 'Auto',
    accentMatchPhone: 'Match phone',
    accentKidHint: 'Overrides the group colour for this child.',
    group: 'Group',
    groupNone: 'None',
    // Per-child reminder timing (moved here from the Notifications screen).
    kidReminders: 'Reminder timing',
    kidRemindersHint: 'Applied when the matching reminder is turned on in Notifications.',
    // Group editor.
    groupName: 'Group name',
    accentGroupHint: 'Applied to members that don’t set their own colour.',
    groupHidden: 'Hide the whole group',
    groupHiddenHint: 'Every child in this group leaves the dashboard.',
    members: 'Members',
    memberToggle: 'Include {{name}} in this group',
    deleteGroup: 'Delete group',
    // Shake to reveal.
    shakeTitle: 'Shake to reveal',
    shakeHint: 'Shake the device to show hidden children for a while.',
    shakeDuration: 'Reveal for',
    shakeMinSuffix: ' min',
  },

  share: {
    // Settings-screen navigation row (admin only).
    navTitle: 'Share this server',
    navHint: 'Add caregivers and share a sign-in QR code.',
    // Screen.
    title: 'Share',
    checking: 'Checking your access…',
    // Unlock (re-authenticate to open the admin web session).
    unlockTitle: 'Confirm you’re an admin',
    unlockHint: 'Managing caregivers uses admin-only pages. Enter your password to continue.',
    unlock: 'Unlock',
    enterAdminCredentials: 'Enter your username and password.',
    notAdmin: 'This account isn’t an admin on this server.',
    // Share the admin's own login.
    ownLoginTitle: 'Share your own sign-in',
    ownLoginHint: 'Anyone who scans this signs in as you.',
    showOwnQr: 'Show my sign-in QR',
    // Add a caregiver.
    addTitle: 'Add a caregiver',
    caregiverName: 'Username',
    caregiverNamePlaceholder: 'grandma',
    caregiverFirstName: 'First name',
    caregiverLastName: 'Last name',
    caregiverPassword: 'Password',
    staffToggle: 'Admin (staff)',
    staffHint: 'Staff users can manage the server and other caregivers.',
    staffWarnTitle: 'Admin usually isn’t needed',
    staffWarnBody:
      'A regular caregiver can already log everything for every child. Admin also lets them manage users and change server settings. Grant it only if you mean to.',
    staffWarnDontAsk: 'Don’t warn me again for 15 minutes',
    staffWarnContinue: 'Create as admin',
    addCaregiver: 'Create and show QR',
    enterCaregiver: 'Enter a username and password.',
    tokenCreateFailed:
      'The caregiver was created, but a sign-in token could not be generated. Check that your account has admin rights, then tap the user in the list.',
    // QR captions + warning.
    qrCaptionOwn: 'Scan to sign in as you',
    qrCaptionCaregiver: 'Scan to sign in as {{name}}',
    qrWarning: 'This code contains a live sign-in credential. Only show it to people you trust.',
    // Created-this-session list.
    createdTitle: 'Added this session',
    showQr: 'Show QR',
    // Existing users list.
    usersTitle: 'All users',
    noUsers: 'No users found.',
    usersHint: 'A QR can only be made for caregivers you add here (their password is known).',
    usersTokenHint:
      'Tap a user to show their sign-in QR. Users without a token yet must sign in once first.',
    // Scanner.
    scanTitle: 'Scan to sign in',
    scanHint: 'Point the camera at a Baby Buddy sign-in QR code.',
    cameraNeeded: 'Camera access is needed to scan a QR code.',
    grantCamera: 'Allow camera',
  },

  schedule: {
    title: 'Hide on a schedule',
    hint: 'Hidden only during this daily window.',
    from: 'From',
    to: 'To',
    days: 'Days',
    everyDay: 'Applies every day.',
    selectedDays: 'Applies only on the selected days.',
  },

  notifications: {
    // Settings-screen navigation row.
    navTitle: 'Notifications',
    navHint: 'Reminders for medications, timers, and more.',
    // Notification settings screen.
    title: 'Notifications',
    // Group headings that break the long screen into scannable sections.
    groupGeneral: 'General',
    groupReminders: 'Reminders',
    groupOngoing: 'Ongoing',
    groupDigest: 'Digest',
    enable: 'Enable notifications',
    enableHint: 'Local reminders, scheduled on this device.',
    blocked: 'Notifications are blocked. Turn them on for Baby Buddy in your device settings.',
    unsupported: "Notifications aren't available on this platform.",
    backgroundTitle: 'Background updates',
    backgroundHint:
      'Let Baby Buddy refresh in the background so reminders stay accurate while the app is closed. Android checks in roughly every 15 minutes, not instantly.',
    backgroundRestricted:
      'Background activity is restricted. Allow it for Baby Buddy (turn off battery optimization) in your device settings.',
    backgroundUnsupported: "Background updates aren't available on this platform.",
    scheduledMedsTitle: 'Scheduled medications',
    scheduledMedsHint: 'Remind me when a scheduled dose is due.',
    eligibilityTitle: 'Medication eligibility',
    eligibilityHint:
      'Remind me when an as-needed medicine can be given again, or its 24h limit frees up.',
    forgottenTitle: 'Forgotten timers',
    forgottenHint: 'Warn me when a timer has been running unusually long.',
    forgottenGeneralLabel: 'Feeding & tummy time',
    forgottenSleepLabel: 'Sleep',
    liveTitle: 'Running timers',
    liveHint: 'Keep a live notification in the tray while a timer runs.',
    liveMedTitle: 'Medication countdown',
    liveMedHint: 'Show a live countdown to the next dose, then how long it is overdue.',
    diaperTitle: 'Diaper changes',
    diaperHint: "Remind me when it's been too long since the last change.",
    foodTitle: 'Feeding gaps',
    foodHint: "Remind me when it's been too long since the last feed.",
    feedingScheduleTitle: 'Feeding schedule',
    feedingScheduleHint: 'Expected time between feeds. Also sets the dashboard food-total window.',
    feedingInterval: 'Time between feeds',
    weeklyTitle: 'Weekly summary',
    weeklyHint: 'A weekly recap of what you logged, and how it compares with the other caregivers.',
    weeklyDay: 'Day',
    weeklyTime: 'Time',
    weeklyHourSuffix: ':00',
    weekdayShort: {
      0: 'Sun',
      1: 'Mon',
      2: 'Tue',
      3: 'Wed',
      4: 'Thu',
      5: 'Fri',
      6: 'Sat',
    },
    maxGap: 'Max gap',
    targetAmount: 'Target amount',
    before: 'Before',
    atTime: 'At the time',
    after: 'After',
    minSuffix: ' min',
    // Delivered-notification titles + bodies. `_noChild` is the i18next context
    // variant used when the child can't be resolved.
    titleMedDue: 'Medication due',
    titleMedReady: 'Medication ready',
    titleTimerRunning: 'Timer still running',
    titleDiaperDue: 'Diaper check',
    titleFoodDue: 'Feeding reminder',
    // Android notification action buttons. Which of these a reminder shows is
    // decided by the planner (see `NotificationActionId`), per case and phase.
    actionRemindLater: 'Remind later',
    actionAddNow: 'Add now',
    actionOk: 'OK',
    actionRemindOnTime: 'Remind me on time',
    // {{activity}} is the timer's own label (timer.typeLabel.*), so one string
    // covers sleep / feeding / tummy time and stays grammatical when translated.
    actionCancelTimer: 'Cancel {{activity}}',
    actionEndTimer: 'End {{activity}}',
    snoozeTitle: 'Remind later delay',
    snoozeHint: 'How long "Remind later" on a notification postpones it by.',
    medDueBefore: '{{med}} for {{child}} is due in {{duration}}.',
    medDueBefore_noChild: '{{med}} is due in {{duration}}.',
    medDueAt: '{{med}} for {{child}} is due now.',
    medDueAt_noChild: '{{med}} is due now.',
    medDueAfter: '{{med}} for {{child}} was due {{duration}} ago.',
    medDueAfter_noChild: '{{med}} was due {{duration}} ago.',
    eligBefore: '{{med}} for {{child}} can be given again in {{duration}}.',
    eligBefore_noChild: '{{med}} can be given again in {{duration}}.',
    eligAt: '{{med}} for {{child}} can be given again now.',
    eligAt_noChild: '{{med}} can be given again now.',
    eligAfter: '{{med}} for {{child}} has been due for another dose for {{duration}}.',
    eligAfter_noChild: '{{med}} has been due for another dose for {{duration}}.',
    timerBody:
      '{{activity}} timer for {{child}} has been running over {{duration}} — did you forget to stop it?',
    timerBody_noChild:
      '{{activity}} timer has been running over {{duration}} — did you forget to stop it?',
    liveTimerTitle: '{{activity}} timer running',
    liveTimerBody: '{{child}} · running for {{duration}}',
    liveTimerBody_noChild: 'Running for {{duration}}',
    // Live-chronometer notifications: the OS draws the ticking clock, so these
    // are just the accompanying text line, no {{duration}}.
    liveChronoRunning: 'Running',
    liveMedBody: '{{med}} · {{child}}',
    liveMedBody_noChild: '{{med}}',
    diaperBody: "{{child}} hasn't had a diaper change in {{duration}}.",
    // The feeding-gap bodies. `foodBody*` is the "at" phase and keeps the
    // original wording (duration = the child's feeding interval); the before/
    // after variants are relative to that deadline, like the medication ones.
    foodBody: "{{child}} hasn't been fed in {{duration}}.",
    foodBodyMin: "{{child}} hasn't been fed in {{duration}} — aim for at least {{min}}ml.",
    foodBefore: '{{child}} is due for a feed in {{duration}}.',
    foodBeforeMin: '{{child}} is due for a feed in {{duration}} — aim for at least {{min}}ml.',
    foodAfter: '{{child}} was due for a feed {{duration}} ago.',
    foodAfterMin: '{{child}} was due for a feed {{duration}} ago — aim for at least {{min}}ml.',
    titleWeekly: 'Your week in review',
    weeklyBody:
      "You logged {{mine}} of {{total}} entries this week — {{share}}% of the family's total. {{breakdown}}",
    weeklyBodySolo: 'You logged {{mine}} entries this week. {{breakdown}}',
    // Second line of the weekly body, listing the same week split by kid group.
    weeklyGroups: 'By group: {{breakdown}}',
    // Wraps any body above when the reminder couldn't be confirmed against the
    // server before being shown. A whole-sentence template, not a bare suffix, so
    // a locale can place the caveat wherever it reads naturally.
    unverified: "{{body}} (Couldn't check with the server — this may be out of date.)",
    // In-app carousel of already-delivered reminders, shown above the child card.
    carouselHeading: 'Notifications',
    dismissOne: 'Dismiss notification',
    dismissAll: 'Clear all',
  },

  // The on-demand caregiver-contribution recap (the weekly summary, readable at
  // any time from notification settings).
  contribution: {
    title: 'Your week in review',
    viewNow: "View this week's summary",
    window: 'Last {{days}} days',
    youLogged: 'You logged',
    shareCaption: "of {{total}} entries — {{share}}% of the family's total",
    soloCaption: 'entries — nobody else logged anything this week',
    byCategory: 'By category',
    byGroup: 'By group',
    empty: 'Nothing was logged in the last {{days}} days.',
    noUser: "Your account name isn't available, so your share can't be worked out.",
    hiddenNote_one: 'one hidden child is not counted.',
    hiddenNote_other: '{{count}} hidden children are not counted.',
  },

  // User-facing failure titles, shown as error cards in the dashboard carousel.
  // The body is the underlying `errorMessage(...)`, so these are just the "what
  // failed" headline.
  errors: {
    loadTitle: "Couldn't load your data",
    saveTitle: "Couldn't save your entry",
    deleteTitle: "Couldn't delete your entry",
    dismissOne: 'Dismiss error',
  },

  dates: {
    now: 'now',
    minutesAgo: '{{m}}m ago',
    hoursAgo: '{{h}}h ago',
    hoursMinutesAgo: '{{h}}h {{m}}m ago',
    hoursMinutesAgoDigital: '{{h}}:{{mm}} ago',
    daysAgo: '{{d}}d ago',
    today: 'Today',
    yesterday: 'Yesterday',
    greeting: {
      morning: 'Good morning',
      afternoon: 'Good afternoon',
      evening: 'Good evening',
    },
  },

  duration: {
    hoursMinutes: '{{h}}h {{m}}m',
    minutes: '{{m}}m',
  },

  age: {
    days_one: 'a day old',
    days_other: '{{count}} days old',
    months_one: 'a month old',
    months_other: '{{count}} months old',
    years_one: 'a year old',
    years_other: '{{count}} years old',
  },

  about: {
    // Settings-screen navigation row.
    navTitle: 'About',
    navHint: 'Credits, version, and links.',
    // About screen.
    title: 'About',
    // About me + about the app.
    aboutMeTitle: 'About me',
    aboutMeBody:
      'Moshe Winberg is a full-stack developer who values order and clarity, building digital products with a precise and thoughtful approach. Among his projects is a mobile app designed to give users a simple, convenient, and secure experience.',
    linkedIn: 'LinkedIn profile',
    aboutAppTitle: 'About this app',
    aboutAppBody:
      'A mobile dashboard for a self-hosted Baby Buddy server. Log diapers, feedings, medications, sleep and more, and see time-since-last stats at a glance.',
    userManual: 'User manual',
    // Version (double-tap opens the release announcement).
    versionTitle: 'Version',
    versionValue: 'Version {{version}}',
    versionHint: 'Tap twice — or press and hold — to open the release announcement.',
    // Links group.
    linksTitle: 'Links',
    webApp: 'Web app',
    discussions: 'Discussions',
    playStore: 'Get it on Google Play',
    privacyPolicy: 'Privacy policy',
    reportBug: 'Report a bug',
    sourceCode: 'Source code',
    opensExternally: 'Opens in your browser',
    // Share.
    shareTitle: 'Share this app',
    shareHint: 'Tell another caregiver about Baby Buddy.',
    shareButton: 'Share',
    shareBody: 'Baby Buddy Mobile Dashboard — a phone dashboard for Baby Buddy: {{url}}',
    // Donate (non–Play Store builds only).
    donateTitle: 'Support development',
    donateHint: 'If this app helps you, you can buy me a coffee.',
    buyMeACoffee: 'Buy me a coffee',
  },
} as const;

