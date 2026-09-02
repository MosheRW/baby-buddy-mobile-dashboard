/**
 * i18next CLDR plural forms for a stem key. `_one`/`_other` are the forms
 * every locale's rule needs; `_two`/`_many` only apply to locales whose CLDR
 * rule produces them (Hebrew), so they're optional rather than required —
 * see `REQUIRED_FORMS` in `src/i18n/__tests__/locale-parity.test.ts`.
 */
type PluralForms<Stem extends string> = {
    [K in `${Stem}_one` | `${Stem}_other`]: string;
} & {
    [K in `${Stem}_two` | `${Stem}_many`]?: string;
};

export interface Locals {
    common: {
        save: string,
        saving: string,
        cancel: string,
        delete: string,
        deleting: string,
        close: string,
        back: string,
        dismiss: string,
        retry: string,
        ok: string,
    },

    errorBoundary: {
        title: string,
        body: string,
        retry: string,
    },

    stepper: {
        increase: string,
        decrease: string,
        editValue: string,
        resetHint: string,
        editTitle: string,
        invalidTitle: string,
        rangeBoth: string,
        rangeMin: string,
        rangeMax: string,
        rangeAny: string,
        hours: string,
        minutes: string,
    },


    login: {
        title: string,
        subtitle: string,
        modeBabyBuddy: string,
        modeHomeAssistant: string,
        modeLocal: string,
        serverUrl: string,
        addOnUrl: string,
        serverUrlPlaceholder: string,
        httpWarning: string,
        addOnUrlPlaceholder: string,
        apiKey: string,
        apiKeyPlaceholder: string,
        username: string,
        usernamePlaceholder: string,
        password: string,
        passwordPlaceholder: string,
        haHint: string,
        enterServerUrl: string,
        passwordFallback: string,
        connecting: string,
        connect: string,
        logIn: string,
        useUsernamePassword: string,
        useApiKey: string,
        subtitleLocal: string,
        offlineHint: string,
        babyName: string,
        babyNamePlaceholder: string,
        babyBirthDate: string,
        enterBabyName: string,
        startOffline: string,
        continueOffline: string,
        offlineExistingData: string,
        scanQr: string,
    },

    dashboard: {
        greetingWithName: string,
        recentActivity: string,
        noEntries: string,
        tagFilter: string,
        clearTagFilter: string,
        editEntry: string,
        deleteEntry: string,
        filterByTag: string,
        addTag: string,
        switchToChild: string,
    } & PluralForms<'showHidden'>,

    filter: {
        all: string,
    },

    quickAction: {
        diaper: string,
        food: string,
        sleep: string,
        tummy: string,
        medication: string,
        more: string,
    },

    childCard: {
        lastPee: string,
        lastPoo: string,
        lastFeeding: string,
        lastFeedingValue: string,
        foodWindow: string,
        foodValue: string,
        logDose: string,
        lastAt: string,
        limitAria: string,
    },

    med: {
        unitLabel: {
            mg: string,
            ml: string,
            tablets: string,
            drops: string,
            paste: string,
        },
        // The word units keep a leading space ("5 tablets"), symbol units don't.
        unitSuffix: {
            mg: string,
            ml: string,
            tablets: string,
            drops: string,
            paste: string,
        },
        doseFieldLabel: string,
        status: {
            sinceLastDose: string,
            overdueBy: string,
            dueIn: string,
            eligibleNow: string,
            eligibleIn: string,
        },
        eligibleNowShort: string,
        eligibleInShort: string,
        repeatLabel: {
            scheduled: string,
            asNeeded: string,
        },
        breakdownTitle: string,
        breakdownEmpty: string,
        maxReached: string,
        stillAvailable: string,
        noLimit: string,
    } & PluralForms<'doses'>,

    entryType: {
        diaper: string,
        feeding: string,
        medication: string,
        temperature: string,
        tummyTime: string,
        sleep: string,
        note: string,
    },


    entryTitle: {
        diaperBoth: string,
        diaperDirty: string,
        diaperWet: string,
        sleeping: string,
        sleep: string,
        tummyTime: string,
        note: string,
    },

