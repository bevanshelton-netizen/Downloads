# KORA SPORT

KORA SPORT is the live sports intelligence layer for KORA ONE.

## Architecture

`SPORT DATA → KORA SPORT → KORA TV / RADIO / NAV / AI`

KORA SPORT owns normalized sports entities, event state, scoring logic, standings metadata and presentation rules. External sports-data providers are adapters, not the product itself.

## Core capabilities

- Sports, leagues and competitions
- Teams and athletes
- Fixtures and live events
- Scores and game state
- Standings and rankings
- Match timelines
- Commentary metadata
- Safe audio summaries for driving
- TV/radio presentation feeds
- KORA AI sports queries

## Safety

Driver-facing sports information is designed for audio-first, low-distraction delivery. KORA NAV should prioritize road safety over sports interaction and suppress non-essential interaction while driving.

## Data integrity

Live scores must carry an explicit freshness/state indicator. KORA must not present stale or unverified event data as live.
