# Daniel Li Analysis Notes For FTL

Source checked with `yt-dlp` on `https://www.youtube.com/@DanielLi7/videos` and `/shorts`.

## What To Borrow

- **One clean basketball idea per video.** Titles usually isolate a single tactical thought: a player uses IQ, a coach exploits a rule, a defender does not guard his man, a team is too obsessed with threes.
- **Curiosity-first title language.** Strong recurring frames:
  - `How [player] Uses Basketball IQ To Control The Game`
  - `[player/coach] Draws Up Genius Play To Win The Game`
  - `[player] Figures Out [opponent] Trick Play`
  - `Why [specific thing] Actually Matters`
  - `The [trait/problem] That [changed/cost] The Game`
- **Analysis is about decisions, not just outcomes.** The important question is usually: what did the player see before everybody else?
- **Use the replay as proof.** The beat is: show the play, identify the hidden read, replay with one new visual layer, then explain the consequence.
- **Casual precision.** It still sounds like basketball talk: "watch this," "look at where he is," "this is the read," "now the help has to choose." Not formal film-study language.

## How It Applies To Caitlin Clark

For FTL, keep Caitlin as the emotional center and use Daniel Li structure underneath:

1. Do **not** use a detached cold open, payoff-first teaser, or unresolved highlight montage.
2. Begin immediately with Caitlin, the relevant context, and the video's tactical premise.
3. Establish the apparent contradiction or curiosity question before beginning the detailed evidence.
4. Enter the first possession only after the audience knows what analytical detail to watch for.
5. Use arrows/rings/freeze frames to show what Caitlin saw.
6. Keep the analysis conversational and nearly continuous while the play resolves. Ordinary breaths and occasional sub-second emphasis pauses are enough; do not create multi-second silent viewing blocks unless an audible or visual moment specifically requires one.
7. Progress through fresh possessions that establish the baseline read, defensive adjustment, and Caitlin's counter.
8. Land the hype through the conclusion: Caitlin did not merely produce the result; she controlled the possession.

## Opening structure — verified August 4, 2026

Gemini URL-context review of three representative Daniel Li videos found conventional thesis-first introductions rather than detached cold opens:

- `How LeBron James Uses His Basketball IQ to Control the Game`: player and IQ thesis arrive in roughly the first 8.5 seconds; the first analyzed possession begins around 11 seconds.
- `How Jimmy Butler Uses His Basketball IQ to Control the Game`: context and fit questions occupy the opening; the thesis is stated around 29–35 seconds; detailed possession analysis begins later.
- `How 5'8" Yuki Kawamura Dominates Without Scoring`: player context, statistical contradiction, and central passing thesis run through roughly 49 seconds; the first proving possession follows around 52 seconds.

Reusable FTL opening:

```text
name Caitlin and state the timely context
-> establish the surprising contrast or tactical problem
-> ask or state the single analytical thesis
-> use related footage only as supporting B-roll
-> transition directly into the first proving possession
```

The first shown footage may be exciting, but it must support the spoken introduction. It is not a separate payoff that the video later rewinds to explain.

## FTL video-essay audio and footage rule

- Treat game footage as continuous B-roll evidence, not as clips that pause the essay for their original audio.
- Keep broadcast, announcer, crowd, and court audio muted by default.
- Use no background music for this calm analysis lane.
- Preserve natural speech cadence, not editorial dead air. Game footage is muted evidence underneath a continuous essay.
- Focus each visual passage on a specific possession, decision point, replay, or defensive response.
- Source audio is an exception reserved for a quote or audible event that the thesis specifically requires.

## Current 1,000 Point Video Fit

The Daniel Li-style idea is:

> Caitlin Clark's 1,000th point was not genius because it was loud. It was genius because every move before it made the quiet finish the perfect play.

This should still sound like FTL:

- Say "Caitlin," "CC," or "Caitlin Clark," not detached pronouns for too long.
- Use casual basketball words: bucket, read, lane, help, pressure, rhythm, logo three.
- Avoid editorial words in VO: clip, sequence, segment, footage, asset, B-roll.

## Extraction Status

`yt-dlp` listed Daniel Li videos successfully, but YouTube did not expose English captions for the sampled videos.

Metadata checked:

- `How Luka Doncic Uses His Basketball IQ To Control The Game` — 8:22, 117,536 views, uploaded 2026-03-30.
- `Giannis Draws Up Genius Play To Win The Game` — 4:40, 57,010 views, uploaded 2026-01-05.
- `How Basketball IQ Decides the Biggest Moments` — 3:36, 45,612 views, uploaded 2025-11-17.

The normal `yt-dlp` download path hit YouTube 403/SABR. The documented fallback worked:

```bash
/opt/homebrew/bin/yt-dlp --cookies-from-browser chrome \
  --extractor-args 'youtube:player_client=default,-tv' \
  -f '300-21/300/18' --merge-output-format mp4 \
  -o '/Volumes/SSK SSD/broll/reference/daniel-li/giannis-genius-play.%(ext)s' \
  'https://www.youtube.com/watch?v=TtVw02ODhCA'
```

Reference files:

- `/Volumes/SSK SSD/broll/reference/daniel-li/giannis-genius-play.mp4`
- `/Volumes/SSK SSD/broll/reference/daniel-li/giannis-genius-play-contact.jpg`

## Visual Structure From The Giannis Reference

The contact sheet shows a simple but effective editor pattern:

1. Start with the live game moment and scoreboard context.
2. Replay the same action with one new visual idea: ring the matchup, draw the switch, label the choice.
3. Cut to a receipt: coach/player quote, huddle, or the actual drawn-up play.
4. Return to the play after the receipt so the viewer sees the decision differently.
5. Use short text overlays as basketball labels, not decorative captions.
6. End with the payoff replay, often after the viewer has already been taught what to watch.

For FTL, this means repeated Caitlin Clark clips are fine only if the repeat has a new analytical layer:

- live result first
- freeze on CC's decision point
- arrow/ring showing the defender's problem
- receipt graphic or clock/score
- slow replay payoff

For section 1, the Daniel Li-style fix is to freeze before the spin and make the audience see the logo-three temptation versus the open lane before the VO says the conclusion.
