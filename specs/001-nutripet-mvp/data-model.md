# Data Model: NutriPet MVP

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md) | **Date**: 2026-11-08

Storage is SQLite (see R2). All quantities are metric: g, ml, kg, cm, kcal, mg. All `id` columns
are text ULIDs. `created_at` and `updated_at` are UTC ISO timestamps. `local_date` is a
`YYYY-MM-DD` date in the profile's time zone. **Every personal table has a non-null `profile_id`
FK**, and every query on it filters by the session's profile (FR-005).

## Entity overview

```text
device (enrolled, not profile-owned) ─* pairing_code (issued by a profile session)
profile 1─┬─* weight_record
          ├─* profile_settings_version (effective-dated)
          ├─* day_energy_snapshot *─1 profile_settings_version
          ├─* session / pin + recovery attempt state
          ├─* meal ─* meal_entry *─1 food_version *─1 food *─1 data_source
          │              meal_entry *─1 recipe_version (kind = recipe)
          ├─* meal_template ─* meal_template_item *─1 food | recipe
          ├─* recipe ─* recipe_version ─* recipe_ingredient *─1 food_version
          ├─* food (custom, owner_profile_id)      food ─* food_alias
          ├─* food_override *─1 food               food ─* food_version
          ├─* food_favorite *─1 food               import_run *─1 data_source
          ├─* activity_entry *─1 activity_type (built-in or custom)
          ├─* day_log (rest-day flag, manual "day complete")
          ├─1 pet ─* pet_accessory_unlock           (US7)
          ├─* treat_event                           (US7)
          ├─* xp_event
          └─* milestone_unlock
```

---

## Profiles and access

### profile
| Field | Type | Rules |
|---|---|---|
| id | text PK | |
| name | text | 1–40 chars, unique (case-insensitive) |
| target_weight_kg | real | 30–300 (not energy-relevant; editable in place) |
| weight_unit | enum `kg`/`lb` | display/input only (FR-007) |
| height_unit | enum `cm`/`ft_in` | display/input only |
| food_unit | enum `metric`/`imperial` | g/ml or oz/fl oz display/input; storage is always g/ml |
| time_zone | text | IANA zone, default `America/Bogota`; changes affect new records only |
| pin_hash | text | argon2id; PIN of 4–6 digits |
| recovery_code_hash | text | argon2id |
| failed_pin_attempts | int | reset on successful login or recovery |
| locked_until | timestamp null | PIN lockout (R3) |
| failed_recovery_attempts | int | same policy as PIN (U1); reset on successful recovery |
| recovery_locked_until | timestamp null | recovery lockout |
| created_at / updated_at | timestamp | |

Current weight is not stored on `profile`: it is the latest `weight_record`. Energy-relevant
settings live in `profile_settings_version`; the "current settings" are the latest version.
A profile cannot be created without its first weight record and first settings version
(FR-002, FR-019), so all three are written in one transaction.

### profile_settings_version (immutable, effective-dated, FR-019)
| Field | Type | Rules |
|---|---|---|
| id, profile_id | | |
| effective_from | date | local date of the change (creation date for v1); never in the future |
| created_at | timestamp | latest row for the same `effective_from` wins |
| birth_date | date | age 14–100 on creation |
| sex_for_formula | enum `male`/`female`/`unspecified` | `unspecified` → constant −78 (R8) |
| height_cm | real | 100–250 |
| goal_type | enum `gain`/`loss`/`maintenance` | |
| activity_level | enum `sedentary`/`light`/`moderate`/`high`/`very_high` | |
| activity_multiplier | real | copied from config at creation (1.2…1.9) |
| bmr_formula | enum `mifflin_st_jeor`/`harris_benedict_revised` | default `mifflin_st_jeor` |
| calorie_adjustment_kcal | int | −1500..+1500; sign matches goal (gain ≥ 0, loss ≤ 0, maintenance = 0) |
| calorie_target_override_kcal | int null | 800–6000; null → use recommended |
| protein_target_g / carbs_target_g / fat_target_g | real null | 0–1000 |
| calc_version | int | `CALC_VERSION` from `src/domain/config.ts` |

Resolution: `effectiveSettings(date)` = the row with the greatest `effective_from ≤ date` (ties: the
latest `created_at`); dates before v1 resolve to v1.

