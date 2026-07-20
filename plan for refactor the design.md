# Medications
1.  in medication, add a picker between the dose and the type, for choosing units between mg, ml, tablets, drops and paste.
2.  also, adapt the dose field according to the unit chosen.
3.  for paste and tablets add field for choosing: 
    * orally\anal (tablets).
    * and blank text field for the body area it used on (paste).
  
## implementation details
the baby-buddy server doesn't supports 'paste' at all, and orally/anal for tablets.
so we will send them as tags. but inside the app we will never display them as tags, but interpret them as the additional values we mentioned above.

------------------------------------------------------

# Food
### solid food:
1. add a picker for choosing the type of food (e.g., fruits, vegetables, etc.).
2. hide the quantity field when the type of food is chosen as 'fruits' or 'vegetables', as they are usually given in pieces or servings rather than specific quantities.

### Bottle feeding:
add a tag for the default food quantity at the time of the feed entry creation, so we can later use it on the entries-feed to display a bar of how much the baby has eaten in relation to the default quantity at the time of the feed.

### breastfeeding:
1. calculate the default time for breastfeeding based on the average time of the last week of previous breastfeeding sessions.
2. and add a tag for it at the time of the feed entry creation, so we can later use it on the entries-feed to display a bar of how much the baby has breastfed in relation to the default time at the time of the feed.

## implementation details
* the baby-buddy server doesn't supports 'type of food' as in the picker we mentioned above in solid food.
* the baby-buddy server doesn't supports 'default food quantity' for bottle feeding and 'default time' for breastfeeding.
so we will send them as tags. but inside the app we will never display them as tags, but interpret them as the additional values we mentioned above.


------------------------------------------------------

# Tags
1. display the last five tags used in the last 30 days in that entry type, and allow the user to select them from a list when creating a new entry. This will help users quickly add relevant tags without having to type them out each time.
2. display one line of tags (max) for each entry in the entries feed, and allow the user to tap on the tags to see all entries with that tag. This will help users quickly find related entries and track patterns over time.

----------------------------------------------------

# Settings
display the login details in the settings page, in the server card, so the user can easily see which server they are connected to and which account they are logged in with.

---------------------------------------------------
# Icons
add icons for each entry type, and use them across the app to help users quickly identify the type of entry they are viewing or creating. For example, use a pill icon for medication entries, a bottle icon for bottle feeding entries, and a breast icon for breastfeeding entries.

### Timers
* add icon for the start Timer buttons.

### Diaper
* add icon for the Diaper editor button.
* add icon for the Pee and Poo buttons in the diaper entry screen, to help users quickly identify the type of diaper change they are creating.
* add icons for each diaper type (wet, dirty, mixed) and use them in the diaper entry screen and entries feed to help users quickly identify the type of diaper change they are viewing or creating.
and color the diaper accordingly (e.g., blue for wet, yellow, green, brown and black for the defined poo colors) to provide a visual cue for users.


### Food
* add icon for the Food editor button.
* add icon for the breastMilk button in the food entry screen, to help users quickly identify the type of food they are creating.
* add icon for the formula button in the food entry screen, to help users quickly identify the type of food they are creating.
* add icon for the fortified breastMilk button in the food entry screen, to help users quickly identify the type of food they are creating.
* add icon for the solid food button in the food entry screen, to help users quickly identify the type of food they are creating.

* add icon for bottle feeding button in the food entry screen, to help users quickly identify the type of food they are creating.
* add icon for left breast button in the food entry screen, to help users quickly identify the type of food they are creating.
* add icon for right breast button in the food entry screen, to help users quickly identify the type of food they are creating.
* add icon for both breasts button in the food entry screen, to help users quickly identify the type of food they are creating.

* add icon for self-feeding button in the food entry screen, to help users quickly identify the type of food they are creating.
* add icon for parent-feeding button in the food entry screen, to help users quickly identify the type of food they are creating.

* use icon for the food entry in the entries feed, to help users quickly identify the type of food they are viewing. the icon should change based on the type of food (e.g., a fruit icon for fruit entries, a vegetable icon for vegetable entries, etc.), the type of the feeding (e.g., breast-feeding, formula etc.) and the method of feeding (e.g., self-feeding, parent-feeding, bottle, left-breast etc.).


### Medication
* add icon for the Medication editor button.
* add icon for the medication types (schedule, as needed, etc.) in the medication entry screen, to help users quickly identify the type of medication they are creating.
* add icon for the medication unit picker (mg, ml, tablets, drops, paste) in the medication entry screen, to help users quickly identify the unit of medication they are creating.

* use the medication unit icon in the entries feed to help users quickly identify the unit of medication they are viewing. the icon should change based on the unit of medication (e.g., a pill icon for tablets, a drop icon for drops, etc.).
use the medication unit icon in the recent medication list, in the side of the medication name, to help users quickly identify the unit of medication they are viewing. the icon should change based on the unit of medication (e.g., a pill icon for tablets, a drop icon for drops, etc.).

* also, use it in the homescreen widget, for the display medications.

### Temperature
* add icon for the Temperature editor button.

* propose to add icons for the temperature types (oral, rectal, axillary, tympanic) in the temperature entry screen, to help users quickly identify the type of temperature they are creating.


### Sleep
* add icon for the Sleep editor button.

* add icon for the sleep types (nap, night sleep) in the sleep entry screen, to help users quickly identify the type of sleep they are creating.
* use the sleep type icon in the entries feed to help users quickly identify the type of sleep they are viewing. the icon should change based on the type of sleep (e.g., a moon icon for night sleep, a sun icon for nap, etc.).

### Tummy Time
* add icon for the Tummy Time editor button.

------------------------
# Home Screen
1. add the user name to the welcome message on the home screen, so the user feels more personalized and welcomed when they open the app.
2. hide the welcome message after the user has seen it for the first time (in the current session), to avoid cluttering the home screen and to provide a cleaner user experience.

# Entries Feed
* add a delete icon to the entries card delete button, to help users quickly identify the delete action and avoid accidental deletions.
* add an edit icon to the entries card edit button, to help users quickly identify the edit action and avoid accidental edits.

