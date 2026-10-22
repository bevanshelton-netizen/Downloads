# KORA LEARN

KORA LEARN is the education and readiness layer of KORA.

## Architecture

`JURISDICTION → RULES → SIGNS → HAZARDS → PRACTICE → MOCK EXAM → READINESS → KORA NAV`

The learner-driver academy is jurisdiction-aware: country, region/state/province, licence category, and local rules are explicit data rather than hard-coded assumptions.

## Core capabilities

- Jurisdiction-specific learner-driver knowledge
- Road signs, rules, hazards and defensive-driving content
- Practice questions and explanations
- Timed mock examinations
- Scoring and readiness assessment
- Weak-area detection and progress tracking
- Multilingual content support
- Links from learning/readiness into KORA NAV safety workflows

## Official-test boundary

KORA LEARN provides preparation, practice and mock examinations. It does **not** represent a KORA mock exam as an official government licensing examination. Official tests remain controlled by the relevant licensing authority.

## Design principles

1. Safety before test-passing shortcuts.
2. Jurisdiction-specific rules must be versioned and attributable to sources.
3. Unverified questions must not enter production exam pools.
4. Content changes must be auditable.
5. KORA owns the learner experience and readiness logic while authoritative external sources remain attributable.
