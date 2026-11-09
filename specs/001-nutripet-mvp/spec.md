# Feature Specification: NutriPet MVP — Multi-Profile Nutrition & Activity Tracker with Virtual Pet

**Feature Branch**: `001-nutripet-mvp`

**Created**: 2026-11-08

**Status**: Draft

**Input**: User description: "Initial Feature Specification — NutriPet: a multi-user nutrition and
physical activity tracker with gamification (virtual cat), initially used by two people with
opposite weight objectives (one gaining, one losing). Covers profiles and energy requirements,
food database, meal registration, daily dashboard, activity tracking, weight tracking, calendar
and streaks, virtual pet, main screens, and MVP acceptance criteria." (full text in conversation
history; sections referenced below as §N)

## Clarifications

### Session 2026-11-08

- Q: How are profiles protected? → A: Shared app with profile selector; each profile protected by its own PIN (FR-004).
- Q: When is a food-tracking day "completed"? → A: At least 3 meal occasions logged, or the user optionally marks "day complete" with at least one food entry (FR-061).

### Session 2026-11-08 (analysis remediation)

- D1: Gamification rewards are identical across goals; only messaging/presentation adapts to the goal (FR-078; Constitution IV v1.1.0).
- C1: Source order USDA FDC (Foundation/SR Legacy) → USDA FNDDS → Open Food Facts (packaged only) → TCAC only after license verification; "arepa (casera)" is a documented coverage gap; no substituted values (FR-023, FR-024, FR-029).
- D2: Energy-relevant profile settings are effective-dated; each day keeps an energy snapshot (FR-019).
- F1: XP never decreases due to missed days, target outcomes, or normal progression; XP from deleted records may be revoked; stage never decreases (FR-074).
- S1: Open profile creation only during initial setup; afterwards an authenticated session or SETUP_TOKEN is required; the selector is only shown on enrolled devices (FR-008).
- I1/U2: One streak freeze per 7 completed days (not necessarily consecutive); only days completed within the backfill window earn freezes or streak rewards (FR-064).
- I2: New `activity_only` day state (FR-060).
- A1: "Total recorded days" and "total completed days" are separate metrics (FR-063).
- A2: A treat requires a completed food day; +1 XP activity bonus only on completed days (FR-075).
- U1: Recovery-code attempts are rate limited like PINs (FR-004).
- U3: Data preferences = weight unit, height unit, food quantity unit, time zone; no export in MVP (FR-007).
- U4: Preparation state belongs to the food variant (FR-031).

### Session 2026-11-09 (multi-food meals and preparations)

- M1: A meal is registered as one unit with any number of foods; the user adds, edits and removes
  rows, sees live totals and saves the whole meal at once; an existing meal can be edited the same
  way (FR-035a). Templates may contain preparation portions (FR-035b).
- M2: Preparations (recipes) are profile-owned, built from catalog/custom ingredients, and keep
  their ingredient composition and calculation provenance; they are not catalog foods (FR-038).
- M3: A preparation's nutrients are the sum of each ingredient's own contribution; water adds no
  energy; per-100 g/ml values of a powder never describe the prepared beverage (FR-039, FR-048).
- M4: The final yield is entered by the user and never inferred from the ingredient sum; amounts
  consumed are proportional only for homogeneous preparations (FR-045).
- M5: Every recipe save creates an immutable version; meal entries reference the version they
  used (FR-046).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and configure an independent profile (Priority: P1)

A person opens NutriPet for the first time, creates their profile (name, age, sex for formula
purposes, height, current weight, target weight, goal type, everyday activity level, preferred
units) and immediately sees their estimated BMR, estimated TDEE, and a recommended daily calorie
target derived from a surplus or deficit they choose. A second person creates their own profile
with the opposite goal. Each sees only their own numbers, along with an explanation of how they
were calculated.

**Why this priority**: Every other capability (targets, balance, streaks, pet) depends on a
profile. Two independent profiles with opposite goals is the defining scenario of the MVP.

**Independent Test**: Create two profiles (one "gain" with +300 kcal surplus, one "lose" with
−400 kcal deficit). Verify each shows different, correctly calculated BMR/TDEE/target values, and
editing one never changes the other.

**Acceptance Scenarios**:

1. **Given** no profiles exist, **When** a person completes profile creation with valid data,
   **Then** the profile is saved with its creation date, an initial weight record is created, and
   BMR, TDEE, and the calorie target are displayed and labeled as estimates.
2. **Given** a profile with goal "weight gain" and a +300 kcal surplus, **When** the person views
   their target, **Then** target = estimated baseline TDEE + 300 kcal, and a "how is this
   calculated?" explanation shows the formula, inputs, and activity multiplier used.
3. **Given** two PIN-protected profiles on the same device, **When** a person selects profile B
   and enters a wrong PIN, **Then** no data from profile B is shown, and repeated failures trigger
   a temporary lockout.
4. **Given** two profiles exist, **When** profile A edits height, activity level, or goal,
   **Then** profile B's values and calculations are unchanged.
5. **Given** a person enters a deficit that would put the target below the safety threshold,
   **When** they save, **Then** the system shows a non-medical caution message and asks for
   confirmation before accepting it.
6. **Given** a person chooses to override the recommended calorie target with a manual value,
   **When** they save, **Then** the manual target is used everywhere and clearly marked as
   user-defined, while the recommended value remains visible for reference.
7. **Given** a profile with logged days last week, **When** the person changes their activity
   level or calorie adjustment today, **Then** today and future days use the new settings, while
   last week's targets, TDEE, and balances are unchanged, and the UI states "aplicado desde hoy".
8. **Given** at least one profile exists, **When** an unauthenticated client without a valid
   SETUP_TOKEN tries to create a profile or list profiles, **Then** the request is rejected and no
   profile names are revealed.
9. **Given** a person enters a wrong recovery code 5 times, **Then** recovery is temporarily
   locked using the same escalating policy as PIN attempts.

---

### User Story 2 - Log a weighed meal quickly and see the day's nutrition update (Priority: P1)