    feeding: {
        kind: {
            breastMilk: string,
            formula: string,
            fortifiedBreastMilk: string,
            solidFood: string,
        },
        method: {
            bottle: string,
            leftBreast: string,
            rightBreast: string,
            bothBreasts: string,
            selfFed: string,
            parentFed: string,
        },
        solid: {
            fruits: string,
            vegetables: string,
            grains: string,
            protein: string,
            dairy: string,
        },
        // Leading spaces are intentional — the stepper concatenates them.
        amountUnitSolid: string,
        amountUnitLiquid: string,
        trendLabel: string,
        trendLabelActive: string,
        typeLabel: string,
        methodLabel: string,
        foodTypeLabel: string,
        amountLabel: string,
        durationLabel: string,
        durationSuffix: string,
    },

    temperature: {
        method: {
            oral: string,
            ear: string,
            forehead: string,
        },
        valueLabel: string,
        valueSuffix: string,
        methodLabel: string,
    },

    diaper: {
        contents: string,
        pee: string,
        poo: string,
        pooColor: string,
        pooColorAria: string,
        amountSuffix: string,
        amountLabel: {
            both: string,
            poo: string,
            pee: string,
        },
        selectOne: string,
    },

    medForm: {
        recent: string,
        recentMeta: string,
        name: string,
        namePlaceholder: string,
        schedule: string,
        scheduled: string,
        asNeeded: string,
        unit: string,
        route: string,
        routeOrally: string,
        routeAnal: string,
        bodyArea: string,
        bodyAreaPlaceholder: string,
        once: string,
        custom: string,
        customSuffix: string,
        maxDose: string,
        maxDoseHint: string,
        noLimitPlaceholder: string,
    },


    sleep: {
        typeLabel: string,
        nap: string,
        night: string,
        stillSleeping: string,
        wokeUpAt: string,
        turnOffHint: string,
    },

    timer: {
        start: string,
        running: string,
        stop: string,
        startAria: string,
        stopAria: string,
        typeLabel: {
            feeding: string,
            sleep: string,
            tummyTime: string,
        },
    },

    logEntry: {
        editTitle: string,
        newTitle: string,
        readOnlyOthers: string,
        readOnlyOthersBy: string,
        close: string,
        time: string,
        endTime: string,
        note: string,
        notePlaceholder: string,
        // tags
        tags: string,
        addTagOffer: string,
        addTagPlaceholder: string,
        addTagButton: string,
        removeTag: string,
        saveDetails: string,
        saveAndEnd: string,
        // The two modals a notification action button can open this form with
        // (issue #45): "cancel <timer>" asks for confirmation before discarding a
        // running timer, "end feeding" asks for the amount before saving.
        cancelTimerTitle: string,
        cancelTimerBody: string,
        cancelTimerConfirm: string,
        cancelTimerKeep: string,
        quantityTitle: string,
        activity: {
            feeding: string,
            sleep: string,
            tummyTime: string,
        },
    },

    dateTime: {
        placeholder: string,
        dateAria: string,
        timeAria: string,
    },

    deleteSheet: {
        title: string,
        body: string,
    },

    settings: {
        title: string,
        children: string,
        mlSuffix: string,
        visibilityToggle: string,
        newChildren: string,
        newChildrenHint: string,
        visibilityVisible: string,
        visibilityHidden: string,
        serverHomeAssistant: string,
        serverBabyBuddy: string,
        loggedInAs: string,
        accessToken: string,
        logOut: string,
        language: string,
        languageEnglish: string,
        languageHebrew: string,
        appearance: string,
        appearanceSystem: string,
        appearanceLight: string,
        appearanceDark: string,
        appearanceSystemHint: string,
        dynamicColor: string,
        dynamicColorHint: string,
        offlineTitle: string,
        offlineHint: string,
        childName: string,
        childBirthDate: string,
        showOnDashboard: string,
        defaultFood: string,
        addChild: string,
        removeChild: string,
        newChildDefault: string,
        timeFormat: string,
        timeFormatText: string,
        timeFormatDigital: string,
        timeFormatHint: string,
    },

