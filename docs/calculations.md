# How NutriPet calculates (Constitution III)

Every number here matches `src/domain/config.ts` (calculation version `CALC_VERSION = 1`). All
energy values are **estimates**, and the app labels them "estimado".

## Basal metabolic rate (BMR)

Mifflin-St Jeor (default):

```text
BMR = 10 × weight(kg) + 6.25 × height(cm) − 5 × age + s
s = +5 (male), −161 (female), −78 (unspecified = mean of both constants)
```

Harris-Benedict revised (Roza & Shizgal 1984), selectable:

```text
male   = 88.362 + 13.397 × kg + 4.799 × cm − 5.677 × age
female = 447.593 + 9.247 × kg + 3.098 × cm − 4.330 × age
unspecified = mean of both
```

Age is computed from the birth date on the day being calculated.

## Daily expenditure and target

| Activity level (daily life, **excluding logged exercise**) | Multiplier |
|---|---|
| Sedentario | 1.2 |
| Ligero | 1.375 |
| Moderado | 1.55 |
| Alto | 1.725 |
| Muy alto | 1.9 |

```text
baseline TDEE        = BMR × multiplier
activity (net)       = (MET − 1) × weight(kg) × hours        (never negative)
estimated expenditure = baseline TDEE + Σ activity (net)
recommended target   = baseline TDEE + adjustment             (gain ≥ 0, loss ≤ 0, maintenance = 0)
active target        = manual override if set, else the recommended target
```

- **No double counting**: the multiplier describes life *without* logged exercise. Logged
  exercise adds only its energy above resting (MET − 1), because resting energy is already in BMR.
- **The target does not move with exercise.**
- **Default adjustments**: +300 kcal (gain), −400 kcal (loss), 0 (maintenance).
- **Safety caution** (non-medical, requires confirmation): active target < max(BMR, 1200 kcal), or
  |adjustment| > 25% of baseline TDEE.
- **Default METs**: 2024 Adult Compendium of Physical Activities (light / moderate / vigorous).
  Examples: walking 2.8/3.5/5.0; running 7.0/9.8/11.5; volleyball 3.0/4.0/8.0. A manual estimate
  replaces the MET calculation; "sin estimación" adds 0.

## Energy balance (sign convention)

```text
balance = estimated expenditure − calories consumed
positive → "déficit estimado"; negative → "superávit estimado"; zero → "mantenimiento estimado"
```

The balance is never presented as an exact change in fat, muscle or body weight.

## History stays reproducible (FR-019)

- **Settings versions**: energy-relevant settings (goal, activity level and multiplier, adjustment,
  override, macro targets, sex, birth date, height, formula, calculation version) are stored as
  versions dated from the day they change. A change applies from **today** onward.
- **Day snapshot**: when a day receives its first food or activity entry, its inputs and results
  are frozen: settings version, weight, age, BMR, multiplier, baseline TDEE, adjustment, targets,
  formula, calculation version.
  - Past days are always computed from their snapshot.
  - Today's snapshot is refreshed when settings or today's weight change.
- **Backfill**: a day without a snapshot uses the settings version in effect on that date (the first
  version if the date is earlier) and the latest weight on or before it (else the earliest weight).
- Editing a weight record never changes past snapshots.
- **Logged food** keeps a copy of the per-100 values used at logging time. Catalog updates and user
  corrections affect only new entries.

## Nutrients

```text
amount = (quantity in the food's basis / 100) × value per 100 g (or 100 ml)
```

If the unit differs from the food's basis (g vs ml), the food's density is used. Without a density,
1 g = 1 ml is assumed and the entry is marked **aproximado**. Unknown optional nutrients (fiber,
sugar, sodium) stay unknown, never 0, and totals say when they are incomplete. Values are stored at
full precision and rounded only for display (kcal to integers, grams to one decimal).

## Preparations (recipes)

```text
contribution(ingredient) = (quantity in the ingredient's basis / 100) × its value per 100
preparation total        = Σ contribution(ingredient)
per serving              = total / servings                     (only if servings are set)
per 100 g/ml of the dish = total × 100 / actual final yield     (only if the yield was entered)
consumed                 = total × factor
  factor = 1 (whole) | n / servings | amount / yield  (≤ 1; "amount" only for uniform mixtures)
```

