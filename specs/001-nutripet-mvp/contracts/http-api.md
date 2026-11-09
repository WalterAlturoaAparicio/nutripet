# Contract: HTTP API (`/api/v1`)

The PWA UI is the only client. The same handlers back Next.js server actions. All bodies are
JSON and are validated with the shared Zod schemas (see [data-model.md](../data-model.md)).
Every request is validated on the server. The `profileId` always comes from the session cookie
and is never accepted from the client.

**Errors** use a single shape: `{ "error": { "code": string, "message": string (es),
"fields"?: Record<string,string> } }`.
Codes: `VALIDATION` 422, `UNAUTHENTICATED` 401, `DEVICE_NOT_ENROLLED` 401, `FORBIDDEN` 403
(profile creation without authorization), `LOCKED` 423 (with `retryAfterSec`), `RATE_LIMITED` 429
(with `retryAfterSec`), `NOT_FOUND` 404 (also returned for another profile's records), `CONFLICT`
409, `CONFIRM_REQUIRED` 409 (with `reason`; retry with `"confirm": true`).

**Cookies**: `np_session` and `np_device` are always `HttpOnly` and `SameSite=Strict`. `Secure` is
set when `COOKIE_SECURE=true` (default in production, `false` for local HTTP development).

**Estimates**: every energy value in a response is sent next to `"isEstimate": true` or inside an
`estimates` object, and the UI must label it as an estimate.

## Session and profiles

| Method & path | Auth | Body → Response |
|---|---|---|
Auth column: `none` = public; `device` = requires an enrolled `np_device` cookie (else
`DEVICE_NOT_ENROLLED`); `session` = requires `np_session` (implies device).

| Method & path | Auth | Body → Response |
|---|---|---|
| `GET /setup/status` | none | → `{ needsInitialSetup: boolean, deviceEnrolled: boolean }` (no names, no counts) |
| `POST /devices/enroll` | none | `{ setupToken? , pairingCode?, label }` (exactly one) → `204` + `np_device` cookie; `RATE_LIMITED` after 5 failures per IP (15 min) |
| `POST /devices/pairing-code` | session | → `{ code, expiresAt }` (8 chars, single use, 10 min) |
| `GET /devices` / `DELETE /devices/{id}` | session | list / revoke enrolled devices |
| `GET /profiles/selector` | device | → `[{ id, name, petStage: string \| null, petName: string \| null }]`; pet fields are `null` until US7 (no personal metrics) |
| `POST /profiles` | none (initial setup only) / session / setup token | `{ name, birthDate, sexForFormula, heightCm, weightKg, targetWeightKg, goalType, activityLevel, calorieAdjustmentKcal?, weightUnit?, heightUnit?, foodUnit?, timeZone?, pin, petName?, setupToken?, confirm? }` → `201 { profile, recoveryCode }` (recovery code shown once). Allowed without a session only when no profiles exist (then also enrolls the device). Otherwise it requires a session or a valid `setupToken` (checked on the server, constant time), else `FORBIDDEN`. May return `CONFIRM_REQUIRED(reason="target_below_safety")`. `petName` is stored for US7 and ignored before it. |
| `POST /session` | device | `{ profileId, pin }` → `204` + cookie; `LOCKED` after 5 failures |
| `DELETE /session` | session | → `204` (switch profile / logout) |
| `POST /profiles/{id}/pin-reset` | device | `{ recoveryCode, newPin }` → `{ recoveryCode }` (new code, shown once); `LOCKED` after 5 failed recovery attempts (same escalating policy as PIN, separate counter); success resets PIN and recovery counters |
| `GET /me` | session | → `{ profile, currentWeightKg, settings: SettingsVersion, energy: EnergyProfile }` |
| `PATCH /me` | session | partial profile/settings fields, `confirm?` → `{ profile, settings, energy, appliedFrom: "YYYY-MM-DD" }`; energy-relevant changes create a new settings version effective today and refresh today's day snapshot; past days are unchanged |
| `GET /me/settings-history` | session | → `[SettingsVersion]` (effective-dated) |

`EnergyProfile` = `{ formula, calcVersion, bmrKcal, activityMultiplier, baselineTdeeKcal,
adjustmentKcal, recommendedTargetKcal, activeTargetKcal, targetIsOverride, caution?:
"target_below_safety" | "adjustment_over_25pct", isEstimate: true }`.

`SettingsVersion` = `{ id, effectiveFrom, goalType, activityLevel, activityMultiplier,
calorieAdjustmentKcal, calorieTargetOverrideKcal, proteinTargetG, carbsTargetG, fatTargetG,
birthDate, sexForFormula, heightCm, bmrFormula, calcVersion }`.

## Foods

| Method & path | Body / Query → Response |
|---|---|
| `GET /foods?q=&category=&state=&branded=&limit=20` | → `{ items: [FoodSummary], suggestCustomFood: boolean }`, ranked: favorites/overrides first, whole-word before prefix-only matches, names starting with the first word, FTS rank, then source priority (R6.4). `suggestCustomFood` is true when a non-empty query has no verified result (FR-029) |
| `GET /foods/{id}/variants` | → `[FoodSummary]` other preparation-state variants of the same food (e.g. raw ↔ cooked) for one-tap switching (U4) |
| `GET /foods/mine` | → `[FoodSummary]` the profile's own (non-hidden) custom foods |
| `GET /foods/quick` | → `{ favorites: [FoodSummary], frequent: [FoodSummary], templates: [TemplateSummary] }` |
| `GET /foods/{id}` | → `FoodDetail` (current or override version, all nutrients per 100, source, sourceFoodId, sourceVersion, attribution) |
| `POST /foods` | custom food `{ nameEs, nameEn?, aliases?, category, preparationState, productForm?, preparationInstructions?, brand?, basis, kcal, proteinG, carbsG, fatG, fiberG?, sugarG?, sodiumMg?, densityGPerMl?, sourceNote? }` → `201 FoodDetail` |
| `PATCH /foods/{id}` | own custom foods only → new version |
| `DELETE /foods/{id}` | own custom foods only → soft-hide |
| `POST /foods/{id}/override` | nutrient fields → creates a `user_correction` version for this profile |
| `DELETE /foods/{id}/override` | → reverts to the catalog version for future entries |
| `PUT /foods/{id}/favorite` / `DELETE …/favorite` | → `204` |
| `GET /sources` | → data sources with attribution text |

`FoodSummary` = `{ id, nameEs, nameEn, category, preparationState, productForm, brand, basis, kcalPer100,
proteinPer100, carbsPer100, fatPer100, source, isFavorite, isCustom, hasOverride }`.

## Journal

| Method & path | Body / Query → Response |
|---|---|
| `GET /days/{date}` | → `DaySummary` (see below) |
| `POST /days/{date}/entries` | `{ occasion, label?, foodId, quantity, unit, eatenAt?, note?, confirm? }` → `201 { entry, day: DaySummary }` |
| `POST /days/{date}/entries/batch` | `{ occasion, label?, items: [MealItem] (1–30), confirm? }` → `201 { mealId, entries, day }`. All items are validated first; the meal is saved completely or not at all (FR-035a) |
| `PUT /meals/{mealId}` | `{ items: [{ entryId, quantity, unit } \| { entryId, portion } \| MealItem] (1–30), confirm? }` → `{ mealId, day }`. Saves the whole meal: kept entries keep their snapshot, new items are snapshotted now, omitted entries are deleted (FR-035a) |
| `PATCH /entries/{id}` | `{ quantity?, unit?, foodId?, portion?, occasion?, note?, eatenAt? }` → `{ entry, day }`. `portion` only for recipe entries, recomputed from the entry's own recipe version (FR-046) |
| `DELETE /entries/{id}` | → `{ day }` |
| `POST /meals/{mealId}/duplicate` | `{ toDate, toOccasion }` → `{ entries, day }` |
| `POST /templates` | `{ name, fromMealId }` or `{ name, items }` → `201 Template` |
| `GET /templates` / `GET /templates/{id}` / `DELETE /templates/{id}` | → `Template` = `{ id, name, items: [{ kind: 'food', foodId, quantity, unit, name } \| { kind: 'recipe', recipeId, portion, name }] }` |
| `POST /templates/{id}/apply` | `{ date, occasion }` → `{ entries, day }` |
| `PUT /days/{date}/flags` | `{ restDay?, markedComplete? }` → `{ day }` |

`DaySummary` = `{ date, status: "none" | "activity_only" | "food_partial" | "food_completed" |
"full_completed" | "rest_completed" | null (null until US6), foodCompleted, meals: [{ id, occasion, label, entries: [Entry],
totals: Nutrients }], activities: [ActivityEntry], totals: Nutrients, incompleteNutrients:
["fiber"|"sugar"|"sodium"], target: { activeKcal, proteinG?, carbsG?, fatG?, remainingKcal }
(remainingKcal = activeKcal − intake; negative means above target), estimates: { bmrKcal,
baselineTdeeKcal, activityNetKcal, expenditureKcal, balanceKcal, balanceLabel: "deficit" |
"surplus" | "maintenance", snapshot: { settingsVersionId, effectiveFrom, weightKg, calcVersion,
frozen: boolean }, isEstimate: true } (target and estimates come from the day energy snapshot;
`snapshot` is null for days without entries, which are computed on the fly), xpAwarded?:
[{ source, amount }] (present from US7) }`.

`Entry` includes `preparationState` copied from the food variant's snapshot (it is not a separate
input field), plus `kind: 'food' | 'recipe'`, `productForm`, `quantity`/`unit` (null for a recipe
portion whose yield is unknown), `per100` (null when unknown) and `recipe: { recipeId,
recipeVersionId, portion: { mode, servings, factor } } | null`.

