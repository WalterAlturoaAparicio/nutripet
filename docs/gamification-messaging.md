# Gamification messaging guidelines (FR-078, Constitution IV)

NutriPet adapts **what the cat says** to each profile's goal. It never adapts **what the cat gives**.

## The equivalence rule

- XP, treats, streak freezes, milestones, stage thresholds and accessories are identical for every
  goal. Identical tracking behavior must produce identical rewards, regardless of goal, calories
  eaten or whether a calorie target was reached.
- Code enforces it:
  - Reward functions in `src/domain/gamification/index.ts` take no goal parameter.
  - Only `messageKey(event, goal)` in `src/domain/gamification/messages.ts` reads the goal.
- Tests enforce it:
  - `tests/unit/domain/gamification.property.test.ts` simulates random timelines for two goals with
    different calorie values and requires identical rewards.
  - `tests/integration/pet.test.ts` checks the same through the API.

## Tone per goal

| Goal | Focus | Example |
|---|---|---|
| Weight gain (`gain`) | Sustainable progress, regular meals, building step by step | "Registrar tus comidas con regularidad es la base de un progreso sostenible." |
| Weight loss (`loss`) | Steady habits, consistency, one day at a time | "Registrar con constancia te ayuda a conocer tus hábitos." |
| Maintenance (`maintenance`) | Balance, keeping established habits | "Mantener tus registros es mantener tu equilibrio." |

All messages are warm, short, in Spanish (es-CO), and celebrate **tracking consistency**, never body
changes or intake.

## Forbidden

A message must never:

- praise eating more or eating less ("come más", "come menos", "comer más/menos");
- mention skipping meals, fasting or compensating ("saltar", "ayuno", "compensar");
- mention calories, kcal or any calorie number;
- promise or celebrate a weight change, or tie a reward to the scale;
- shame or punish ("fallaste", "perdiste"). Missed days get a gentle "te extrañé".

`tests/unit/domain/gamification-messages.test.ts` scans every message for these patterns (and for
numbers with 3+ digits, so a "100" streak is written "cien").

## Coverage requirement

Every event in `MESSAGE_EVENTS` must have a text for all three goals under
`pet.msg.<goal>.<event>` in `src/i18n/es.ts`. The test fails if any key is missing.

Events:
- `welcome`, `daily`
- `food_day_completed`, `activity_logged`, `weight_recorded`
- `streak_7` … `streak_100`, `first_full_week`
- `stage_young` … `stage_special`
- `missed_you`, `feed`

## Review checklist (before release)

- [ ] Every event has three goal variants, and `pnpm test` passes (coverage and forbidden-phrase tests).
- [ ] Each text is about consistency or habits, not about food quantity, calories or weight.
- [ ] The gain and loss versions would both feel respectful to someone with the opposite goal reading over their shoulder.
- [ ] No reward amount, threshold or unlock condition mentions the goal.
- [ ] Missed-day texts are gentle and never mention lost progress (progress is never lost: XP and stage never decrease for missed days).
