/**
 * English translations — the single source of truth for user-facing copy.
 *
 * IMPORTANT: several values here are relied upon by unit tests that assert the
 * exact rendered string (dates, medication status, ageLabel, foodTrendLabel,
 * …). Those tests run with the default `en` language, so keep these byte-for-
 * byte identical to what the pure functions used to return. `he.ts` mirrors
 * this shape.
 */
export const en = {
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
  },

  login: {
    title: 'Baby Buddy Dashboard',
    subtitle: 'Connect to your server',
    modeBabyBuddy: 'Baby Buddy server',
    modeHomeAssistant: 'Home Assistant',
    serverUrl: 'Server URL',
    addOnUrl: 'Add-on URL',
    serverUrlPlaceholder: 'https://babybuddy.example.com',
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
    inactiveDaysTitle: 'Some days had no entries',
    inactiveDaysBody:
      'Exclude those inactive days so they stop dragging down your averages and gauges?',
    inactiveDaysExclude: 'Exclude',
    inactiveDaysDismiss: 'Not now',
    showHidden_one: 'Show {{count}} hidden child',
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
    doses_one: '{{count}} dose',
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
    close: 'Close',
    time: 'Time',
    endTime: 'End time',
    note: 'Note',
    notePlaceholder: 'Optional note',
    tags: 'Tags',
    addTagOffer: '+ {{tag}}',
    saveDetails: 'Save details',
    saveAndEnd: 'Save and end {{activity}}',
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
    stats: 'Statistics',
    excludeInactiveDays: 'Exclude inactive days',
    excludeInactiveDaysHint:
      'Days with no logged entries are dropped from the food-trend average and the feed gauges, so a logging gap does not drag your stats down.',
    children: 'Children & default food quantity',
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
  },

  advanced: {
    // Settings-screen navigation row.
    navTitle: 'Advanced',
    navHint: 'Groups, colours, and visibility schedules.',
    // Advanced settings screen.
    title: 'Advanced',
    groups: 'Groups',
    noGroups: 'No groups yet.',
    addGroup: 'Add group',
    newGroupName: 'New group',
    groupMembers_one: '{{count}} child',
    groupMembers_other: '{{count}} children',
    kids: 'Children',
    kidsHint: 'Tap a child to set its colour, group, and visibility.',
    hiddenBadge: 'Hidden',
    // Kid editor.
    kidVisibility: 'Show on the dashboard',
    accentColor: 'Accent colour',
    accentAuto: 'Auto',
    accentKidHint: 'Overrides the group colour for this child.',
    group: 'Group',
    groupNone: 'None',
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
    enable: 'Enable notifications',
    enableHint: 'Local reminders, scheduled on this device.',
    blocked: 'Notifications are blocked. Turn them on for Baby Buddy in your device settings.',
    unsupported: "Notifications aren't available on this platform.",
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
    diaperBody: "{{child}} hasn't had a diaper change in {{duration}}.",
    foodBody: "{{child}} hasn't been fed in {{duration}}.",
    foodBodyMin: "{{child}} hasn't been fed in {{duration}} — aim for at least {{min}}ml.",
    titleWeekly: 'Your week in review',
    weeklyBody:
      "You logged {{mine}} of {{total}} entries this week — {{share}}% of the family's total. {{breakdown}}",
    weeklyBodySolo: 'You logged {{mine}} entries this week. {{breakdown}}',
    // Second line of the weekly body, listing the same week split by kid group.
    weeklyGroups: 'By group: {{breakdown}}',
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
    hiddenNote_one: '{{count}} hidden child is not counted.',
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
    days_one: '{{count}} day old',
    days_other: '{{count}} days old',
    months_one: '{{count}} month old',
    months_other: '{{count}} months old',
    years_one: '{{count}} year old',
    years_other: '{{count}} years old',
  },
} as const;

export type Resources = typeof en;
