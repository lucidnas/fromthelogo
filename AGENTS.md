<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# From The Logo — Content Creation Process

FTL is a faceless YouTube channel about Caitlin Clark and the Indiana Fever. Every video starts with a proven title format borrowed from a top NBA channel, then finds a Clark/Fever story that fits that exact narrative structure.

## The Core Workflow

### Step 1 — Find proven NBA title formats

Pull transcripts from high-performing NBA YouTube channels. The primary reference channels are:

- **Hoop Reports** — dramatic, fear-based titles ("Just Became The NBA's Worst Nightmare", "Just Sent The NBA A Message")
- **JxmyHighroller (DKM)** — data-driven, paradigm shift titles ("This Changes Everything", "The Numbers Don't Lie")
- **Mick Talks Hoops** — player breakdowns, emergence stories
- **Rachel DeMita** — WNBA-specific, fan-first, conversational takes on Clark/Fever news

Extract transcripts using:
```bash
yt-dlp --write-auto-sub --sub-lang en --skip-download --write-sub -o "/tmp/yttranscript" "YOUTUBE_URL"
```

Clean and read the transcript:
```bash
cat /tmp/yttranscript.en.vtt | grep -v '^WEBVTT' | grep -v '^NOTE' | grep -v '^$' | grep -v '^\d\+:\d\+' | grep -v ' --> ' | sed 's/<[^>]*>//g' | awk '!seen[$0]++'
```

Save all transcripts to `~/transcripts/` with descriptive filenames.

### Step 2 — Identify the title's narrative structure

Every great NBA title tells a specific type of story. Before adapting it, identify what story it actually tells:

| Title format | Narrative type |
|---|---|
| "X Just Became The NBA's Worst Nightmare" | Dominance/fear — a team or player is now a threat the league can't ignore |
| "X Just Sent The NBA A Message" | Statement/response — a team responded to doubt with action |
| "This Changes Everything For X" | Paradigm shift — one move or development rewrites the entire outlook |
| "The Day X Exposed Y" | Villain gets punished — hero responds to a specific slight with dominance |
| "When You're The Best X But Nobody Cares" | Under-recognition — elite player being overlooked or underpaid |
| "X Has A Problem" | Tension/conflict — a threat to a player or team's future |

### Step 3 — Find the matching Clark/Fever story

The story must genuinely fit the narrative structure — not just feel similar on the surface. Sources to pull from:

- **Training camp footage and recaps** — what the team is focusing on, who is standing out
- **Rachel DeMita's videos** — WNBA power rankings, roster moves, Clark-specific takes, contract news
- **WNBA news** — extensions, free agency signings, coaching comments, injury updates
- **On-court moments** — specific games, stat lines, plays that match a villain/vindication structure

**Hard rule:** Clark and the Indiana Fever are always the protagonist. They are the force doing something. Never the ones being threatened or defeated.

✅ "The Indiana Fever Just Sent The WNBA A Message" — Fever as the agent  
✅ "This Changes Everything For Caitlin Clark" — Clark at the center of a shift  
❌ "The New York Liberty Just Became Caitlin Clark's Worst Nightmare" — wrong protagonist

### Step 4 — Map sources to video topics

Each video should have one clear topic pulled from a specific source. Examples from the first batch:

| Video title | Narrative type | Source material |
|---|---|---|
| "The Indiana Fever Just Sent The WNBA A Message" | Statement/response | Training camp Day 2 footage — defense as the identity, Clark's transition dominance, Justine Pat's length, locked gym |
| "This Changes Everything For Caitlin Clark" | Paradigm shift | Rachel DeMita power rankings — Aaliyah Boston's $6.3M historic extension, big three all returning, Clark supermax on the horizon |
| "The Indiana Fever Just Became The WNBA's Worst Nightmare" | Dominance/fear | Rachel DeMita power rankings — Fever at #3 with full chemistry, one OT loss from Finals, Liberty super team as the foil |

### Step 5 — Write the script

Target: **1,200–1,400 words** (approx. 8 minutes at narration pace).

Follow the FTL voice profile in `src/lib/voice-profile.ts`. Key requirements:

- **Cold open** — stat-first, quote-first, play-first, or emotion-primed. Never a greeting.
- **Short paragraphs** — 2–4 sentences. At least one single-sentence paragraph.
- **Stat stacks** — deliver numbers as a rapid list, not buried in prose. Always follow with a "so what" frame.
- **2–3 first-person reactions** — "I honestly had to reread this.", "My jaw dropped.", "I'm still buzzing."
- **2–4 two-word punches** — standalone lines: "Real money.", "Yep.", "Wrong read."
- **One villain beat** — a specific person, quote, or action that Clark/Fever respond to
- **One vindication moment** — a concrete stat, play, or contract that earns the title
- **Close** — callback or metaphor punch. Not a summary. One line.
- **Sign-off** — "New videos every week on From The Logo. See you next time." Nothing after.

Only use facts from the source transcripts. Do not fabricate stats, quotes, or names.

### Step 5.5 — Roast the script (YouTube analysis)

After writing and saving the script, run it through RoastMyVideo's script analyzer before generating VO. This gives a full YouTube-perspective review: hook strength, retention curve, viral potential, title suggestions, and actionable notes.

```bash
cd ~/code/roastmyvideo
SCRIPT=$(cat ~/transcripts/script-SLUG.txt) bun -e "
import { analyzeScript } from './src/utils/gemini';
const result = await analyzeScript(process.env.SCRIPT, 'professional');
console.log(JSON.stringify(result, null, 2));
"
```