    advanced: {
        // Settings-screen navigation row.
        navTitle: string,
        navHint: string,
        // Advanced settings screen.
        title: string,
        groups: string,
        noGroups: string,
        addGroup: string,
        newGroupName: string,
        kids: string,
        kidsHint: string,
        hiddenBadge: string,
        // Kid editor.
        kidVisibility: string,
        accentColor: string,
        accentAuto: string,
        accentMatchPhone: string,
        accentKidHint: string,
        group: string,
        groupNone: string,
        // Group editor.
        groupName: string,
        accentGroupHint: string,
        groupHidden: string,
        groupHiddenHint: string,
        members: string,
        memberToggle: string,
        deleteGroup: string,
        // Shake to reveal.
        shakeTitle: string,
        shakeHint: string,
        shakeDuration: string,
        shakeMinSuffix: string,
    } & PluralForms<'groupMembers'>,

    share: {
        // Settings-screen navigation row (admin only).
        navTitle: string,
        navHint: string,
        // Screen.
        title: string,
        checking: string,
        // Unlock (re-authenticate to open the admin web session).
        unlockTitle: string,
        unlockHint: string,
        unlock: string,
        enterAdminCredentials: string,
        notAdmin: string,
        // Share the admin's own login.
        ownLoginTitle: string,
        ownLoginHint: string,
        showOwnQr: string,
        // Add a caregiver.
        addTitle: string,
        caregiverName: string,
        caregiverNamePlaceholder: string,
        caregiverFirstName: string,
        caregiverLastName: string,
        caregiverPassword: string,
        staffToggle: string,
        staffHint: string,
        staffWarnTitle: string,
        staffWarnBody: string,
        staffWarnDontAsk: string,
        staffWarnContinue: string,
        addCaregiver: string,
        enterCaregiver: string,
        tokenCreateFailed: string,
        // QR captions + warning.
        qrCaptionOwn: string,
        qrCaptionCaregiver: string,
        qrWarning: string,
        // Created-this-session list.
        createdTitle: string,
        showQr: string,
        // Existing users list.
        usersTitle: string,
        noUsers: string,
        usersHint: string,
        usersTokenHint: string,
        // Scanner.
        scanTitle: string,
        scanHint: string,
        cameraNeeded: string,
        grantCamera: string,
    },

    schedule: {
        title: string,
        hint: string,
        from: string,
        to: string,
        days: string,
        everyDay: string,
        selectedDays: string,
    },