`MealItem` = `{ foodId, quantity, unit }` | `{ recipeId, portion }`;
`Portion` = `{ mode: 'whole' }` | `{ mode: 'servings', servings }` | `{ mode: 'amount', quantity, unit }`.

## Preparations (recipes)

| Method & path | Body / Query → Response |
|---|---|
| `GET /recipes` | → `[RecipeView]` the profile's visible recipes (current versions) |
| `POST /recipes` | `RecipeInput` → `201 RecipeView` (version 1) |
| `GET /recipes/{id}?versionId=` | → `RecipeView` of the current version, or of `versionId` (also for hidden recipes, so logged meals stay explainable) |
| `PUT /recipes/{id}` | `RecipeInput` → `RecipeView` of a **new** version; previous versions and logged meals are untouched (FR-046) |
| `DELETE /recipes/{id}` | → `204` soft-hide |

`RecipeInput` = `{ name, notes?, servings?, yieldQuantity?, yieldUnit?, homogeneous?, ingredients:
[{ foodId, quantity, unit }] (1–30) }` (`yieldQuantity` and `yieldUnit` together or not at all).

`RecipeView` = `{ id, name, hidden, versionId, versionNo, isCurrentVersion, notes, servings,
yield: { quantity, unit } | null, homogeneous, approximate, ingredients: [{ foodId, foodVersionId,
name, brand, preparationState, productForm, source, quantity, unit, approximate, nutrients,
per100 }], totals: Nutrients, incompleteNutrients, perServing: Nutrients | null, per100OfYield:
(Nutrients & { unit }) | null, updatedAt }`.