A person selects their profile, taps "add meal", picks the meal occasion (e.g., breakfast),
searches for "huevo", selects the matching food variant (e.g., "Huevo entero, cocido"), enters the
grams shown on their kitchen scale,
confirms, and repeats for the other items. Each item shows its calories and macronutrients, the
meal shows its total, and the day's summary updates instantly.

**Why this priority**: Meal logging is the core daily habit; without it there is no intake,
balance, streak, or pet progress.

**Independent Test**: With one profile and the imported food catalog, log a breakfast using foods
guaranteed by the initial sources (egg 100 g, mango 70 g, milk 200 ml, oats 40 g). Verify per-item
and total values match `(quantity / 100) × value per 100` for each nutrient, and the daily summary
reflects them immediately. Homemade arepa is a known coverage gap (FR-029): it is logged only if a
verified catalog record exists, or as a user-created custom food (US4).

**Acceptance Scenarios**:

1. **Given** a selected profile, **When** the person searches "huevo" or "egg", **Then** matching
   foods appear (including those matching alternative names), each showing its preparation state
   (raw/cooked/prepared/packaged), category, and data source.
2. **Given** a food with 155 kcal per 100 g, **When** the person logs 130 g, **Then** the entry
   shows 201.5 kcal (displayed rounded) and corresponding protein, carbohydrate, and fat values.
3. **Given** a liquid food with values per 100 ml, **When** the person logs 200 ml, **Then**
   nutrients are calculated from the per-100-ml reference.
4. **Given** a logged entry, **When** the person edits its quantity or deletes it, **Then** the
   meal total and the daily summary update immediately.
5. **Given** a meal logged yesterday, **When** the person chooses "duplicate" for today, **Then** a
   copy is created for today's chosen meal occasion with the same foods and quantities.
6. **Given** a logged meal, **When** the person saves it as a template and later applies it,
   **Then** all its items are added in one action and remain individually editable.
7. **Given** a food was logged last week, **When** the food's catalog values are later updated by
   an import or correction, **Then** last week's entry still shows the values in effect when it was
   logged.

---

### User Story 3 - Daily dashboard with activity logging and estimated energy balance (Priority: P2)

On the home screen, a person sees their pet, current streak, calories consumed vs. target,
macronutrient progress, estimated expenditure, and estimated energy balance. They log a
45-minute volleyball session (with or without an estimated calorie value) and see expenditure and
balance update, without exercise being counted twice.

**Why this priority**: Turns raw logs into the information users act on; activity logging
completes the energy picture.

**Independent Test**: For a profile with known BMR and multiplier, log intake of 2,000 kcal and one
activity with a MET-based estimate. Verify expenditure = baseline TDEE + net activity estimate,
balance = expenditure − intake, and the sign is interpreted correctly (positive = deficit).

**Acceptance Scenarios**:

1. **Given** estimated expenditure 2,400 kcal and intake 2,000 kcal, **When** the dashboard loads,
   **Then** balance shows +400 kcal labeled "estimated deficit".
2. **Given** estimated expenditure 2,400 kcal and intake 2,700 kcal, **When** the dashboard loads,
   **Then** balance shows −300 kcal labeled "estimated surplus".
3. **Given** a target of 2,800 kcal and intake of 2,100 kcal, **When** the dashboard loads,
   **Then** it shows 700 kcal remaining to target, visually distinct from the energy balance.
4. **Given** a person logs "Running, 30 min" with a MET estimate, **When** saved, **Then** the
   estimated expenditure is calculated from MET value, current body weight, and duration, labeled as
   an estimate, and only the activity's energy above resting is added to the day's expenditure.
5. **Given** a person logs "Gym, 60 min" and chooses not to assign calories, **When** saved,
   **Then** the activity is recorded and counts for tracking, but adds nothing to expenditure.
6. **Given** the dashboard, **When** a person opens "how is this calculated?", **Then** it explains
   that the activity level reflects everyday life excluding logged exercise, and that logged
   exercise is added separately.

---

### User Story 4 - Manage the food catalog: custom foods, favorites, and frequent foods (Priority: P2)

A person cannot find a homemade dish, so they create a custom food with values per 100 g and a
source note. They mark rice and eggs as favorites. Next time they add a meal, their favorites and
most frequently logged foods appear first, so they can add them without searching.

**Why this priority**: Reduces friction in the daily logging loop and fills catalog gaps.

**Independent Test**: Create a custom food, favorite two foods, log a food five times; verify the
custom food is searchable (only by its owner unless shared), favorites and frequent foods appear in
quick-add, and catalog search works with external sources unavailable.

**Acceptance Scenarios**:

1. **Given** a person creates a custom food with name, basis (per 100 g or per 100 ml), calories,
   protein, carbohydrates, and fat, **When** saved, **Then** it is searchable and marked as
   "user-created" as its source.
2. **Given** a person corrects a catalog food's values, **When** saved, **Then** the correction is
   stored as that person's override (source marked as user correction) without altering past
   entries or other profiles' values.
3. **Given** the catalog has been imported locally, **When** external data sources are unreachable,
   **Then** search, logging, and all other features continue to work.
4. **Given** a person filters the catalog by category and preparation state, **When** they view a
   food, **Then** they see full nutrition per 100 g/ml, source, source identifier, and version or
   last-update information.

---

### User Story 5 - Record weight and see the trend (Priority: P3)

A person weighs themselves a few times a week and records it. The progress screen shows each
measurement, a smoothed trend line, and the distance to their target weight, emphasizing the trend
rather than daily fluctuations.

**Why this priority**: Key for long-term motivation and goal tracking, but not part of the daily
logging loop.

**Independent Test**: Enter 10 measurements over 3 weeks with fluctuations; verify the history list,
edit/delete, trend line, and current-vs-target comparison.

**Acceptance Scenarios**:

1. **Given** a profile, **When** a person records a weight with date and optional note, **Then** it
   is added to the history without overwriting previous records, and "current weight" becomes the
   most recent measurement.
