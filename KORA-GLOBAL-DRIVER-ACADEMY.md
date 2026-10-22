# KORA Global Driver Academy

## Purpose
A jurisdiction-aware learner-driver preparation platform inside KORA. KORA provides learning and practice; it does not represent itself as the official licensing authority or official examination unless an authority integration is explicitly established.

## User flow
1. Select country.
2. Select region/state/province where applicable.
3. Select licence category.
4. Select learning mode: Learn, Practice, Weak Areas, Mock Exam.
5. Complete adaptive sessions.
6. Review explanations and progress.
7. Prepare for the applicable official test.
8. After licensing, connect the learner profile to KORA Driver and KORA NAV.

## Core data model
- jurisdiction: country, region, authority, source URLs, source version/date
- licence_category: code/category, vehicle class, eligibility notes
- topic: road rules, signs, vehicle controls, hazards, safe driving, local law
- question: prompt, options, correct answer, explanation, topic, difficulty, source reference
- hazard_scenario: scene, hazard, response, explanation, jurisdiction applicability
- exam_profile: question count, duration, pass threshold, sections, scoring rules
- learner_progress: attempts, accuracy, weak topics, streaks, readiness score

## Global architecture
KORA should support country-specific rules without pretending that one universal learner test exists. Each jurisdiction is independently versioned so rules can be updated without rewriting the product.

## Initial market sequence
- South Africa: Code 1, Code 2, Code 3
- United Kingdom: car/motorcycle and other applicable theory categories
- Ireland: relevant RSA theory categories
- Australia: state/territory-specific learner preparation
- New Zealand
- United States: state-specific permit preparation
- Canada: province/territory-specific preparation
- Then expand through Africa, Europe, Middle East, Asia, Latin America and other jurisdictions.

## Safety and compliance rules
- Never label KORA practice questions as official exam questions unless licensed or expressly published for reuse by the relevant authority.
- Display the jurisdiction and source/version for rules-sensitive content.
- Flag stale content for review when an authority changes its rules.
- Keep official-test claims separate from KORA-generated practice.
- Do not guarantee that passing KORA practice guarantees an official test pass.

## Product connection
KORA Global Driver Academy -> KORA Driver -> KORA NAV -> KORA Safety -> KORA Fleet.

## Commercial model
Free starter practice; paid jurisdiction packs; premium mock exams; school/driving-school plans; fleet training; multilingual content; B2B/API licensing where permitted.
