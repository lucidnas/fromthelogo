# Social Highlight Sourcing Pipeline

FTL should source Caitlin Clark highlights from everywhere for a specific game:

- official WNBA account
- official Indiana Fever account
- official opponent account
- ESPN / SportsCenter / league media
- reporters and analysts
- reliable fan clip accounts
- X/Twitter/pic.twitter.com clips
- YouTube highlight packages

## Rule

Use `yt-dlp` first for every YouTube, X/Twitter, or direct video URL.

Social clips are not automatically trusted. They are source material. Gemini can analyze them, but official play-by-play and box score verify the facts.

## Folder Layout

Downloaded social clips:

```text
/Volumes/SSK SSD/broll/social/{slug}/
```

Source ledger:

```text
/Volumes/SSK SSD/ftl/videos/{slug}/sources/social-source-ledger.json
/Volumes/SSK SSD/ftl/videos/{slug}/sources/social-source-ledger.md
```

## URL List Format

Create:

```text
research/source-urls/{slug}.txt
```

Each line can be plain:

```text
https://x.com/IndianaFever/status/...
https://pic.twitter.com/...
```

Or annotated:

```text
official | Indiana Fever | https://x.com/IndianaFever/status/...
official | WNBA | https://x.com/WNBA/status/...
media | SportsCenter | https://x.com/SportsCenter/status/...
fan | Clark Report | https://x.com/CClarkReport/status/...
analyst | Nekias Duncan | https://x.com/NekiasNBA/status/...
```

## Download Command

Use the one-command game sourcing wrapper first:

```bash
node tools/ftl-source-game-clips.mjs \
  --slug fever-mystics-2026-05-15 \
  --match-any "Caitlin Clark,Clark,CC,Washington,triple,three,dime,assist,OT"
```

Add extra official/media accounts or seed URLs when needed:

```bash
node tools/ftl-source-game-clips.mjs \
  --slug fever-storm-2026-05-17 \
  --account IndianaFever \
  --account WNBA \
  --match-any "Caitlin Clark,Clark,CC,Seattle,Storm,three,dime,assist" \
  --url "https://www.youtube.com/watch?v=..."
```

This script:

1. Creates or updates `research/source-urls/{slug}.txt`.
2. Scrapes official account timelines through Nitter.
3. Appends matching X video URLs.
4. Runs `yt-dlp` through the social ingest script.
5. Writes the media folder and source ledger.

Lower-level ingest command if the source list already exists:

```bash
node tools/ftl-social-clip-ingest.mjs \
  --slug fever-mystics-2026-05-15 \
  --urls-file research/source-urls/fever-mystics-2026-05-15.txt
```

## Prioritization

Prefer sources in this order:

1. Official WNBA/Fever/broadcast clips of the exact play.
2. Official opponent clips when they show a useful alternate angle or scoreboard context.
3. ESPN/SportsCenter/high-quality media reposts.
4. Analyst clips with useful framing.
5. Fan clips only when they are sharper, closer to the moment, or include a missing possession.

## What To Collect

For every game, try to collect:

- every Clark made three
- every Clark assist
- every Clark turnover that still shows pressure/attention if useful
- every Clark hockey assist or gravity possession
- every Clark transition push
- late-game possessions
- scoreboard/stat graphics
- postgame quote clips
- alternate replay angles
- fan/arena angle if official footage lacks the moment

## After Download

1. Review `social-source-ledger.md` for obvious download failures.
2. Run Gemini clip vetting so Gemini watches the actual downloaded videos.
3. Use the Gemini vetting manifest to separate official primaries, alternate angles, stat receipts, reactions, duplicates, and discards.
4. Feed the approved clip pool into Gemini possession analysis.
5. Match each Gemini read against official play-by-play.
6. Use official stats as positive receipts in the script.

## Gemini Clip Vetting

Do not manually decide the final clip pool from file names alone. The source ledger is only a candidate pool. Gemini must watch the actual videos before clips are promoted into the edit.

Run:

```bash
node tools/gemini-vet-sourced-clips.mjs \
  --slug fever-mystics-2026-05-15 \
  --title "This Caitlin Clark Fourth Quarter Was UNREAL" \
  --game-context "Indiana Fever vs Washington Mystics, May 15 2026. Clark had 32 points, 8 assists, and 7 made threes."
```

The vetting script:

1. Reads `/Volumes/SSK SSD/ftl/videos/{slug}/sources/social-source-ledger.json`.
2. Keeps downloaded video files only.
3. Separates clips into lanes: `official`, `media`, `fan`, `archive`, `other`.
4. Uploads the selected actual video files to Gemini.
5. Asks Gemini to identify what each clip shows, whether Clark is involved, visible clock/score, category, quality, usefulness, duplicates, best use, and risk notes.
6. Writes:

```text
/Volumes/SSK SSD/ftl/videos/{slug}/analysis/gemini-clip-vetting.json
```

Official clips should still get priority, but Gemini decides what every clip actually contains. Fan and media clips can become alternate angles or social proof when they show a clearer moment.

## Important

Non-official social clips are useful for discovery and alternate angles. Do not let them become the only source for factual claims. Every factual VO claim needs official data or a clearly visible receipt.