2. **Given** several measurements, **When** the person views progress, **Then** a chart shows raw
   points plus a trend line, and the summary shows trend change (not the single-day change).
3. **Given** a measurement entered by mistake, **When** the person edits or deletes it, **Then** the
   history, trend, and current weight recalculate.
4. **Given** a goal of weight gain and a target of 70 kg with current trend 66 kg, **When** viewing
   progress, **Then** it shows "4 kg to target" without promising a date of achievement.

---

### User Story 6 - Calendar and streaks (Priority: P3)

A person opens the calendar and sees a monthly grid where each day's color reflects tracking
status. They tap a past day to review its meals, activities, and summary. They see current streak,
longest streak, total days recorded, and this month's completion percentage.

**Why this priority**: Makes consistency visible, which is the main motivational loop alongside
the pet.

**Independent Test**: Seed a profile with a mix of empty, partial, complete, and rest days across
two months; verify each day's status, streak values, monthly percentage, and day-detail view.

**Acceptance Scenarios**:

1. **Given** a day with no entries, **Then** it shows "no activity recorded".
2. **Given** a day with food logged in only 2 meal occasions and not marked "day complete",
   **Then** it shows "food partially recorded"; **When** the user marks it "day complete",
   **Then** it shows "food tracking completed".
3. **Given** a day meeting the food completion rule, **Then** it shows "food tracking completed";
   if it also has an activity logged (or the day is marked as a rest day), **Then** it shows "full
   daily tracking completed" or "rest day with tracking completed" respectively.
4. **Given** five consecutive completed days followed by one missed day, **When** viewing streaks,
   **Then** current streak reflects the streak rules (including any grace/freeze), longest streak
   is 5 or more, and no XP or pet progress is lost.
5. **Given** a day where intake was far above or below the target, **When** the completion rule is
   met, **Then** the day still counts as completed (target achievement never affects completion).
6. **Given** the calendar, **When** the person navigates to earlier months, **Then** historical
   statuses are displayed correctly.
7. **Given** a day with only an activity logged and no food, **Then** it shows "solo actividad"
   (`activity_only`), not "food partially recorded", and does not count as completed.
8. **Given** 7 completed days spread across two weeks with gaps, **Then** one freeze is earned;
   **Given** a freeze is owned and two consecutive days are missed, **Then** only one freeze is
   consumed and the streak breaks on the second missed day.
9. **Given** a person backfills meals for a date 10 days ago so it becomes completed, **Then** the
   calendar and totals reflect it, but no streak freeze, streak XP, or streak milestone is earned.

---

### User Story 7 - Virtual cat that grows with consistency (Priority: P3)

Each profile has its own cat. Logging meals, completing days, logging activities, recording weight
periodically, and keeping streaks earn experience points (within daily limits) and "treats". The
person can feed treats to the cat, see its mood and progress toward the next evolution stage,
unlock cosmetic accessories, and see milestone messages. The cat never gets sick or dies.

**Why this priority**: The differentiating engagement layer; it depends on the logging features
above to be meaningful.

**Independent Test**: For two profiles with opposite goals, perform identical logging behavior for
N days; verify both earn identical XP, reach the same stage, daily caps are enforced, and skipping
days never reduces XP or stage.

**Acceptance Scenarios**:

1. **Given** a new profile, **When** it is created, **Then** a newborn kitten is assigned that the
   person can name.
2. **Given** a person logs 20 food items in one day, **When** XP is awarded, **Then** XP from meal
   logging stops at the daily cap.
3. **Given** two profiles (gain and lose) with identical logging patterns, **When** compared,
   **Then** XP, treats, and stage are identical regardless of calories consumed or goal.
4. **Given** cumulative XP crosses a stage threshold, **When** that happens, **Then** the cat
   evolves to the next stage, a milestone message is shown, and the new appearance is displayed.
5. **Given** a person misses three days, **When** they return, **Then** the cat's mood is at most
   lowered to a mild state (e.g., "sleepy" or "missed you"), XP and stage are unchanged, and one
   logging action begins restoring mood.
6. **Given** a person has earned treats, **When** they feed the cat, **Then** a treat is consumed
   and the cat's mood improves; feeding never depends on calories eaten.
7. **Given** a milestone that unlocks an accessory, **When** reached, **Then** the accessory becomes
   available to equip from the pet screen.
8. **Given** profile A (gain) and profile B (loss) reach the same 7-day milestone, **Then** both
   receive the same XP, treats, and accessory, while A sees a message about regular, sustainable
   meals and B a message about steady habits; neither message mentions eating more or less.
9. **Given** a person deletes a food entry logged earlier today, **Then** its XP is revoked; if the
   day stops being completed, the food-day XP, activity bonus, and treat for that day are revoked
   too (a treat already fed is not taken back; the treat balance never goes below 0), while the
   pet's stage is unchanged.

---

### User Story 8 - Progress summaries (Priority: P4)

A person reviews weekly and monthly summaries: average calorie intake, average estimated energy
balance, intake trend chart, days tracked, and weight trend.

**Why this priority**: Valuable reflection, but the MVP works without it.

**Independent Test**: With 30 days of seeded data, verify weekly/monthly averages computed only over
days with logged data, and labeled as estimates.

**Acceptance Scenarios**:

1. **Given** a week with 5 days logged and 2 empty, **When** viewing the weekly summary, **Then**
   averages use the 5 logged days and state "based on 5 of 7 days".
2. **Given** a month of data, **When** viewing the monthly summary, **Then** average estimated
   energy balance uses the same sign convention as the dashboard.

---

### User Story 9 - Log a whole multi-food meal and homemade preparations (Priority: P2)

A person opens "add meal", picks breakfast and adds eggs 100 g, bread 60 g, cheese 30 g and a
chocolate drink without leaving the screen: each row shows its quantity, unit, kcal and macros, the
meal total updates as rows are added, edited or removed, and one "save meal" stores everything.
The chocolate drink is a saved preparation (chocolate powder 25 g + milk 200 ml); the person picks
how much of it they drank. A lemonade made from powder (400 kcal per 100 g of powder) with 20 g of
powder and 300 ml of water is recorded as 80 kcal in total, never as 400 kcal per 100 ml.

