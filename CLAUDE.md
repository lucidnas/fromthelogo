@AGENTS.md

## Clip-First Formula

For Caitlin Clark or other player-hype analysis videos, use the `ftl-clip-first-celebration` skill and the repo runner `tools/ftl-clip-first-formula.mjs`. The selected-play manifest is the source of truth: no play row, no VO beat. Johnny ElevenLabs is the production voice for this formula, and Hyperframes is the only production renderer.

Default play pacing is fast: brief setup, about a 5-second freeze with one short VO read, then the payoff in slow motion before moving to the next verified play. Do not stretch one possession unless it is the central hook.

## Git

Commit changes after every meaningful step — after updating AGENTS.md, after writing or updating a skill, after any pipeline change. Do not batch up multiple sessions of work into one commit. Each commit should represent one logical change.

Commit message format: short imperative sentence describing what changed and why, e.g. `add SSML pause support to VO step` or `update script for this-is-not-the-same-caitlin-clark`.

Never push to remote unless explicitly asked.
