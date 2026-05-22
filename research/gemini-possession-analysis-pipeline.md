# Gemini Possession Analysis Pipeline

This is the new FTL game-video core.

We do not start with a recap script. We start with Caitlin Clark possessions.

## Goal

Gemini acts as the senior possession analyst and editor. It watches the selected Clark clips and returns a detailed possession breakdown:

- what is on screen
- where Clark starts
- where the defenders are
- jersey numbers if visible
- quarter/clock/score if readable
- what move/read Clark makes
- what defensive mistake or impossible choice she creates
- what positive value Clark created
- what must be verified against official play-by-play and box score
- where to freeze, replay, slow down, or add circles/arrows
- FTL-style VO for that beat

Then we fact-check the Gemini read against official data before VO.

## Editorial Rule

Caitlin Clark is the product.

The final score is not the frame. A loss, miss, off shooting night, or messy team performance can be context, but the video exists to explain Clark's value:

- gravity
- pace
- range
- passing windows
- collapsing the defense
- manipulating help
- creating advantages
- forcing panic
- making the correct decision

If the ball does not go in, the read can still be the story.

## Deterministic Flow

### One-command analysis chain

After sourcing clips, run:

```bash
node tools/ftl-gemini-game-analysis-pipeline.mjs \
  --slug fever-mystics-2026-05-15 \
  --title "This Caitlin Clark Fourth Quarter Was UNREAL" \
  --max-candidates 18 \
  --wnba-game-id 1022600022
```

To include a source refresh first:

```bash
node tools/ftl-gemini-game-analysis-pipeline.mjs \
  --slug fever-mystics-2026-05-15 \
  --title "This Caitlin Clark Fourth Quarter Was UNREAL" \
  --source \
  --match-any "Caitlin Clark,Clark,CC,Washington,Mystics,triple,three,dime,assist,OT" \
  --max-candidates 18
```

To avoid re-uploading after successful outputs already exist:

```bash
node tools/ftl-gemini-game-analysis-pipeline.mjs \
  --slug fever-mystics-2026-05-15 \
  --title "This Caitlin Clark Fourth Quarter Was UNREAL" \
  --reuse-existing
```

This wrapper runs:

1. optional clip source refresh
2. Gemini clip-pool selection
3. Gemini possession breakdown
4. WNBA official context pull when `--wnba-game-id` is provided
5. deterministic fact-check report against Gemini's breakdown

It writes:

```text
/Volumes/SSK SSD/ftl/videos/{slug}/analysis/gemini-clip-selection.json
/Volumes/SSK SSD/ftl/videos/{slug}/analysis/gemini-selected-clips-manifest.json
/Volumes/SSK SSD/ftl/videos/{slug}/analysis/possession-breakdown-gemini-selected.json
/Volumes/SSK SSD/ftl/videos/{slug}/analysis/official-game-context.json
/Volumes/SSK SSD/ftl/videos/{slug}/analysis/fact-check-report.md
```

### Stage details

1. Source game highlights and official footage.
2. Let Gemini select the best Clark-centered clips from the sourced pool:

```bash
node tools/gemini-clip-pool-select.mjs \
  --slug fever-mystics-2026-05-15 \
  --title "This Caitlin Clark Fourth Quarter Was UNREAL"
```

This reads:

```text
/Volumes/SSK SSD/ftl/videos/{slug}/sources/social-source-ledger.json
```

It writes:

```text
/Volumes/SSK SSD/ftl/videos/{slug}/analysis/gemini-clip-selection.json
/Volumes/SSK SSD/ftl/videos/{slug}/analysis/gemini-selected-clips-manifest.json
```

The selection step is Gemini's job, not ours. The script only applies mechanical filters for practicality:

- downloaded media only
- avoids very long full-game/archive files by default
- avoids low-resolution files by default
- prioritizes official/high-quality sources before upload

Gemini still watches the candidate videos and decides which clips belong in the video.

3. Run Gemini possession analysis on Gemini's selected manifest:

```bash
node tools/gemini-possession-breakdown.mjs \
  --title "This Caitlin Clark Fourth Quarter Was UNREAL" \
  --clips "/Volumes/SSK SSD/ftl/videos/{slug}/analysis/gemini-selected-clips-manifest.json" \
  --out "/Volumes/SSK SSD/ftl/videos/{slug}/analysis/possession-breakdown.json" \
  --model gemini-3.1-pro-preview
```

4. Pull official box score and play-by-play.
5. Verify every Gemini claim:
   - clock/score
   - made/missed shot
   - assist attribution
   - foul/turnover/rebound
   - stat line
   - player names and jersey numbers
6. Use only verified facts in VO.
7. Build the clip-led script from the verified possession breakdown.
8. Generate VO with OpenAI Cedar.
9. Build Hyperframes edit using the possession `editPlan`.

## Official Data Layer

Use official sources whenever possible:

- WNBA.com box score
- WNBA.com play-by-play
- official PDF gamebook / scoresheet if available
- ESPN box score only as backup

The official data should supply positive Clark stats for the script:

- points
- assists
- three-pointers
- fourth-quarter points
- clutch points
- plus/minus only if helpful
- team points created by Clark possessions
- shot-distance or play-type context only if officially available or visually obvious

## Output Contract

The possession breakdown JSON should feed both scripting and editing.

Important fields:

- `readableClockScore`
- `officialVerification`
- `floorMap`
- `moveName`
- `defensiveMistake`
- `clarkRead`
- `positiveValue`
- `ftlVoiceoverBeat`
- `editPlan`
- `recommendedVideoOrder`
- `scriptSkeleton`

## Why This Is Better

This makes the workflow footage-first and fact-checked.

Gemini does the high-context visual analysis. Official score data keeps it honest. FTL adds the voice, title, pacing, and Clark-positive framing.