**Why this priority**: real meals contain several foods and many drinks are prepared from
concentrated products; logging them one by one is slow, and calculating them as the dry product is
wrong by a large factor.

**Independent Test**: build breakfast with three foods and one preparation portion in a single
save; verify per-row and meal totals; create "Limonada" (20 g powder + 300 ml water, final volume
320 ml) → 80 kcal total, 25 kcal/100 ml; log 200 ml → 50 kcal; edit the recipe and the catalog
powder afterwards and verify the logged entry still shows 50 kcal (quickstart 15, 16).

**Acceptance Scenarios**:

1. **Given** the meal builder, **When** the person adds several foods, **Then** the previous rows
   stay visible while searching the next one, and the meal total is the sum of the rows.
2. **Given** a built meal, **When** a row's quantity is edited or a row is removed, **Then** the
   row and the meal totals update immediately, and nothing is stored until "save meal".
3. **Given** a saved meal, **When** the person edits it as a whole (change a quantity, remove one
   food, add another) and saves, **Then** kept entries keep their original snapshot values per 100
   and only their quantity changes.
4. **Given** a powder with 400 kcal/100 g, **When** a preparation uses 20 g of it and 300 ml of
   water, **Then** the preparation shows 80 kcal in total; with 300 ml of milk instead, the milk's
   contribution is added.
5. **Given** a preparation with an entered final yield of 500 ml and 400 kcal, **When** the person
   logs 200 ml, **Then** 160 kcal are logged; without an entered yield, only "whole" or "servings"
   portions are offered.
6. **Given** a non-homogeneous preparation, **When** the person logs it, **Then** they can log it
   whole, by equal servings, or as the ingredients actually eaten, but not by proportional amount.
7. **Given** a meal that used version 1 of a recipe, **When** the recipe or an ingredient's catalog
   values change, **Then** that meal keeps its values; editing its portion still uses version 1.

---

### Edge Cases

- A food lacks fiber, sugar, or sodium data: these are shown as "not available", never as 0, and
  daily totals indicate when they are incomplete.
- A liquid only has per-100 g values: the system converts using the food's density when known; if
  unknown, it assumes 1 g/ml and marks the result as an approximation.
- Quantity of 0, negative, or absurd (e.g., > 5,000 g in one entry): rejected or confirmation
  required, with validation enforced on the server side.
- A profile has no weight records (e.g., all deleted): the latest known profile weight is required
  before calculations; the system prompts to record one.
- Age changes over time: BMR uses age computed from the date of birth on the day being calculated.
- Activity logged without calories, or custom activity with no MET value: allowed; contributes 0 to
  expenditure and is labeled "no estimate".
- Past-day logging (backfill): allowed for any past date; calendar and streak recalculate; the
  day uses its effective settings (FR-019); XP, freezes, and streak rewards are limited to the
  2-day backfill window (FR-064, FR-071).
- Future dates: meal/activity/weight entries for future dates are rejected.
- Deleting a food that appears in past entries: past entries keep their snapshot; the food is
  hidden from search rather than destroyed.
- Two profiles used on the same device in quick succession: switching profile never leaves the
  previous profile's data visible on the new profile's screens.
- Day boundaries: a "day" is defined by the profile's configured time zone (FR-007). Changing the
  time zone affects new records only; existing local dates are kept.
- Searching a food with no verified record (e.g., "arepa casera"): the system shows no invented
  result and offers creating a custom food (FR-029).
- Settings changed several times in one day: the last change of that day is the effective version
  for that day and onward.
- A day with only activities and no food: shown as "activity only", not as partial food (FR-060).
- Search with accents or typos ("arepa" vs "árepa", "platano" vs "plátano"): matching is
  accent-insensitive and case-insensitive.
- Import run twice or a source updates a food: imports are idempotent; changed foods get a new
  version, without altering historical entries.
- A powdered or concentrated product is logged directly: the values shown are those of the dry
  product, labeled as such, with a shortcut to build a preparation with its liquid (FR-048).
- A preparation's final volume differs from the sum of its ingredients (evaporation, absorption,
  mixing): per-100 values use the yield the user entered; without it they are not shown (FR-045).
- A consumed amount larger than the preparation, a zero/negative quantity, servings on a recipe
  without servings, or an amount on a recipe without yield: rejected with a clear message.
- A saved preparation is deleted: it disappears from the lists; past meals keep their values and
  stay readable through the version they used (FR-046).
- Water and other ingredients with established zero values contribute 0; no liquid is assumed to
  be zero without a record saying so (FR-047).

## Requirements *(mandatory)*

### Functional Requirements

#### Profiles and access

- **FR-001**: System MUST allow creating multiple independent profiles, each with: name, date of
  birth (age derived), sex for metabolic formulas, height (cm), target weight (kg), goal type
  (gain, loss, maintenance), everyday activity level, data preferences (FR-007), calorie target,
  optional protein/carbohydrate/fat targets (g), and creation date.
- **FR-002**: Initial current weight MUST be captured at profile creation as the first weight
  record; "current weight" is always the most recent weight record.
- **FR-003**: Users MUST be able to edit all profile fields; edits to one profile MUST NOT affect any
  other profile.
- **FR-004**: Access MUST use a shared app with a profile selector where each profile is protected
  by its own PIN (4–6 digits) set at creation. Entering a profile requires its PIN; the PIN MUST be
  stored only in non-reversible form, repeated wrong attempts MUST trigger a temporary lockout
  (e.g., 5 failures → 1-minute wait), the session MUST return to the selector after a period of
  inactivity or on explicit "switch profile", and a forgotten PIN MUST be resettable through a
  documented recovery path that does not expose the profile's data to the other user.
  Recovery-code attempts MUST be rate limited with the same escalating lockout policy as PIN
  attempts (separate counter); a successful recovery resets both the recovery and PIN failure
  counters. Authorization MUST be enforced on the server for every profile-scoped request.
