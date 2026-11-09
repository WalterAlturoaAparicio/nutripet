<!--
Sync Impact Report (2026-11-08, amendment)
==========================================
Version change: 1.0.0 → 1.1.0
Bump rationale: MINOR — Principle IV materially expanded: its rule on adapting to each goal is
split into "personalized presentation" and "equivalent reward mechanics" (resolves analysis
finding D1).
Modified principles: IV. Habit Formation Through Gamification (rules clarified, title unchanged)
Added/removed sections: none
Templates: no changes required (plan "Constitution Check" reads this file at runtime)
Deferred TODOs: none

Sync Impact Report (initial)
============================
Version change: (unversioned template) → 1.0.0
Bump rationale: Initial ratification. All template placeholders replaced with project-specific
governance content.

Modified principles (template placeholder → new title):
- [PRINCIPLE_1_NAME] → I. Accuracy and Data Integrity
- [PRINCIPLE_2_NAME] → II. Individual User Profiles
- [PRINCIPLE_3_NAME] → III. Transparency of Calculations
- [PRINCIPLE_4_NAME] → IV. Habit Formation Through Gamification
- [PRINCIPLE_5_NAME] → V. Usability
- (new)              → VI. Privacy and Security

Added sections:
- Project Vision
- Nutritional Data Sources (replaces [SECTION_2_NAME])
- Technical and Architectural Standards (replaces [SECTION_3_NAME])
- Product Scope and Philosophy
- Definition of Done
- Governance (filled)

Removed sections: none

Templates reviewed (not modified by this command; they read the constitution at runtime):
- .specify/templates/plan-template.md      ✅ "Constitution Check" gate reads this file
- .specify/templates/spec-template.md      ✅ no change required
- .specify/templates/tasks-template.md     ✅ no change required
- .specify/templates/checklist-template.md ✅ no change required

Deferred TODOs: none
-->

# NutriPet Constitution

## Project Vision

NutriPet is a personal nutrition and activity tracking application that helps individuals
understand their daily energy balance, monitor their nutritional habits, and work toward their
individual weight goals.

The application supports multiple independent user profiles, so people with different physical
characteristics, nutritional requirements, and goals can use the same platform.

The central concept combines nutritional tracking, personal progress visualization, and
gamification (a virtual pet) to encourage consistent daily engagement. The product MUST feel like
a lightweight personal nutrition companion, not a medical application or a complicated
calorie-counting platform.

## Core Principles

### I. Accuracy and Data Integrity

- Nutritional information MUST come from identifiable, trustworthy food composition databases.
- Every food entry MUST retain its nutritional source and relevant serving information.
- Raw, cooked, prepared, and packaged forms of a food MUST be distinguished whenever their
  nutritional values differ.
- Nutritional values MUST NOT be fabricated; estimates MUST NOT be presented as exact
  measurements.
- All calculations MUST use consistent units: grams (g), milliliters (ml), and kilocalories (kcal).
- Users MUST be able to correct nutritional information when necessary.
- Historical records MUST NOT silently change when the underlying food database is updated; logged
  entries snapshot (or version-reference) the nutritional values in effect at logging time.

Rationale: tracking is only useful if the numbers are trustworthy and reproducible over time.

### II. Individual User Profiles

- Every user MUST have an independent nutritional profile.
- Each profile MUST own its anthropometric data, nutritional targets, activity records, weight
  history, calendar, achievements, and gamification progression.
- One user's objectives MUST NEVER affect another user's calculations.
- Shared infrastructure MUST NOT imply shared nutritional goals.
- Adding additional profiles MUST NOT require architectural changes.

Rationale: users differ in body, needs, and goals; mixing their data produces wrong guidance.

### III. Transparency of Calculations

- The system MUST clearly distinguish basal metabolic rate (BMR), estimated total daily energy
  expenditure (TDEE), food intake, exercise expenditure, and estimated energy balance.
- Every formula used for nutritional and energy calculations MUST be documented.
- Users MUST be able to see how their daily calorie targets are derived.
- Physical activity expenditure MUST be labeled and treated as an estimate.
- Exercise MUST NOT be double-counted (e.g., once in an activity multiplier and again as logged
  exercise) when computing total energy expenditure.
- Estimated calorie deficits or surpluses MUST NOT be presented as guaranteed changes in body
  weight.

Rationale: users make decisions from these numbers; they must understand their nature and limits.

### IV. Habit Formation Through Gamification

- Gamification MUST reward consistency, never excessive calorie restriction or consumption.
- The virtual pet MUST have a meaningful progression system.
- Pet evolution MUST primarily depend on consistency, completed logs, and healthy tracking habits.
- Missing a day MUST NOT cause disproportionate punishment (e.g., total loss of progress).
- Streaks, achievements, milestones, and calendar indicators MUST follow transparent,
  user-understandable rules.