Domain errors return `422 VALIDATION` with `reason` ∈ `invalid_reference`, `invalid_quantity`,
`no_ingredients`, `invalid_yield`, `invalid_servings`, `servings_unknown`, `yield_unknown`,
`unit_mismatch`, `portion_exceeds_total`, `not_homogeneous`.

`Nutrients` = `{ kcal, proteinG, carbsG, fatG, fiberG|null, sugarG|null, sodiumMg|null }`.

## Activity

| Method & path | Body → Response |
|---|---|
| `GET /activity-types` | → built-in and own custom types with MET values |
| `POST /activity-types` | `{ nameEs, metLight?, metModerate?, metVigorous? }` |
| `POST /days/{date}/activities` | `{ activityTypeId, durationMin, intensity?, estimateMethod: "met"|"manual"|"none", manualKcal?, note? }` → `201 { activity, day }` |
| `PATCH /activities/{id}` / `DELETE /activities/{id}` | → `{ day }` |

## Weight

| Method & path | Body → Response |
|---|---|
| `GET /weights?from=&to=` | → `{ records: [WeightRecord], trend: [{ date, trendKg }], latestKg, targetKg, toTargetKg, trendChange7dKg|null }` (trend omitted when fewer than 3 points) |
| `POST /weights` | `{ date, weightKg, note? }` → `201` |
| `PATCH /weights/{id}` / `DELETE /weights/{id}` | delete of the last remaining record → `CONFLICT` |

## Calendar, streaks, progress

| Method & path | → Response |
|---|---|
| `GET /calendar?month=YYYY-MM` | `{ days: [{ date, status (6 states, see DaySummary), frozen: bool, hasActivity: bool, rewardEligible: bool }], streak: { current, longest, totalRecordedDays, totalCompletedDays, freezesAvailable }, monthCompletionPct }` |
| `GET /streak` | `{ current, longest, freezesAvailable, totalCompletedDays }` (home badge) |
| `GET /progress?period=week|month&end=` | `{ daysWithData, daysInPeriod, avgIntakeKcal, avgExpenditureKcal, avgBalanceKcal, balanceLabel, intakeSeries: [{date, kcal|null}], weightTrend, isEstimate: true }` |

## Pet

| Method & path | → Response |
|---|---|
| `GET /pet` | `{ name, stage, xpTotal, nextStageXp, progressPct, mood, moodLabel, treats, message: { key, text } (goal-specific per FR-078), accessories: [{ id, unlocked, equipped }], recentMilestones: [{ id, unlockedAt, message: { key, text } }] }` |
| `PATCH /pet` | `{ name?, equippedAccessoryIds? }` |
| `POST /pet/feed` | → `{ pet }`; `CONFLICT(reason="no_treats")` if `treats = 0` |
