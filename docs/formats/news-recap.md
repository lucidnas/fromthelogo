# FTL News Recap — Trending-Story, Image-Led

The reactive **news lane**. FTL scans the major outlets covering Caitlin Clark / Indiana Fever
/ the WNBA every day, finds the strongest trending story, and turns it into a 4–6 minute,
**image-led** video with a headline as sensational as — or more than — the outlet's, but
**always factual**. This is an *additional* lane: it does not replace Clip-First Celebration or
the compilation lanes. Use it when the day's story is a narrative/news beat (a quote, a ruling,
a report, a trade rumor, a social post) rather than a clip-worthy on-court play.

**Voice:** Johnny ElevenLabs (Australian Neutral default). **Renderer:** Hyperframes.

---

## Non-negotiables

1. **Clark Lens (mandatory).** Every story is told through "what does this mean for Caitlin
   Clark?" — even when she is not the subject. If a story has no Clark/Fever connection, it is
   not an FTL news recap.
2. **Caitlin Clark in the title.** Always. Titles use the **curiosity-gap hook formulas in
   `research/news-title-hooks.md`** (reverse-engineered from real SI / Yahoo / Athlon / B-R
   headlines) — withhold the payoff, tease the stakes, don't state the stat. **Do NOT use the Clark
   Celebration formula** ("THIS Caitlin Clark ___ is GENIUS/UNREAL/INSANE") and **no yellow/awe
   word** — that hype pattern is the Celebration lane's and reads as clickbait on a news beat.
   **Read `research/news-title-hooks.md` before writing any news title.**
3. **Sensational but strictly factual.** You may frame harder than the source outlet. You may
   NOT invent. Every on-screen claim and every sourced VO statement must trace to a real source
   captured in the research file. Attribute reporting in the VO ("Yahoo Sports is reporting…",
   "according to The Athletic…"). **Codex fact-check is a hard gate** — a recap does not render
   until fact-check passes.
4. **Image-led, hybrid visuals.** See the visual policy below.

---

## Source outlets

Default scan set (wired into `tools/ftl-news-scan.mjs`):

Yahoo Sports · Sports Illustrated · Athlon Sports · Sporting News · USA Today · IndyStar ·
The Athletic · ESPN · CBS Sports · Bleacher Report · ClutchPoints — **plus social**:
Caitlin Clark and Sophie Cunningham TikTok/IG posts.

The aggressive-headline outlets (B/R, ClutchPoints) are useful as *framing reference* for how
sensational the title can go; the reporting-heavy outlets (The Athletic, ESPN, IndyStar) are
the preferred *fact* sources. When two outlets conflict, prefer the reporting-heavy one and note
the conflict.

---

## Visual policy — hybrid (the heart of this lane)

A news recap is carried by stills with ken-burns motion, with occasional moving inserts. Each
beat is one of four types (see `beats.json` schema below):

- **`ai-image`** — the base look. AI-generated editorial imagery for conceptual beats (cap math,
  "the league decides", a trajectory, a matchup framing). Generated **free** via the
  `codex-image-gen` skill. This is the safest visual for monetization — use it as the default
  and the majority of beats.
- **`receipt`** — the actual on-screen proof for the specific claim under discussion: an outlet
  headline screenshot, a tweet/TikTok screenshot, a box score, a quote card. Used **briefly**,
  under direct commentary (transformative/fair-use posture), and **attributed on screen** (the
  outlet name stays visible). One receipt per claim; do not wallpaper the video with scraped
  photos.
- **`broll-still`** — a representative frame pulled from our own clean Caitlin Clark b-roll
  (`/Volumes/SSK SSD/broll/clips/`) for an action reference where motion isn't needed.
- **`broll-video`** — a short moving insert of our own b-roll for an action beat, audio ducked
  under the VO. Use when the story genuinely benefits from live motion (a referenced play, a
  reaction). Keep these to a handful per video — this is a news recap, not a highlight reel.