    notifications: {
        // Settings-screen navigation row.
        navTitle: string,
        navHint: string,
        // Notification settings screen.
        title: string,
        enable: string,
        enableHint: string,
        blocked: string,
        unsupported: string,
        backgroundTitle: string,
        backgroundHint: string,
        backgroundRestricted: string,
        backgroundUnsupported: string,
        scheduledMedsTitle: string,
        scheduledMedsHint: string,
        eligibilityTitle: string,
        eligibilityHint: string,
        forgottenTitle: string,
        forgottenHint: string,
        forgottenGeneralLabel: string,
        forgottenSleepLabel: string,
        liveTitle: string,
        liveHint: string,
        liveMedTitle: string,
        liveMedHint: string,
        diaperTitle: string,
        diaperHint: string,
        foodTitle: string,
        foodHint: string,
        feedingScheduleTitle: string,
        feedingScheduleHint: string,
        feedingInterval: string,
        weeklyTitle: string,
        weeklyHint: string,
        weeklyDay: string,
        weeklyTime: string,
        weeklyHourSuffix: string,
        weekdayShort: {
            0: string,
            1: string,
            2: string,
            3: string,
            4: string,
            5: string,
            6: string,
        },
        maxGap: string,
        targetAmount: string,
        before: string,
        atTime: string,
        after: string,
        minSuffix: string,
        // Delivered-notification titles + bodies. `_noChild` is the i18next context
        // variant used when the child can't be resolved.
        titleMedDue: string,
        titleMedReady: string,
        titleTimerRunning: string,
        titleDiaperDue: string,
        titleFoodDue: string,
        // Android notification action buttons. Which of these a reminder shows is
        // decided by the planner (see `NotificationActionId`), per case and phase.
        actionRemindLater: string,
        actionAddNow: string,
        actionOk: string,
        actionRemindOnTime: string,
        // {{activity}} is the timer's own label (timer.typeLabel.*), so one string
        // covers sleep / feeding / tummy time and stays grammatical when translated.
        actionCancelTimer: string,
        actionEndTimer: string,
        snoozeTitle: string,
        snoozeHint: string,
        medDueBefore: string,
        medDueBefore_noChild: string,
        medDueAt: string,
        medDueAt_noChild: string,
        medDueAfter: string,
        medDueAfter_noChild: string,
        eligBefore: string,
        eligBefore_noChild: string,
        eligAt: string,
        eligAt_noChild: string,
        eligAfter: string,
        eligAfter_noChild: string,
        timerBody: string,
        timerBody_noChild: string,
        liveTimerTitle: string,
        liveTimerBody: string,
        liveTimerBody_noChild: string,
        // Live-chronometer notifications: the OS draws the ticking clock, so these
        // are just the accompanying text line, no {{duration}}.
        liveChronoRunning: string,
        liveMedBody: string,
        liveMedBody_noChild: string,
        diaperBody: string,
        // The feeding-gap bodies. `foodBody*` is the "at" phase and keeps the
        // original wording (duration = the child's feeding interval); the before/
        // after variants are relative to that deadline, like the medication ones.
        foodBody: string,
        foodBodyMin: string,
        foodBefore: string,
        foodBeforeMin: string,
        foodAfter: string,
        foodAfterMin: string,
        titleWeekly: string,
        weeklyBody: string,
        weeklyBodySolo: string,
        // Second line of the weekly body, listing the same week split by kid group.
        weeklyGroups: string,
        // Wraps any body above when the reminder couldn't be confirmed against the
        // server before being shown. A whole-sentence template, not a bare suffix, so
        // a locale can place the caveat wherever it reads naturally.
        unverified: string,
        // In-app carousel of already-delivered reminders, shown above the child card.
        carouselHeading: string,
        dismissOne: string,
        dismissAll: string,
    },


    // The on-demand caregiver-contribution recap (the weekly summary, readable at
    // any time from notification settings).
    contribution: {
        title: string,
        viewNow: string,
        window: string,
        youLogged: string,
        shareCaption: string,
        soloCaption: string,
        byCategory: string,
        byGroup: string,
        empty: string,
        noUser: string,
    } & PluralForms<'hiddenNote'>,

    // User-facing failure titles, shown as error cards in the dashboard carousel.
    // The body is the underlying `errorMessage(...)`, so these are just the "what
    // failed" headline.
    errors: {
        loadTitle: string,
        saveTitle: string,
        deleteTitle: string,
        dismissOne: string,
    },

    dates: {
        now: string,
        minutesAgo: string,
        hoursAgo: string,
        hoursMinutesAgo: string,
        hoursMinutesAgoDigital: string,
        daysAgo: string,
        today: string,
        yesterday: string,
        greeting: {
            morning: string,
            afternoon: string,
            evening: string,
        },
    },

    duration: {
        hoursMinutes: string,
        minutes: string,
    },

    age: PluralForms<'days'> & PluralForms<'months'> & PluralForms<'years'>,

    about: {
        // Settings-screen navigation row.
        navTitle: string,
        navHint: string,
        // About screen.
        title: string,
        // About me + about the app.
        aboutMeTitle: string,
        aboutMeBody: string,
        linkedIn: string,
        aboutAppTitle: string,
        aboutAppBody: string,
        userManual: string,
        // Version (double-tap opens the release announcement).
        versionTitle: string,
        versionValue: string,
        versionHint: string,
        // Links group.
        linksTitle: string,
        webApp: string,
        discussions: string,
        playStore: string,
        privacyPolicy: string,
        reportBug: string,
        sourceCode: string,
        opensExternally: string,
        // Share.
        shareTitle: string,
        shareHint: string,
        shareButton: string,
        shareBody: string,
        // Donate (non–Play Store builds only).
        donateTitle: string,
        donateHint: string,
        buyMeACoffee: string,
    },

}