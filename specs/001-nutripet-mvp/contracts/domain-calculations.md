# Contract: Domain Calculation Functions

Pure, synchronous TypeScript functions in `src/domain/` with no I/O and no UI imports
(Constitution §4). Each function is the single source of truth, used by the API and the UI and
covered by unit tests. The reference examples below are **mandatory test cases** (SC-004).

## nutrition

```text
scaleNutrients(per100: NutrientsPer100, quantity: number, unit: 'g'|'ml',
               basis: 'g'|'ml', densityGPerMl?: number)
  → { nutrients: Nutrients, approximate: boolean }
sumNutrients(list: Nutrients[]) → Nutrients   // null-propagating for fiber/sugar/sodium; reports incomplete keys
```
- `amount = quantity_in_basis / 100 × per100`. g→ml: ÷ density; ml→g: × density. Without a
  density, 1 g/ml is assumed and `approximate = true`.
- Example: per100 kcal 155, P 12.6, C 1.1, F 10.6; 100 g → 155 / 12.6 / 1.1 / 10.6.
- Example: kcal 219/100 g, 130 g → 284.7 kcal.
- Example: milk 61 kcal/100 ml, 200 ml → 122 kcal; same food with basis g and no density →
  122 kcal, approximate.
- Sum with one unknown fiber → fiber reported as the sum of known values, with `incomplete:
  ['fiber']`.

## preparations (`src/domain/nutrition/recipe.ts`, FR-039, FR-045)

```text
ingredientContribution(ingredient: { quantity, unit, basis, densityGPerMl, per100 })
  → { nutrients, approximate }            // = scaleNutrients; throws NutritionError on invalid input
computePreparation({ ingredients, servings?, yield?: { quantity, unit } })
  → { ingredients, totals, incomplete, approximate, perServing | null, per100OfYield | null }
portionFactor(facts: { totals, servings, yield, homogeneous }, portion) → 0 < f ≤ 1
portionNutrients(facts, portion) → { nutrients = totals × f, factor }
portion = { mode: 'whole' } | { mode: 'servings', servings } | { mode: 'amount', quantity, unit }
```
- `totals = Σ contribution(ingredient)`; each contribution uses the ingredient's own per-100
  reference. `perServing = totals / servings`; `per100OfYield = totals × 100 / yield`. The yield
  is the value the user entered; it is never computed from the ingredients.
- `whole → 1`; `servings → n / servings` (servings must be defined); `amount → q / yield` (yield
  must be defined, same unit, homogeneous preparation). `f > 1` → `portion_exceeds_total`.
- Invalid input throws `NutritionError(code)`: `invalid_reference` (NaN/negative/missing core
  value), `invalid_quantity` (≤ 0), `no_ingredients`, `invalid_yield`, `invalid_servings`,
  `servings_unknown`, `yield_unknown`, `unit_mismatch`, `portion_exceeds_total`, `not_homogeneous`.

Reference examples (mandatory, `tests/unit/domain/recipe.test.ts`):
- Lemonade powder 400 kcal/100 g: 20 g + water 300 ml → **80 kcal** (water 0). With 1000 ml of
  water → still 80 kcal. 10 g → 40 kcal; 35 g → 140 kcal.
- Same 20 g + whole milk 300 ml (61 kcal/100 ml) → 80 + 183 = **263 kcal**.
- Chocolate powder 380 kcal/100 g, 25 g + milk 200 ml → 95 + 122 = 217 kcal; milk 250 ml → 247.5.
- Oatmeal: oats 50 g (379) + milk 200 ml (61) + banana 80 g (89) → 189.5 + 122 + 71.2 = 382.7 kcal.
- 400 kcal preparation, yield 500 ml: 200 ml → **160 kcal**; 2 of 4 servings → 200 kcal.
- Oatmeal with an entered cooked yield of 280 g (ingredients "add up" to ~330): totals unchanged,
  per 100 g = totals × 100 / 280.
- Non-homogeneous preparation: `amount` → `not_homogeneous`; `whole` and `servings` allowed.
- Lemonade 80 kcal: 200 ml glass of a 320 ml yield → 50 kcal; with 800 ml water (820 ml yield) →
  80 × 200 / 820 ≈ 19.5 kcal (same total, lower concentration).

## energy

```text
ageOn(birthDate, date) → int
bmr({ formula, sex, weightKg, heightCm, age }) → kcal
activityMultiplier(level) → 1.2 | 1.375 | 1.55 | 1.725 | 1.9
baselineTdee(bmr, level) → kcal
recommendedTarget(baselineTdee, adjustmentKcal) → kcal
targetCaution({ target, bmr, baselineTdee, adjustmentKcal }) → null | 'target_below_safety' | 'adjustment_over_25pct'
activityNetKcal({ met, weightKg, durationMin }) → max(0, (met − 1) × kg × min/60)
dailyEnergy({ baselineTdee, activityNetKcal[], intakeKcal })
  → { expenditureKcal, balanceKcal, balanceLabel: 'deficit'|'surplus'|'maintenance' }
```
- Mifflin-St Jeor, male 80 kg, 180 cm, 30 y → 10·80 + 6.25·180 − 5·30 + 5 = **1780**.
- Female 65 kg, 165 cm, 28 y → 650 + 1031.25 − 140 − 161 = **1380.25**.
- Unspecified sex uses constant −78.
- Harris-Benedict revised (Roza & Shizgal 1984): male 88.362 + 13.397·kg + 4.799·cm − 5.677·age;
  female 447.593 + 9.247·kg + 3.098·cm − 4.330·age.
