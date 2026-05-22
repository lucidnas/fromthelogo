# Caitlin Clark Uncredited Assists Receipt Video

Date: 2026-05-17  
Game: Indiana Fever vs Washington Mystics, May 15 2026  
Working format: FTL receipt / Clark Celebration hybrid  
Primary title: `The WNBA Missed This Caitlin Clark Assist`
Yellow word: `MISSED`

## Angle

The official WNBA liveData box score credits Caitlin Clark with 8 assists: 32 points, 8 assists, 7 made threes. But the official Indiana Fever account posted an assist package titled around `all 10 assists from Caitlin Clark`.

That creates the video:

The Fever showed ten Clark-created buckets. The WNBA official sheet only gave her eight. One of the two extra plays is a hockey assist, but the fourth-quarter Kelsey Mitchell three is the real callout: Clark passes, Mitchell catches, shoots with zero dribbles, and the official play-by-play gives Clark nothing.

## Footage URL

- Fever all-10-assists package: `https://x.com/IndianaFever/status/2056112265066086757/video/1`
- Local source: `/Volumes/SSK SSD/broll/social/fever-mystics-2026-05-15/26-x-IndianaFever-2056111874911969281.mp4`

## Official Receipts

- WNBA box score API: `https://cdn.wnba.com/static/json/liveData/boxscore/boxscore_1022600022.json`
- WNBA play-by-play API: `https://cdn.wnba.com/static/json/liveData/playbyplay/playbyplay_1022600022.json`
- Local official context: `/Volumes/SSK SSD/ftl/videos/fever-mystics-2026-05-15/analysis/official-game-context.json`

Official Clark line in WNBA liveData:

- 32 PTS
- 8 AST
- 4 REB
- 7-17 3PT
- +14

Official credited Clark assists:

1. Q1 8:16 A. Boston layup
2. Q1 7:48 A. Boston 26' 3PT
3. Q1 7:15 S. Cunningham 24' 3PT
4. Q2 3:38 K. Mitchell 15' jumper
5. Q4 7:23 M. Hines-Allen cutting layup
6. Q4 3:53 K. Mitchell running reverse layup
7. OT 4:22 K. Mitchell 8' pullup jumper
8. OT 0:06.2 L. Hull 26' 3PT

## Disputed Plays

Generated package:

```bash
node tools/ftl-assist-discrepancy-package.mjs \
  --slug fever-mystics-2026-05-15 \
  --source-clip "/Volumes/SSK SSD/broll/social/fever-mystics-2026-05-15/26-x-IndianaFever-2056111874911969281.mp4" \
  --official "/Volumes/SSK SSD/ftl/videos/fever-mystics-2026-05-15/analysis/official-game-context.json"
```

Outputs:

- `/Volumes/SSK SSD/ftl/videos/fever-mystics-2026-05-15/clips/assist-discrepancy/01-q2-billings-hockey-assist.mp4`
- `/Volumes/SSK SSD/ftl/videos/fever-mystics-2026-05-15/clips/assist-discrepancy/02-q4-mitchell-direct-assist-candidate.mp4`
- `/Volumes/SSK SSD/ftl/videos/fever-mystics-2026-05-15/analysis/assist-discrepancy-cut-verification.json`

Gemini cut verification:

- Q2 5:55 Billings three: hockey assist. Clark drives, bends the defense, and makes the pass before the pass. This should be framed as Clark-created, not as a standard official assist.
- Q4 0:28.8 Mitchell three: direct-assist candidate. Clark passes to Mitchell, Mitchell shoots with zero dribbles, official play is `K. Mitchell 28' 3PT running (19 PTS)`, and Clark is not credited.

## Proposed Title Options

1. `The WNBA Missed This Caitlin Clark Assist`
2. `Caitlin Clark Had Another Assist The WNBA Missed`
3. `The Caitlin Clark Assist The WNBA Forgot`
4. `This Caitlin Clark Pass Was NOT Credited`

## Script Stance

Be direct, but precise:

- Say the WNBA official box score says 8.
- Say the Fever posted a package showing 10 Clark assist-like plays.
- Say one extra play is a hockey assist, and we can live with that.
- Put the pressure on the Q4 Mitchell three because that one looks like a direct assist.
- Close on Clark's impact being bigger than the official count.

Avoid:

- "The WNBA robbed her of two assists" as a blanket claim.
- Calling the Q2 Billings play a clear official assist.
- Saying this changes the official triple-double/double-double status unless the official stats update.