### day_energy_snapshot (FR-019)
| Field | Type | Rules |
|---|---|---|
| profile_id, local_date | PK | |
| settings_version_id | FK | version resolved for that date |
| weight_kg, weight_record_id | real, FK | latest record ≤ date, else the earliest record |
| age, bmr_kcal, activity_multiplier, baseline_tdee_kcal | | |
| adjustment_kcal, recommended_target_kcal, active_target_kcal, target_is_override | | |
| protein_target_g / carbs_target_g / fat_target_g | real null | |
| bmr_formula, calc_version | | |
| created_at, refreshed_at | timestamp | `refreshed_at` is set only when today's snapshot is refreshed after a settings change |

Created on the day's first food or activity entry (including backfill). Past snapshots are never
modified. Today's snapshot is refreshed after a settings change made today. Days with no
snapshot (no entries) show estimates computed on the fly from `effectiveSettings(date)`, and these
are not persisted.

### device (FR-008)
| Field | Type | Rules |
|---|---|---|
| id | text PK | |
| token_hash | text | SHA-256 of the `np_device` cookie token (256-bit) |
| label | text | e.g., "Teléfono de A" |
| enrolled_via | enum `initial_setup`/`setup_token`/`pairing_code` | |
| enrolled_by_profile_id | FK null | for pairing codes |
| created_at, last_seen_at, expires_at, revoked_at | timestamp | 180-day expiry |

### pairing_code
`code_hash` (PK, argon2id of the 8-character code), `issued_by_profile_id`, `expires_at` (10 min),
`used_at`. Single use.

Rate limiting for setup token and pairing code (5 failures per IP → 15 min) is held in memory
(single instance) and not persisted.

### session
| Field | Type | Rules |
|---|---|---|
| token_hash | text PK | SHA-256 of the 256-bit random token |
| profile_id | FK profile | |
| last_seen_at | timestamp | expires 15 min after last use |
| created_at | timestamp | |

### weight_record
| Field | Type | Rules |
|---|---|---|
| id, profile_id | | |
| local_date | date | not in the future |
| weight_kg | real | 20–350 |
| note | text null | ≤ 280 chars |

Several records on one date are allowed. The latest `created_at` is used for that day's
calculations. Deleting the last remaining record is rejected (a weight is required for BMR).

---

## Food catalog

### data_source
`id` (`usda_fdc`, `usda_fndds`, `tcac`, `off`, `user`, `user_correction`), `name`, `license`,
`attribution_text`, `url`. Seeded rows. The attribution text is shown on the Food Database screen
(FR-028).

### import_run
`id`, `data_source_id`, `source_version` (dataset release or snapshot date), `input_checksum`
(sha256 of the input file), `started_at`, `finished_at`, `status` (`ok`/`failed`), counts:
`created`, `updated`, `unchanged`, `skipped`, `report_path`.

### food (stable identity)
| Field | Type | Rules |
|---|---|---|
| id | text PK | |
| data_source_id | FK | |
| source_food_id | text null | unique with `data_source_id` → idempotent import |
| owner_profile_id | FK profile null | non-null only for custom foods; visible only to the owner |
| name_es | text | required |
| name_en | text null | |
| category | enum | `cereales`, `carnes`, `pescados`, `huevos`, `lacteos`, `leguminosas`, `tuberculos_platanos`, `frutas`, `verduras`, `grasas`, `azucares`, `bebidas`, `preparaciones`, `empacados`, `otros` |
| preparation_state | enum `raw`/`cooked`/`prepared`/`packaged` | belongs to the variant: "Arroz blanco, crudo" and "Arroz blanco, cocido" are two foods (U4) |
| brand | text null | branded products |
| product_form | enum `as_sold`/`dry_mix`/`concentrate` | default `as_sold`. Values of `dry_mix`/`concentrate` describe the product **before** preparation (e.g. lemonade powder per 100 g of powder), never the prepared drink (FR-048) |
| preparation_instructions | text null | ≤ 300, e.g. "1 sobre (20 g) en 1 litro de agua" |
| current_version_id | FK food_version | |
| hidden_at | timestamp null | soft delete; hidden from search |

### food_alias
`food_id`, `alias`, `lang` (`es`/`en`). Indexed together with the names in the FTS5 virtual table
`food_search(name_es, name_en, aliases, brand)` using the tokenizer
`unicode61 remove_diacritics 2` (FR-022).