- 1780 × 1.55 = 2759 baseline; +300 → target 3059; −400 → 2359.
- Running MET 9.8, 66 kg, 30 min → (8.8 × 66 × 0.5) = **290.4** net kcal.
- Expenditure 2400, intake 2000 → balance **+400, 'deficit'**; intake 2700 → **−300,
  'surplus'**; intake 2400 → **0, 'maintenance'**.
- Caution: target 1150 with BMR 1380 → `target_below_safety`; adjustment −800 with baseline 2759
  (29%) → `adjustment_over_25pct`.

## settings history (FR-019)

```text
effectiveSettings(versions: SettingsVersion[], date) → SettingsVersion
  // greatest effectiveFrom ≤ date (ties: latest createdAt); date before v1 → v1
weightForDate(records: WeightRecord[], date) → { weightKg, recordId }
  // latest record ≤ date (ties: latest createdAt); none before → earliest record
buildDayEnergySnapshot({ settings, weight, date, calcVersion }) → DayEnergySnapshot
dayEnergyFromSnapshot(snapshot, activityNetKcal[], intakeKcal) → dailyEnergy(...) result
```
- Versions v1 (effective 2026-11-01, moderate) and v2 (effective 2026-11-10, light) → for
  2026-11-05 resolve v1, for 2026-11-10 and later resolve v2, for 2026-10-20 resolve v1.
- Two versions both effective 2026-11-10 → the later `createdAt` wins.
- A snapshot built for 2026-11-05 stays byte-identical after v2 is added (reproducibility).
- Weights 66 kg (11-01) and 67 kg (11-07) → 11-05 uses 66; 10-30 uses 66 (earliest).

## tracking

```text
foodCompleted({ occasionsWithEntries: number, markedComplete: boolean, foodEntryCount: number }) → boolean
dayStatus({ foodEntryCount, occasionsWithEntries, markedComplete, activityCount, restDay })
  → 'none'|'activity_only'|'food_partial'|'food_completed'|'full_completed'|'rest_completed'
isCompleted(status) → boolean        // food_completed | full_completed | rest_completed
rewardEligible(date, firstCompletedAt, timeZone, windowDays = 2) → boolean
computeStreaks(days: { date, status, rewardEligible }[], today) →
  { current, longest, totalRecordedDays, totalCompletedDays, eligibleCompletedDays,
    freezesAvailable, frozenDates[] }
monthCompletionPct(days, month, today) → 0..100
```
- 3 occasions → completed. 2 occasions + markedComplete → completed. markedComplete with 0
  food entries → not completed.
- 0 food + 1 activity → `activity_only` (even if restDay); 1 food (not completed) + 1 activity →
  `food_partial`; completed + rest day + 0 activities → `rest_completed`; completed + activity →
  `full_completed` (activity wins over the rest day flag).
- 7 completed (eligible) days, 1 missed day, 1 completed day → current 8 (the frozen day keeps the
  streak alive but does not add to it), freezes 0, longest 8, frozenDates = [the missed day].
- 7 eligible completed days spread over 14 days with breaks → exactly 1 freeze earned
  (non-consecutive counting).
- 1 freeze owned, 2 consecutive missed days → the first is frozen, the second breaks the streak
  (current 0), freezes 0, never negative.
- 21 eligible completed days with no misses → freezes 2 (cap; the third is not stored).
- 7 completed days where 3 are **not** reward-eligible (completed 10 days late) → current 7,
  totalCompletedDays 7, eligibleCompletedDays 4, freezes 0.
- 5 completed, 1 missed (no freeze) → current 0 the next day, longest 5. Today unfinished →
  the streak is not broken and no freeze is consumed.
- totalRecordedDays counts `activity_only` and `food_partial` days; totalCompletedDays does not.
- Calorie target attainment is never an input (FR-062).

## gamification

```text
awardXp(existingEventsForDate, candidate, caps, today) → XpEvent | null   // enforces caps + backfill window (today − 2)
stageFor(maxXpReached) → stage                                             // thresholds 0/300/1200/3000/5500
applyMoodDecay(mood, missedDays) → max(30, mood − 10·missedDays)
moodOnAction(mood) → min(100, mood + 10)
feed(pet) → pet' (treats − 1, mood + 15, capped) | error 'no_treats'
treatsForDay(status) → 0 | 1                       // 1 iff isCompleted(status)
activityBonusXp(status, activityCount) → 0 | 1     // 1 iff isCompleted(status) and activityCount ≥ 1
dayRewardsToRevoke(prevStatus, newStatus) → XpSource[]   // food_day, activity_bonus, streak (+ treat) when leaving a completed state
messageKey(event, goalType) → string               // presentation only (FR-078)
```
- 20 food entries on one date → 10 events awarded (2 XP each, capped at 20 XP).
- Candidate for a logged date of today − 3 → null.
- XP total 299 → newborn; 300 → young; the stage is computed from max_xp_reached and never
  decreases, even after a revocation lowers xp_total.
- Mood 40, 5 missed days → 30 (floor).
- `treatsForDay('activity_only')` → 0; `treatsForDay('full_completed')` → 1;
  `activityBonusXp('food_partial', 2)` → 0; `activityBonusXp('full_completed', 1)` → 1.
- `messageKey('milestone.streak7', 'gain')` → `pet.msg.gain.streak7`; the same event for `loss`
  and `maintenance` returns its own key. Every event has keys for all 3 goals.
- **Invariant (property test)**: for any action sequence, XP, treats, freezes, milestones and
  stage are identical for two profiles differing only in goal type and kcal values; only
  `messageKey` results differ.