**Act on the output before moving to VO:**
- `overallSentiment` must be `strong` or `fire` — if `decent` or below, revise
- Fix any section flagged as `weak` or `bad`
- Check `retentionCurve` for drop points and tighten those beats
- Note title suggestions — they may be stronger than the working title

Only proceed to VO once the overall sentiment is `strong` or `fire`.

### Step 6 — Generate VO with SSML pauses

Run `/ftl-vo "slug"` to generate ElevenLabs narration.

- Voice: Australian Neutral (voice ID `DTLT09E2cxHF0DqjKVbc`)
- Output: `/Volumes/SSK SSD/ftl/videos/{slug}/vo.mp3`

**Always use SSML pauses.** Wrap the full text in `<speak>` tags and insert `<break time="Xs"/>` at cinematic moments so background music breathes. Standard pause placements:

| Moment type | Break duration |
|---|---|
| Single-sentence punch line (standalone paragraph) | `1s` – `1.5s` |
| Major reveal or stat drop | `1.5s` – `2s` |
| "Let that land" / deliberate beat | `2s` – `2.5s` |
| Section transition (pivot from one argument to next) | `1s` |

**Chunking:** ElevenLabs has a ~5,000 character limit per request. Scripts over ~800 words must be split into 2 chunks at a natural paragraph break, generated separately, then stitched:

```bash
ffmpeg -y -i vo-chunk1.mp3 -i vo-chunk2.mp3 \
  -filter_complex "[0:a][1:a]concat=n=2:v=0:a=1[out]" \
  -map "[out]" vo.mp3
```

Save the final file to `/Volumes/SSK SSD/ftl/videos/{slug}/vo.mp3` and an archived timestamped copy alongside it.

### Step 6.5 — Source and validate all assets

Before running the render, every asset referenced in the cue sheet must exist on disk. Run this validation:

```bash
python3 - << 'EOF'
import json, os

SLUG = "your-slug-here"
SSD = "/Volumes/SSK SSD"

with open(f"{SSD}/ftl/videos/{SLUG}/cue-sheet.json") as f:
    cues = json.load(f)

missing = []
for cue in cues:
    for key in ["clipPath", "imagePath"]:
        path = cue.get(key)
        if path and not os.path.exists(path):
            missing.append(f"{cue['type']} @ {cue['startSecs']}s → {path}")

if missing:
    print(f"✗ {len(missing)} missing assets:")
    for m in missing: print(f"  {m}")
else:
    print(f"✓ All {len(cues)} cues validated")
EOF
```

**If assets are missing**, source them before rendering:

- **B-roll clips** — download via `yt-dlp` and save to `/Volumes/SSK SSD/broll/aroll/{slug}/`:
  ```bash
  yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]" \
    --merge-output-format mp4 \
    -o "/Volumes/SSK SSD/broll/aroll/{slug}/%(title).50s.mp4" \
    "YOUTUBE_URL"
  ```
- **Graphics / stat cards** — generate with the design tool or ask the user to provide them
- **Illustrated scenes** — generate via `/ftl-thumbnail` or AI image tool

Do not attempt to render with missing assets — Remotion will produce black frames silently.

### Step 7 — Build cue sheet

Create `/Volumes/SSK SSD/ftl/videos/{slug}/cue-sheet.json` — a JSON array mapping timecodes to B-roll clips and graphics.

```json
[
  { "startSecs": 0,  "endSecs": 12, "type": "broll",     "clipPath": "/Volumes/SSK SSD/broll/training-camp/clark-warmup.mp4" },
  { "startSecs": 12, "endSecs": 24, "type": "stat_card", "imagePath": "/Volumes/SSK SSD/ftl/videos/{slug}/graphics/stat-1.png" }
]
```

Cue types: `broll`, `stat_card`, `headline`, `tweet`, `illustrated_scene`, `aroll`.
All paths must be absolute SSD paths — `render.ts` converts them to HTTP URLs at runtime.

B-roll library lives at `/Volumes/SSK SSD/broll/`.

### Step 8 — Render

Run `/ftl-render "slug"` to produce the final MP4.

```bash
cd /Users/abdul/code/fromthelogo/local/remotion
bun run render.ts {slug}
```

Output: `/Volumes/SSK SSD/ftl/videos/{slug}/render/final.mp4`

---

## Reference Channels to Monitor

Pull new title formats regularly from these channels:

| Channel | Why |
|---|---|
| Hoop Reports | Highest-performing dramatic titles in NBA content |
| JxmyHighroller | Data storytelling, paradigm shift formats |
| DKM | Similar Jxmy-style, strong hooks |
| Mick Talks Hoops | Player emergence/breakdown format |
| Rachel DeMita | Primary WNBA/Clark/Fever source — power rankings, roster news, training camp |

---

## What Makes a Good FTL Pitch

A pitch is strong when:
- The title format is borrowed from a video with 300K+ views
- The narrative type (fear, statement, shift, revenge) genuinely matches the Clark/Fever story
- There is a named villain with a specific quote or action
- There is a concrete vindication moment — a contract, a stat line, a specific play
- The topic hasn't been covered by FTL already

A pitch is weak when:
- The title is just aesthetically similar but the story doesn't actually fit the narrative type
- Clark or the Fever are framed as the victim or the one being threatened
- The stats or quotes are vague or fabricated
- The topic is already in the covered list