### food_version (immutable)
| Field | Type | Rules |
|---|---|---|
| id | text PK | |
| food_id | FK | |
| version_no | int | increments per food |
| basis | enum `g`/`ml` | values are per 100 of the basis |
| kcal | real | 0–900 |
| protein_g / carbs_g / fat_g | real | ≥ 0; protein + carbs + fat ≤ 100 for `g` |
| fiber_g / sugar_g | real null | null = unknown (FR-021); sugar ≤ carbs + max(0.5 g, 10%) |
| sodium_mg | real null | 0–40000 |
| density_g_per_ml | real null | 0.3–2.0 |
| source_version | text | |
| import_run_id | FK null | null for user-created |
| created_at | timestamp | |

Rows are never updated. A changed input produces a new version, and `food.current_version_id`
moves to it.

### food_override
`id`, `profile_id`, `food_id`, `food_version_id` (FK to a version row the profile owns, created
with `data_source_id = user_correction`), `created_at`. Search and logging for that profile use
the override version. Other profiles keep using the catalog version (FR-026).

### food_favorite
`profile_id`, `food_id`, PK (profile_id, food_id).

**Frequent foods** are derived, not stored: the `meal_entry` count per food over the last 30 days
for the profile.

---

## Meal journal

### meal
| Field | Type | Rules |
|---|---|---|
| id, profile_id | | |
| local_date | date | not in the future |
| occasion | enum `breakfast`/`morning_snack`/`lunch`/`afternoon_snack`/`dinner`/`extra` | |
| label | text null | required when `extra` (e.g., "Cena tarde") |

Unique (profile_id, local_date, occasion) except `extra`, which allows several.

### meal_entry
| Field | Type | Rules |
|---|---|---|
| id, profile_id, meal_id | | meal.profile_id must equal profile_id |
| kind | enum `food`/`recipe` | default `food` (FR-035a, FR-045) |
| food_id / food_version_id | FK null | set for `food`: version used at logging time; the variant fixes the preparation state |
| recipe_id / recipe_version_id | FK null | set for `recipe`: the exact recipe version used (FR-046) |
| portion_mode | enum `whole`/`servings`/`amount` null | `recipe` only |
| portion_servings | real null | `servings` mode |
| portion_factor | real null | fraction of the complete preparation consumed, 0 < f ≤ 1 |
| snap_preparation_state | enum | copy of the food's preparation state at logging time (`prepared` for recipes) |
| snap_product_form | enum | copy of the food's product form |
| quantity | real null | > 0 and ≤ 5000; > 2000 requires a confirm flag. Always set for `food`; for `recipe` = consumed amount when known (amount mode, or factor × yield) |
| unit | enum `g`/`ml` null | |
| approximate | bool | true if a g↔ml conversion assumed 1 g/ml (R9) |
| eaten_at | timestamp | default now |
| note | text null | ≤ 280 |
| snap_basis, snap_kcal_per100, snap_protein_per100, … | real null | `food`: copy of the version values used (always set). `recipe`: values per 100 of the final yield, null when no yield was entered |
| kcal, protein_g, carbs_g, fat_g | real | computed amounts at full precision |
| fiber_g, sugar_g, sodium_mg | real null | null if the source value is unknown |