- **FR-005**: All data (meals, activities, weights, custom foods, favorites, templates, calendar,
  streaks, pet) MUST be scoped to a single profile; no screen or export may show another profile's
  data.
- **FR-006**: Values MUST be stored in metric units (g, ml, kg, cm, kcal); preferred units affect
  display and input only.
- **FR-007**: Data preferences per profile MUST include: weight unit (kg or lb), height unit (cm or
  ft/in), food quantity unit (metric g/ml, or imperial oz/fl oz for display and input), and time
  zone (IANA, default America/Bogota). Local dates, day boundaries, streaks, and daily summaries
  MUST use the profile's time zone. Data export is out of scope for the MVP.
- **FR-008**: Profile creation and discovery MUST be protected: (a) creating a profile without
  authentication is allowed only while no profiles exist (initial setup); (b) afterwards, creation
  requires an authenticated profile session or a valid SETUP_TOKEN, checked only on the server and
  never sent to or embedded in the frontend; (c) the profile selector and profile names MUST be
  returned only to enrolled devices; a device is enrolled during initial setup, with the
  SETUP_TOKEN, or with a short-lived one-time pairing code generated from an authenticated
  session; (d) setup-token and pairing-code attempts MUST be rate limited.

#### Energy calculations

- **FR-010**: System MUST compute BMR with Mifflin-St Jeor by default (men: 10×kg + 6.25×cm −
  5×age + 5; women: 10×kg + 6.25×cm − 5×age − 161). The formula MUST be configurable (an
  alternative formula may be selected per profile), and the active formula MUST be shown to users.
- **FR-011**: System MUST offer five everyday activity levels with documented default multipliers:
  sedentary 1.2, light 1.375, moderate 1.55, high 1.725, very high 1.9. Activity level descriptions
  MUST state that they describe daily life **excluding** exercise logged in the app.
- **FR-012**: Baseline TDEE MUST equal BMR × activity multiplier. Daily estimated expenditure MUST
  equal baseline TDEE + sum of logged activities' net estimated expenditure (energy above resting),
  so resting energy and exercise are never double-counted.
- **FR-013**: Recommended calorie target MUST equal baseline TDEE + configured adjustment (positive
  surplus for gain, negative deficit for loss, 0 for maintenance). Logged exercise MUST NOT change
  the daily target automatically.
- **FR-014**: Users MUST be able to set the surplus/deficit and optionally override the calorie
  target manually; both the recommended and active targets MUST be visible.
- **FR-015**: When a target falls below the greater of BMR or 1,200 kcal, or the adjustment exceeds
  25% of baseline TDEE, the system MUST show a non-medical caution and require confirmation.
- **FR-016**: Daily energy balance MUST be calculated as estimated expenditure − calories consumed;
  positive = "estimated deficit", negative = "estimated surplus", zero = "estimated maintenance".
  This convention MUST be used consistently on every screen.
- **FR-017**: Every BMR, TDEE, activity expenditure, and balance value MUST be labeled as an estimate
  and MUST NOT be presented as an exact change in fat, muscle, or body weight.
- **FR-018**: A "how is this calculated?" view MUST show formulas, inputs, multipliers, and MET values
  used for the selected day.
- **FR-019**: Historical energy calculations MUST be reproducible:
  (a) energy-relevant settings (goal type, activity level and multiplier, calorie adjustment,
  manual target override, macro targets, sex for formula, birth date, height, BMR formula, and
  calculation version) MUST be stored as effective-dated versions; a change takes effect from the
  local date on which it is made (today) onward and never rewrites earlier days;
  (b) when a day first receives a relevant tracking record (food or activity entry), the system
  MUST store a day energy snapshot (settings version, weight used, age, BMR, multiplier, baseline
  TDEE, adjustment, recommended and active target, macro targets, formula, calculation version);
  past days' summaries MUST be computed from that snapshot;
  (c) today's snapshot is refreshed when settings change today, and the UI states that the change
  applies from today;
  (d) a backfilled day with no snapshot resolves the settings version effective on that date (the
  first version if the date precedes it) and the latest weight record on or before that date (the
  earliest record if none precedes it), then stores its snapshot;
  (e) later edits to weight records do not alter existing past-day snapshots.

#### Food catalog

- **FR-020**: Each food MUST store: name, alternative names/search terms, category, nutrition basis
  (per 100 g or per 100 ml), kcal, protein, carbohydrates, total fat, optional fiber, sugar, sodium
  (mg), preparation state (raw, cooked, prepared, packaged), brand (if branded), data source, source
  identifier, and version or last-update information. Optional density (g/ml) for liquids.
- **FR-021**: Missing optional nutrients MUST be stored as unknown, not zero.
- **FR-022**: Search MUST match names and alternative names, case- and accent-insensitive, in Spanish
  and English, and allow filtering by category, preparation state, and branded vs. generic.
- **FR-023**: The catalog MUST be populated through a reproducible, documented, extensible import
  process (one adapter per source), respecting each source's license and attribution. Imports MUST
  be idempotent and versioned. Source order: (1) USDA FoodData Central Foundation and SR Legacy for
  generic foods; (2) USDA FNDDS for generic foods and prepared dishes it covers; (3) Open Food
  Facts snapshots for packaged and branded products, including Colombian products — never as a
  source for homemade dishes; (4) the Colombian food composition table (TCAC) only after its
  licensing conditions are verified.
- **FR-024**: The initial catalog MUST cover, from the sources above, common foods: rice, eggs,
  chicken, beef, fish, bread, potatoes, plantain, beans, lentils, milk, cheese, common fruits,
  common vegetables, oats, and common packaged foods (including packaged arepas when available in
  Open Food Facts), with raw and cooked variants where values differ. Items without a verified
  record (initially "arepa (casera)" and Colombian fresh cheeses) MUST be listed as known coverage
  gaps; nutritional values MUST NOT be fabricated or silently substituted from a different food.
