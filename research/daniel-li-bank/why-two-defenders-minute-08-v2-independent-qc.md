# Independent QC — Section 8 Josh v2

**Rendered file:** `/Volumes/SSK SSD/ftl/videos/clip-first-why-two-defenders-still-doesnt-work/renders/minute-08-josh-v2.mp4`  
**Duration:** 63.433 s, 1920×1080, 30 fps  
**Verdict:** **Fail for source/cue accuracy. Pass for the second play's edit grammar.**

## Evidence method

- Compared against `why-two-defenders-minute-08-qc-cues.json` and `sections-08-09-production-manifest-v1.json`.
- Reviewed 1 fps contact sheets for all four cue intervals and exact frames around every detected freeze boundary.
- Ran FFmpeg `freezedetect` at `n=-45dB:d=0.35`.

## Freeze intervals detected

`1.800–4.333`, `10.700–15.600`, `19.900–22.400`, `26.600–29.467`, `33.667–36.200`, `41.567–43.867`, `43.867–46.900`, `53.233–56.267`, and `61.633–63.133`.

## Evidence-backed findings

### 1. The first play is not the manifested Clark hit-ahead sequence

The cue expects Clark's Q1 5:13 lead pass. However:

- At `1.7–4.333`, the held frame shows a Minnesota player in black carrying the ball at game clock `5:10`, with Indiana in red retreating.
- The moving footage after `4.333` continues Minnesota's possession toward the basket; by `15.7` the game clock reads `5:05` and the ball is at Minnesota's finish.
- The same Minnesota possession is restarted again around `22.4`, then held again at `26.600–29.467` on the Minnesota ball handler.

Therefore Cue 1 (`0:00–15.60`) does contain a live → freeze → moving resume → payoff shape, but the freeze and payoff are attached to the wrong possession. It does **not** show Clark's release freeze or her full-court lead-pass travel as required.

Cue 2 (`15.60–29.44`) repeats the same wrong Minnesota possession. Because it reveals no Clark lead-pass detail, this is a raw source loop rather than a valid analytical repeat.

### 2. The second play correctly executes the intended grammar

For the Q4 3:33 Clark-to-Mitchell reverse:

- `29.44–33.667`: live setup, with game clock moving from about `3:40` to `3:36`.
- `33.667–36.200`: help/pass freeze at `3:36`.
- `36.200–41.567`: slowed resume through the pass and reverse finish. Roughly three seconds of source-clock action occupies about 5.37 rendered seconds, consistent with the manifested `0.55×` treatment.
- `41.567–43.867`: short Clark reaction/payoff hold.

This satisfies Cue 3's live → freeze → slow resume → payoff expectation.

### 3. The final comparison is only half valid

Cue 4 (`43.84–63.12`) intentionally alternates the two established plays and is not an unrelated third possession. Its repeat of the Q4 reverse is analytical:

- it freezes the Q4 decision frame at `53.233–56.267`,
- resumes through the finish,
- and closes on Clark's reaction at `61.633–63.133`.

But its supposed full-court-pass half (`43.867–53.233`) again shows Minnesota's post-score possession, not Clark's lead pass. The comparison therefore cannot support the VO claim that the two Clark passes come from the same habit.

## Required correction boundary

Do not change the Q4 reverse sequence unless a separate issue is found. Replace every Q1 visual interval with the actual Indiana Q1 5:13 action, then preserve the intended analytical structure:

1. live setup before Clark releases,
2. freeze on Clark's release/recognition frame,
3. slow resume following the ball and runner,
4. catch and finish payoff,
5. only repeat it later if the repeat isolates a different teaching point.