**Snapshot rule** (FR-033, FR-046): the snapshot fields are written at creation. Editing `quantity`
recomputes the amounts from the **snapshot**, not from the current catalog. Changing the food
re-snapshots from the newly chosen food's current version. Editing a recipe entry's portion
recomputes from its own `recipe_version` (never the recipe's current version):
`nutrients = recipe_version totals × portion_factor`.

Migration `0009_recipes` rebuilds `meal_entry` and `meal_template_item`; existing rows are copied
with `kind = 'food'` and identical values (covered by `tests/integration/migration-recipes.test.ts`).

### meal_template / meal_template_item
`meal_template(id, profile_id, name, created_at)`;
`meal_template_item(template_id, food_id null, recipe_id null, portion_mode null,
portion_servings null, quantity null, unit null, position)`: either a food with quantity/unit or a
recipe portion (FR-035b). Templates store combinations, not nutrient values. Applying a template
creates normal `meal_entry` rows snapshotted from each food's **current** version (or the
profile's override) and each recipe's **current** version.

---

## Preparations (recipes)

### recipe (stable identity)
| Field | Type | Rules |
|---|---|---|
| id, profile_id | | owned by one profile; another profile's recipe → 404 |
| name | text | 1–60 |
| current_version_id | FK recipe_version | |
| hidden_at | timestamp null | soft delete; versions stay readable for history |

### recipe_version (immutable, FR-046)
| Field | Type | Rules |
|---|---|---|
| id, recipe_id, version_no | | unique (recipe_id, version_no); a new row on every save |
| notes | text null | ≤ 500, instructions |
| servings | real null | > 0, ≤ 100 |
| yield_quantity / yield_unit | real null / `g`/`ml` null | both or neither; the actual final mass/volume entered by the user, never the ingredient sum (FR-045) |
| homogeneous | bool | required for portions by amount |
| approximate | bool | an ingredient needed g↔ml without density |
| kcal, protein_g, carbs_g, fat_g, fiber_g?, sugar_g?, sodium_mg? | real | totals of the complete preparation = Σ ingredient contributions (FR-039) |

### recipe_ingredient
| Field | Type | Rules |
|---|---|---|
| recipe_version_id, position | | |
| food_id / food_version_id | FK | effective version (incl. the profile's override) at save time |
| quantity, unit | real `g`/`ml` | > 0, ≤ 5000 |
| snap_name, snap_brand, snap_preparation_state, snap_product_form, snap_data_source_id, snap_source_version | | copy of the food at save time |
| snap_basis, snap_density_g_per_ml, snap_*_per100 | | copy of the values per 100 used |
| kcal … sodium_mg, approximate | | the ingredient's contribution |

Reference records: data source `reference` holds physically established values maintained by the
app (seeded idempotently by (source, source_food_id)). Currently one record, **Agua** (basis ml,
density 1, 0 kcal/protein/carbs/fat/fiber/sugar, sodium unknown) (FR-047).

---

## Activity

### activity_type
`id`, `owner_profile_id` (null = built-in), `name_es`, `met_light`, `met_moderate`, `met_vigorous`
(real null), `compendium_code` (text null). Built-ins are seeded (R8). Custom types may have no
MET.

### activity_entry
| Field | Type | Rules |
|---|---|---|
| id, profile_id, activity_type_id | | |
| local_date | date | not in the future |
| duration_min | int | 1–600 |
| intensity | enum `light`/`moderate`/`vigorous` null | |
| estimate_method | enum `met`/`manual`/`none` | |
| met_used | real null | snapshot of the MET applied |
| weight_kg_used | real null | weight from the day's `day_energy_snapshot` |
| net_kcal | real | `met`: (MET − 1) × kg × h; `manual`: user value 0–3000; `none`: 0 |
| note | text null | |

---

## Days, streaks, gamification

### day_log
`profile_id`, `local_date`, `rest_day` bool, `marked_complete` bool, `first_completed_at`
timestamp null. PK (profile_id, local_date). A row is created on demand. `first_completed_at` is
set when the day enters a completed state and cleared if it leaves it. Re-completing sets it
again with the new time, so toggling outside the window never creates eligibility.

**Derived day status** (computed by the domain from day_log, meal and activity_entry; not stored):

```text
food_completed = (distinct occasions with ≥1 entry ≥ 3) OR (marked_complete AND food entries ≥ 1)
status =
  none                if food entries = 0 and activities = 0
  activity_only       if food entries = 0 and activities ≥ 1          (rest_day ignored)
  food_partial        if food entries ≥ 1 and not food_completed     (activity marker if activities ≥ 1)
  full_completed      if food_completed and activities ≥ 1
  rest_completed      if food_completed and activities = 0 and rest_day
  food_completed      if food_completed and activities = 0 and not rest_day
completed  ⇔ status ∈ {food_completed, full_completed, rest_completed}
recorded   ⇔ status ≠ none
reward_eligible ⇔ completed and localDate(first_completed_at) ≤ local_date + BACKFILL_WINDOW_DAYS (2)
```
Weight records do not affect the status.

### streak (derived; cached in `streak_cache`)
`streak_cache(profile_id PK, current, longest, total_recorded_days, total_completed_days,
eligible_completed_days, freezes_available, computed_through_date)`. Recomputed from day statuses
whenever a day at or before `computed_through_date` changes.

Algorithm (walk the dates from the first recorded date to yesterday, then today):
- **completed** → `current += 1`, `longest = max(longest, current)`. If the day is
  reward-eligible, then `eligible_completed_days += 1`, and every time that count reaches a
  multiple of 7, `freezes = min(2, freezes + 1)`. The count is cumulative and does not have to be
  consecutive.
- **not completed** (missed) → if `current > 0` and `freezes > 0`: `freezes -= 1` and the day is
  marked frozen (the streak continues without incrementing). Otherwise `current = 0`.
  `freezes` never goes below 0, and at most one freeze is used per missed day.
- **today** not completed yet: neither breaks the streak nor consumes a freeze.
- Monthly % = completed days ÷ elapsed days of the month (today counts only once completed).

### pet
| Field | Type | Rules |
|---|---|---|
| profile_id | PK/FK | exactly one per profile; created by the US7 profile-creation hook; a backfill migration creates pets for profiles that existed before US7 (I4) |
| name | text | 1–24 chars, default "Michi" |
| xp_total | int | sum of non-revoked xp_events; never decreases because of missed days, target outcomes or progression; decreases only when XP of deleted records (or of a day that stopped being completed) is revoked (FR-071, FR-074) |
| stage | enum `newborn`/`young`/`adolescent`/`adult`/`special` | derived from `max_xp_reached`; never decreases |
| max_xp_reached | int | monotonic |
| mood | int | 30–100 (R10 floor) |
| mood_updated_date | date | for applying missed-day decay lazily |
| treats | int | ≥ 0 |
| equipped_accessory_ids | text JSON | |

### xp_event
`id`, `profile_id`, `source`
(`food_entry`/`food_day`/`activity`/`activity_bonus`/`weight`/`streak`/`milestone`),
`source_record_id` (the entry id, or `day:<date>` for day-level sources), `logged_date`, `amount`,
`created_at`, `revoked_at` null. Unique (profile_id, source, source_record_id). The daily cap is
enforced per (profile, source, logged_date) when the event is awarded. `food_day`,
`activity_bonus` and `streak` events are re-evaluated when the day status changes, and revoked if
the day stops being completed.

### treat_event
`id`, `profile_id`, `logged_date`, `kind` (`food_day`/`milestone`), `source_record_id`,
`amount`, `revoked_at` null. Unique (profile_id, kind, source_record_id). There is at most one
`food_day` treat per date. On revocation, `pet.treats = max(0, treats − amount)`: a treat already
fed is not taken back.

### milestone / milestone_unlock / accessory / pet_accessory_unlock
`milestone(id, kind, threshold, xp_reward, treat_reward, accessory_id null)` is seeded config.
`milestone_unlock(profile_id, milestone_id, unlocked_at)` and
`pet_accessory_unlock(profile_id, accessory_id, unlocked_at)` are per-profile. Unlocks are never
removed.

---

## State transitions

- **Pet stage**: newborn → young (300) → adolescent (1,200) → adult (3,000) → special (5,500),
  forward only (based on `max_xp_reached`).
- **Day status**: any of the 6 states can change into another as records are added or deleted.
  `first_completed_at` follows entering and leaving a completed state.
- **Settings version**: append-only; current = latest. Day snapshot: created → (today only)
  refreshed → frozen once the date is in the past.
- **Device**: enrolled → revoked/expired. **Pairing code**: issued → used/expired.
- **Profile creation**: open while zero profiles exist → protected (session or SETUP_TOKEN).
- **Mood**: −10 per fully missed day (floor 30), +10 on logging (cap 100), +15 per treat fed.
- **Food version**: draft (in import) → current → superseded (still referenced). Never deleted.
- **Session**: active → expired (inactivity / switch / logout).
- **Profile lock**: open → locked (5 failures) → open (after `locked_until`); the same applies
  independently to recovery (`recovery_locked_until`).

## Validation summary (server-side, Zod)

All bounds above are enforced in shared Zod schemas used by every route and action
(`src/server/validation/journal.ts`, `src/server/validation/recipes.ts`). Domain calculation
errors (`NutritionError`: invalid reference, zero quantity, unknown yield/servings, unit mismatch,
portion larger than the preparation, amount on a non-homogeneous preparation) are returned as
`VALIDATION` with `reason` = the error code. Future
`local_date` values are rejected for meals, entries, activities and weights. `profile_id` always
comes from the session. A record whose `profile_id` differs from the session's returns 404 (not
403), so the API does not reveal that the record exists.