- Gamification **presentation** (messages, milestone texts, tips) MUST adapt to each profile's
  nutritional objective (loss, maintenance, gain), without praising eating more or less.
- Gamification **reward mechanics** (XP, treats, streak freezes, milestones, thresholds,
  accessories) MUST be equivalent across objectives: identical tracking behavior MUST produce
  identical rewards, regardless of goal, calories consumed, or target attainment.

Rationale: the game exists to sustain tracking habits, not to push unhealthy behavior; a fair
reward economy keeps profiles with opposite goals on equal footing.

### V. Usability

- Recording a meal MUST require as few interactions as reasonably possible.
- Fast food search, portion selection, and gram-based entry are first-class priorities.
- The interface MUST be responsive and comfortable on mobile devices.
- Common actions MUST be reachable without navigating through multiple screens.
- Users MUST be able to save frequently consumed foods and meals for quick reuse.

Rationale: friction is the main reason people abandon nutrition tracking.

### VI. Privacy and Security

- Personal nutritional information MUST be isolated by user profile.
- Appropriate authentication and authorization MUST protect every profile-scoped resource.
- All user inputs MUST be validated on the backend, regardless of client-side validation.
- Personal information MUST NOT be exposed between profiles without explicit authorization.
- The system MUST NOT collect information that is not necessary for its functionality.

Rationale: health-related personal data is sensitive and deserves strict isolation.

## Nutritional Data Sources

The application MUST prioritize established nutritional databases. Preferred sources, in order of
investigation:

1. USDA FoodData Central.
2. Colombian food composition databases, particularly the Tabla de Composición de Alimentos
   Colombianos (ICBF).
3. Open Food Facts for packaged and branded products.
4. Other reputable nutritional databases when a specific food is unavailable.

Each food record MUST support:

- Food name, alternative names, and search terms.
- Category.
- Nutritional values per 100 g or per 100 ml.
- Calories (kcal), protein (g), carbohydrates (g), total fat (g).
- Fiber (g), sugar (g), and sodium (mg) when available (absent values stored as unknown, not zero).
- Food preparation state (raw, cooked, prepared, packaged).
- Data source and source identifier.
- Last update or version information.

Database imports MUST respect each source's licensing, attribution requirements, API limitations,
and terms of use. Import processes MUST be documented and reproducible.

## Technical and Architectural Standards

- Architecture MUST be modular, maintainable, and testable.
- Nutritional and energy calculations MUST be separated from presentation; domain logic MUST NOT
  depend on UI components.
- Unnecessary abstractions and premature optimization MUST be avoided; added complexity requires
  justification in the plan.
- Code MUST use explicit types and explicit input validation.
- Nutritional calculations and energy-balance logic MUST have automated tests.
- Historical nutritional data MUST be preserved when food records are updated.
- The data model MUST support multiple users and future expansion.
- Documented APIs and reproducible data-import processes are preferred over ad-hoc integrations.

## Product Scope and Philosophy

The initial product (MVP) prioritizes, in order:

1. User profiles.
2. Nutritional configuration and individual goals.
3. Food database and search.
4. Meal and portion registration.
5. Daily nutritional summaries.
6. Physical activity registration.
7. Estimated energy balance.
8. Weight history.
9. Calendar and daily logging status.
10. Streaks, achievements, and virtual pet progression.

Barcode scanning, advanced recommendations, wearable integration, and AI-based food recognition
are out of MVP scope and MUST NOT compromise its delivery.

The application MUST make tracking sustainable. It MUST NOT encourage users to force themselves
to eat, starve themselves, or pursue extreme weight changes to satisfy a game mechanic. The
primary success metric is consistent, useful tracking over time, supported by understandable
nutritional information and realistic individual goals.

## Definition of Done

A feature is complete only when:

- Its behavior is documented.
- Its domain logic is implemented and tested.
- Its data persistence is correct.
- Its validation and error handling are implemented.
- Its interface supports the intended user workflow.
- It does not break existing functionality.
- Its acceptance criteria are demonstrably satisfied.

## Governance

- This constitution supersedes other project practices. Every spec, plan, and task list MUST be
  checked against it (the plan's "Constitution Check" gate).
- Any deviation from a principle MUST be explicitly justified in the relevant plan's complexity
  tracking, or the plan MUST be revised.
- Amendments are made by updating this file with a Sync Impact Report, a version bump, and a
  review of dependent templates for consistency.
- Versioning follows semantic versioning:
  - MAJOR: backward-incompatible removal or redefinition of a principle or governance rule.
  - MINOR: a new principle or section, or materially expanded guidance.
  - PATCH: clarifications, wording, and typo fixes with no semantic change.
- Compliance is reviewed at each feature's planning stage and again before the feature is
  considered done.

**Version**: 1.1.0 | **Ratified**: 2026-11-08 | **Last Amended**: 2026-11-08