Each ingredient uses its **own** reference: a powder labeled 400 kcal per 100 g contributes
`20 / 100 × 400 = 80 kcal` when 20 g are used. Water (reference record, 0 kcal) contributes 0, so
adding water never changes the total; it only lowers the kcal per 100 ml of the drink. Milk or any
other liquid adds its own contribution. The values per 100 g of the powder are **never** used as
values per 100 ml of the prepared drink.

The final yield is what the user weighs or measures; it is not the sum of the ingredients (cooking
evaporates water, oats absorb milk). Without it, there are no per-100 values and portions can only
be "whole" or "servings". For mixtures that are not uniform (e.g. rice with egg on top), the
person logs the whole dish, equal servings, or the ingredients they actually ate.

Every saved change creates a new immutable recipe version. A logged portion stores the version it
used and is always recomputed from it, so editing the recipe or the catalog never changes history.
Functions: `src/domain/nutrition/recipe.ts`.

## Weight trend

Each day's value is that day's latest record. The trend is a 7-day trailing moving average over the
available daily values, shown only from 3 measurement days. Progress statements (change over 7 days,
distance to target) use the trend, never a single day.

## Day states

| State | Rule |
|---|---|
| `none` | no food and no activity |
| `activity_only` | ≥ 1 activity, no food |
| `food_partial` | food logged but not completed |
| `food_completed` | food completed, no activity, not a rest day |
| `full_completed` | food completed + ≥ 1 activity |
| `rest_completed` | food completed + rest day, no activity |

**Food completed** means ≥ 3 different meal occasions with an entry, **or** the optional "día
completo" mark with ≥ 1 entry. Calorie targets never affect completion. Weight records don't affect
the state.

## Streaks

- **Totals**: total recorded days = state ≠ `none`. Total completed days = the three completed states.
- **Streak**: consecutive completed days. An unfinished today never breaks it.
- **Freezes**: 1 for every 7 *reward-eligible* completed days, counted cumulatively (not necessarily
  consecutive), holding at most 2. A freeze is used automatically only for a missed day inside an
  active streak, never more than you have. The frozen day keeps the streak without adding to it.
- **Reward-eligible**: the day became completed no later than 2 days after its date (the backfill
  window). Days completed later still count for the calendar, totals and streak length, but earn no
  freezes, streak XP or streak milestones.
- **Monthly %**: completed days ÷ elapsed days of the month since the profile was created. Today
  counts only once completed.

## Pet (XP, treats, stages, mood)

| Source | XP | Daily cap (per logged date) |
|---|---|---|
| Food entry | 2 | 20 |
| Completed food day | 15 | 15 |
| Activity | 5 | 10 |
| Activity bonus (completed day with ≥ 1 activity) | 1 | 1 |
| Weight (at most once every 3 days) | 10 | 10 |
| Streak bonus (streak ≥ 3, reward-eligible day) | min(streak, 10) | 10 |
| Milestones (7/14/30/60/100-day streaks, first full week) | 25–100 | once |

- **XP timing**: XP is awarded only for logged dates from today − 2 to today.
- **Treats**: 1 per completed day; activity-only days give none. Milestones add treats. Feeding uses
  one treat (+15 mood, max 100).
- **Stages** (cumulative XP): newborn 0 → young 300 → adolescent 1,200 → adult 3,000 → special
  5,500. That's about 110 days of consistent tracking.
- **Mood**: 30–100. −10 per fully missed day, never below 30. +10 on any logging action.
- **Revocation**:
  - XP never decreases because of missed days, target outcomes or normal progression.
  - Deleting a record revokes its XP. A day that stops being completed loses its day-level XP and
    its treat, but a treat already fed is not taken back.
  - The stage uses the highest XP ever reached, so it never decreases.
- **Equivalence**: rewards are identical for every goal. Only the messages change (see
  `docs/gamification-messaging.md`).