- **FR-025**: The application MUST remain fully functional using its locally stored catalog when
  external sources are unavailable.
- **FR-026**: Users MUST be able to create custom foods (owned by their profile) and record
  corrections to catalog foods as profile-level overrides marked with their origin.
- **FR-027**: Users MUST be able to mark favorites; the system MUST track frequently logged foods per
  profile and surface favorites and frequent foods in quick-add.
- **FR-028**: Source attribution required by licenses MUST be visible in the app.
- **FR-029**: Known coverage gaps MUST be documented in a maintained list, and the import process
  MUST produce a coverage report against the FR-024 list. When a search returns no verified food,
  the app MUST offer creating a custom food instead of suggesting an unrelated food.

#### Meal journal

- **FR-030**: Users MUST be able to log entries under meal occasions: breakfast, morning snack,
  lunch, afternoon snack, dinner, and additional meals (user-labeled).
- **FR-031**: Each entry MUST include food, quantity (g or ml), date and time (defaulting to now),
  and optional notes. Preparation state belongs to the selected food variant (e.g., "Arroz blanco,
  crudo" vs "Arroz blanco, cocido"; "Pechuga de pollo, cruda" vs "Pechuga de pollo, cocida"), is
  shown when choosing the food, and is preserved in the entry's snapshot; it is not a separate
  per-entry field.
- **FR-032**: Nutrient amount MUST be calculated as (quantity / 100) × value per 100 of the food's
  basis. When quantity unit and food basis differ (ml vs. g), density MUST be used if known;
  otherwise 1 g/ml is assumed and the result is flagged as approximate.
- **FR-033**: Each entry MUST store a snapshot of the nutrition values (and source/version) used at
  logging time; later catalog changes MUST NOT alter existing entries.
- **FR-034**: System MUST show per-entry, per-meal, and per-day totals for kcal, protein,
  carbohydrates, and fat (and fiber, sugar, sodium when available), updating immediately after any
  add, edit, or delete.
- **FR-035**: Users MUST be able to edit and delete entries, duplicate a previous meal to another
  date/occasion, save a meal as a template, and apply a template in one action.
- **FR-035a**: Users MUST be able to build a meal with any number of items (foods with quantity in
  g or ml, and portions of saved preparations) in one screen: search and add without losing the
  rows already added, see per-row kcal/protein/carbohydrates/fat, edit or remove rows, see live
  meal totals, and save the whole meal in one action. An existing meal MUST be editable the same
  way in one save: kept entries keep their snapshot, new items are snapshotted at save time,
  omitted entries are removed. Quantities MUST be > 0; an invalid item rejects the whole save.
- **FR-035b**: Meal templates MUST store the full combination of items (foods with quantities and
  preparation portions) and can be loaded into the meal builder for review before saving, or
  applied in one action.
- **FR-036**: Users MUST be able to log entries without completing or "closing" the day; partial
  days are always valid.
- **FR-037**: Calculated values MUST be stored with full precision and rounded only for display
  (kcal to whole numbers, grams to one decimal).

#### Preparations (recipes)

- **FR-038**: Users MUST be able to create, edit, reuse, delete and create variations of their own
  preparations, each with a name, ingredients (catalog or custom foods with quantity and g/ml
  unit), optional notes/instructions, optional number of servings, optional actual final yield
  (g or ml) and a homogeneous flag. Preparations belong to one profile and keep their ingredient
  composition; they are not catalog foods. The builder MUST be reachable from the meal builder.
- **FR-039**: A preparation's nutrients MUST be calculated in the domain layer as the sum of each
  ingredient's contribution, `(quantity in the ingredient's basis / 100) × value per 100` (FR-032),
  using each ingredient's own reference. Adding water MUST NOT change the total. Ingredients with
  missing or invalid references MUST be rejected, never treated as zero. The UI MUST use the same
  domain functions and show the complete preparation, per serving (when servings are set) and per
  100 g/ml of the final preparation (only when a yield is entered).
- **FR-045**: A consumed portion MUST be one of: the whole preparation; N of its servings
  (`N / servings`); or an amount of its actual final yield (`amount / yield`), allowed only for
  homogeneous preparations and in the yield's unit. A portion MUST NOT exceed the whole
  preparation. The final yield MUST NOT be inferred from the ingredient sum. For non-homogeneous
  preparations, users MUST be able to log the ingredients actually eaten instead.
- **FR-046**: Every save of a preparation MUST create an immutable version holding its ingredient
  snapshots (food version and values per 100 used) and its calculated totals. Meal entries MUST
  reference the version used; editing a logged portion recomputes from that version; editing the
  recipe or the catalog MUST NOT change logged meals.
- **FR-047**: Water MUST be available as an ingredient, with zero energy and macronutrients, from a
  documented reference record. Other zero or negligible ingredients are supported when a record
  with those values exists; liquids MUST NOT be assumed to be zero.
- **FR-048**: Foods MUST record the product form their values refer to (ready to consume, dry mix
  / powder, or concentrate) plus optional preparation instructions. Dry and prepared variants are
  separate records with their own source; estimated prepared values MUST NOT overwrite the original
  product values; reference records are identified by (source, source id) so re-seeding never
  duplicates them.
- **FR-049**: A preparation portion MUST be loggable directly in a meal, and the user MUST always
  see which ingredients and quantities it contains, the kcal of the complete preparation and the
  kcal of the consumed portion.

#### Activity

- **FR-040**: Users MUST be able to log activities with: type, duration (minutes), date, optional
  intensity, optional notes, and optional estimated calories.
- **FR-041**: System MUST provide built-in activity types (walking, running, swimming, cycling,
  gym/strength training, volleyball, basketball, tennis) with configurable MET values per intensity,
  plus user-defined custom activities.
- **FR-042**: When a MET value is available, net estimated expenditure MUST be calculated as
  (MET − 1) × body weight (kg, from the day's energy snapshot, FR-019) × duration (hours). Users
  MAY instead enter their own estimate (e.g., from a device), which replaces the computed one.
- **FR-043**: Users MUST be able to log an activity with no calorie estimate; it counts for tracking
  but adds 0 to expenditure.
- **FR-044**: Activity records MUST be independent of food records.

#### Weight

- **FR-050**: Users MUST be able to add, view, edit, and delete weight records with date and
  optional notes; records are never overwritten by new ones.
- **FR-051**: System MUST display a weight chart with raw measurements and a smoothed trend
  (default: 7-day moving average, or an equivalent smoothing method), and compare trend weight to
  target weight.
- **FR-052**: Progress statements MUST be based on the trend, not single-day changes.

#### Calendar and streaks

- **FR-060**: System MUST show a monthly calendar per profile with historical navigation, each day
  showing exactly one of: `none` (no food or activity records); `activity_only` (≥ 1 activity, no
  food entries); `food_partial` (≥ 1 food entry, food not completed; an activity marker is shown if
  activities exist); `food_completed` (food completed, no activity, not a rest day);
  `full_completed` (food completed + ≥ 1 activity); `rest_completed` (food completed + day marked
  as rest day, no activity). Weight records do not affect the day state.
- **FR-061**: A day's food tracking is "completed" when either (a) at least 3 distinct meal
  occasions have at least one entry, or (b) the user has marked the day "day complete" and it has at
  least one food entry. Marking is optional and never required; it can be undone. Days with food
  entries that meet neither condition are "food partially recorded".
- **FR-062**: Completion MUST NOT depend on reaching, exceeding, or staying under any calorie or
  macronutrient target.
- **FR-063**: System MUST track per profile: current streak, longest streak, **total recorded days**
  (days with ≥ 1 food or activity entry, i.e., state ≠ `none`), **total completed days** (days in a
  completed state: `food_completed`, `full_completed`, `rest_completed`), and monthly completion
  percentage (completed days ÷ elapsed days in month).
- **FR-064**: To avoid disproportionate punishment, each profile MUST earn one "streak freeze" for
  every 7 reward-eligible completed days, whether or not they are consecutive (maximum 2 stored).
  A freeze is consumed automatically only for a missed day that would otherwise break an active
  streak, never more than the freezes owned, and the frozen day keeps the streak without adding to
  it. A completed day is reward-eligible only if it became completed within the backfill window
  (no later than 2 days after its date); days completed later still count for calendar state,
  totals, and streak length, but do not earn freezes, streak XP, or streak milestones. Breaking a
  streak MUST NOT remove XP, stage, accessories, or longest-streak records.
- **FR-065**: Users MUST be able to open any past day and view its meals, activities, and nutrition
  and energy summary.

#### Virtual pet

- **FR-070**: Each profile MUST have exactly one independent pet (initially a cat) with name,
  evolution stage, XP, mood, appearance (stage + equipped accessories), and progress to next stage.
- **FR-071**: XP MUST be awarded for: logging food entries, completing a food-tracking day, logging
  an activity, an activity bonus (+1 XP, only on completed days with ≥ 1 activity), recording
  weight (at most once per 3 days counted), maintaining streaks, and reaching consistency
  milestones. Each source MUST have a daily cap per logged date; XP for backfilled dates MUST be
  awarded only for dates within the last 2 days (the backfill window). Deleting a record MUST
  revoke the XP it granted, and XP that depends on a day's state (food day, activity bonus) MUST
  be revoked if that day stops being completed, so add/delete cycles cannot be exploited.
- **FR-072**: XP, treats, freezes, milestones, and accessories MUST NOT depend on calories consumed,
  goal type, or target attainment; profiles with different goals and identical logging behavior
  MUST progress identically (presentation may differ per FR-078).
- **FR-073**: The pet MUST evolve through 5 stages: newborn kitten, young kitten, adolescent cat,
  adult cat, special evolution, based on cumulative XP thresholds that are documented and visible.
  Default thresholds MUST make the final stage reachable in roughly 90–120 days of consistent
  tracking.
- **FR-074**: XP never decreases because of missed days, nutritional target outcomes, or normal
  progression. XP associated with deleted records may be revoked (FR-071). Pet evolution stage
  never decreases (it is based on the highest XP ever reached). Mood MAY decrease mildly after
  missed days, with a floor (the pet never becomes sick, hungry-to-death, or dies), and MUST
  recover through any logging action or feeding.
- **FR-075**: Users MUST earn treats and be able to feed them to the pet to improve mood. A treat
  is granted once per day that reaches `food_completed` (or a completed state built on it);
  activity-only days grant no treat; milestones may grant extra treats. Treat and XP eligibility
  MUST be independent of calorie target achievement, and feeding MUST NOT be tied to calories
  eaten.
- **FR-076**: Milestones (e.g., 7/30/100-day streaks, first week completed, stage evolutions) MUST
  show messages and MAY unlock cosmetic accessories that users can equip.
- **FR-077**: The pet MUST be shown prominently on the home dashboard without hiding the nutrition
  summary; static illustrations per stage are sufficient.
- **FR-078**: Pet messages, milestone texts, and tips MUST be adapted to the profile's goal type
  while milestones, thresholds, XP, treats, and accessories stay identical across goals:
  weight gain → sustainable nutritional progress and regular meals; weight loss → sustainable
  habits and consistency; maintenance → balance and keeping established habits. No message may
  praise eating more or less, skipping meals, or reaching a calorie number; every event MUST have a
  message for all three goals.

#### Screens and flow

- **FR-080**: The application MUST provide: Home/Dashboard, Food Journal, Activity, Calendar,
  Progress, Food Database, Pet (`/mascota`: evolution path, wardrobe, milestones, XP rules), and
  Profile & Settings screens with the contents listed in §10; "Data preferences" in Profile &
  Settings means the FR-007 preferences.
- **FR-081**: From Home, users MUST be able to start meal logging and activity logging directly
  (one tap), and switch profiles.
- **FR-082**: The layout MUST be usable on mobile phone screens as the primary target and also on
  desktop.
- **FR-083**: All user input MUST be validated server-side, with clear, user-friendly error messages.
- **FR-084**: Primary interface language MUST be Spanish; food search MUST accept Spanish and
  English terms.

#### Non-functional deliverables (for planning phase)

- **FR-090**: The planning phase MUST produce: architecture proposal, domain model, data schema,
  nutritional data source evaluation (feasibility, licensing, update mechanisms), feature breakdown,
  MVP implementation plan, technical risks and open questions, and test strategy (§12, §15).
- **FR-091**: Nutritional calculations, energy calculations, streak rules, and XP rules MUST have
  automated tests.

### Key Entities

- **Profile**: A person using the app; identity, PIN, data preferences (units, time zone),
  creation date. Owns all other personal entities.
- **Profile Settings Version**: Effective-dated energy-relevant settings (goal, activity level,
  multiplier, adjustment, targets, anthropometric inputs, formula, calculation version).
- **Day Energy Snapshot**: Per-profile, per-day frozen energy inputs and results (FR-019).
- **Enrolled Device / Pairing Code**: Devices allowed to see the profile selector (FR-008).
- **Weight Record**: Date, weight (kg), optional note; belongs to a profile.
- **Food**: Catalog item with nutrition per 100 g/ml, names and aliases, category, preparation
  state, product form (ready / dry mix / concentrate) and preparation instructions, brand, source,
  source identifier, version; may be global (imported or reference) or profile-owned (custom).
- **Food Override**: A profile's correction to a catalog food's values, with origin marked.
- **Data Source / Import Run**: Identity, license/attribution, and versioned import runs that
  produce or update foods.
- **Meal**: A meal occasion on a date for a profile (breakfast, snacks, lunch, dinner, additional).
- **Meal Entry**: Either a food (reference, quantity and unit, nutrition snapshot with
  source/version) or a preparation portion (recipe version, portion mode, servings or amount,
  portion factor); time, notes and calculated nutrients.
- **Meal Template**: Named reusable list of foods with quantities and preparation portions, owned
  by a profile.
- **Recipe (Preparation)**: A profile's named preparation; stable identity, current version,
  hidden flag.
- **Recipe Version**: Immutable composition of a recipe: servings, actual final yield and unit,
  homogeneous flag, notes, calculated totals.
- **Recipe Ingredient**: Food reference, food version, quantity and unit, frozen values per 100 and
  the calculated contribution.
- **Favorite / Usage Frequency**: Per-profile food preference and logging frequency.
- **Activity Type**: Built-in or custom activity with MET values per intensity.
- **Activity Entry**: Type, date, duration, intensity, notes, estimate source (MET, manual, none),
  net estimated kcal.
- **Day Status**: Derived per-profile daily tracking state (6 states, FR-060), rest-day and
  "day complete" flags, first-completed timestamp for reward eligibility.
- **Streak State**: Current/longest streak, freezes available, total recorded days, total
  completed days.
- **Pet**: Name, stage, cumulative XP, mood, treats, equipped accessories; one per profile.
- **XP Event**: Source, logged date, amount, related record; supports daily caps and revocation.
- **Milestone / Accessory**: Definitions and per-profile unlock state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can log a food item with a weighed quantity (search, select, enter grams,
  confirm) in under 20 seconds, and a 4-item meal in under 90 seconds.
- **SC-002**: Re-logging a favorite, frequent food, or template takes 3 interactions or fewer.
- **SC-003**: Food search shows results while typing with no perceptible delay for the local
  catalog, and at least 90% of the listed priority Colombian foods are found on the first search.
- **SC-004**: 100% of tested calculation cases (nutrients, BMR, TDEE, MET, balance sign, streaks,
  XP caps) match hand-calculated expected values.
- **SC-005**: 0 instances of one profile's data being visible from another profile in testing.
- **SC-006**: After any catalog update or profile settings change, 100% of historical entries and
  past-day energy summaries retain their original values.
- **SC-007**: Two profiles with opposite goals and identical logging behavior show identical XP,
  stage, treats, freezes, and streaks in 100% of test cases (only message texts differ).
- **SC-008**: Both initial users log food on at least 5 of 7 days per week during the first month
  of use (habit outcome).
- **SC-009**: In a usability check, both users can correctly explain what their daily target and
  energy balance mean after viewing the "how is this calculated?" explanation.
- **SC-010**: All core flows work on a mobile phone screen without horizontal scrolling.
- **SC-011**: A 4-item meal is saved with one "save meal" action without leaving the meal builder,
  and the rows already added stay visible while the next one is searched.
- **SC-012**: 100% of tested preparation cases (powder in water/milk, servings, partial amounts,
  yield different from the ingredient sum, invalid references) match hand-calculated values, and
  editing recipes or catalog foods changes 0 historical entries.

## Assumptions

- Initial users are two adults in Colombia; Spanish UI, metric units, Colombian time zone by
  default.
- Sex for formulas offers male/female; an "other / prefer not to say" option uses the average of
  both formula constants and is explained as such.
- Date of birth is stored instead of fixed age so age stays current.
- Household portions (e.g., "1 egg ≈ 50 g") may be offered when a source provides them, but grams/ml
  remain the primary input.
- Calorie target defaults: gain +300 kcal, loss −400 kcal, maintenance 0; users can adjust.
- Activity level excludes logged exercise; this is the chosen method to prevent double-counting
  and is explained in the app.
- Weight trend uses a 7-day moving average by default.
- Streak freezes, XP caps, thresholds, and mood rules are configurable defaults to be tuned in
  planning.
- Out of scope (§14): photo food recognition, image calorie estimation, barcode scanning, wearable
  integration, social features/leaderboards, medical advice, advanced meal planning, automatic diet
  generation, paid subscriptions, real-time multiplayer.
- Internet connection is available for initial catalog import; day-to-day use relies on the local
  catalog.
- Existing repository contains no application code yet; the stack is chosen during planning with
  justification per the constitution.