**Copyright posture:** AI images and our own b-roll are clean. Real outlet photos/screenshots
appear only as the *receipt* for the claim being analyzed, kept short and attributed. Prefer an
AI render or an owned b-roll frame over a scraped news photo whenever it can carry the beat.

---

## Pipeline

```
1. Scan      node tools/ftl-news-scan.mjs --date YYYY-MM-DD --limit 5
             → research/news-ideas/YYYY-MM-DD-news-stories.md  (ranked, with receipts + titles + visual plan)

2. Pick      choose the top story + lock the sensational-but-factual title

3. Script    node tools/ftl-script-pipeline.mjs --mode news \
               --slug SLUG --title "TITLE" \
               --research research/news-ideas/YYYY-MM-DD-news-stories.md --generate
             (news mode: no --clips needed, 700-900 word target, Roast + Codex fact-check gate)

4. VO        /ftl-vo SLUG     (Johnny, → /Volumes/SSK SSD/ftl/videos/SLUG/vo.mp3)

5. Beats     node tools/ftl-news-build-beats.mjs --slug SLUG
             → beats.json + images/ (+ clips/ for video beats), materialized from the visual plan

6. Render    node tools/ftl-render-news-recap.mjs --slug SLUG
             → /Volumes/SSK SSD/ftl/videos/SLUG/render/renders/final-v1-approved.mp4

7. QC        node tools/ftl-news-recap-qc.mjs --video=<final.mp4> --title "TITLE"
             (long-form gemini-2.5-pro gate: receipt legibility/accuracy, visual-vs-narration
              match, image quality, b-roll framing, caption spelling, pacing. Exits non-zero
              unless VERDICT: SHIP. Do NOT use gemini-cli-review.mjs here — it routes >20 MB
              videos to the Shorts reviewer, which fails any 4-6 min recap on length.)
```

The `ftl-news-recap` skill runs this end to end.

## Script shape (700–900 words, ~4–6 min)

Follows the Daily Take voice (sharp, news-desk urgency, film-room specificity) but longer and
multi-beat:

1. **Cold-open hook (5–10s)** — the take/news, no greeting.
2. **The story** — what dropped today, who reported it, the Clark-lens framing.
3. **The receipts** — the quote, the stat, the screenshot. Prove every claim, attribute it.
4. **What it means for Clark** — the analysis; the open loop that holds the viewer.
5. **The verdict + one CTA** — close like a gavel, one subscribe CTA.
6. End exactly: `New videos every week on From The Logo. See you next time.`

No `[OVERLAY]` tags in the script — captions are generated from the Whisper-aligned VO, and
beats map to spoken phrases via `narration_excerpt`.

## `beats.json` schema

```json
[
  {
    "beat": 1,
    "type": "ai-image",
    "narration_excerpt": "exact spoken phrase this visual covers",
    "imagePath": "images/beat_001.png",
    "prompt": "editorial image prompt (ai-image only)",
    "source": "outlet+url OR broll filename",
    "attribution": "Yahoo Sports"
  },
  {
    "beat": 7,
    "type": "broll-video",
    "narration_excerpt": "...",
    "clipPath": "clips/beat_007.mp4",
    "clipIn": 2.0,
    "clipOut": 6.5,
    "source": "broll/clips/caitlin-clark-...mp4"
  }
]
```

`type` ∈ `ai-image | receipt | broll-still | broll-video`. Image-type beats use `imagePath`;
`broll-video` uses `clipPath` + `clipIn`/`clipOut`. `attribution` is required for `receipt`
beats and renders on screen.

## Render hygiene

The renderer wraps Hyperframes via `tools/render-hyperframes-clean.mjs`, which kills leftover
Puppeteer/Chrome/ffmpeg workers after each render (AGENTS.md stale-process rule). Run the stale
render-process check before starting another render.

## Music

Low, copyright-safe bed only (YouTube Audio Library / Creator Music). Default:
`/Volumes/SSK SSD/Desktop/Background Music/Anno Domini Beats - Like That.mp3`. Keep it under the
VO; duck further under any `broll-video` source audio.
