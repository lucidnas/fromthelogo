<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# From The Logo — Content Creation Process

FTL is a faceless YouTube channel covering the WNBA every day from the Caitlin Clark and Indiana Fever perspective. Every story — trades, games, league decisions, rival teams, drama — gets filtered through one question: **what does this mean for Caitlin Clark?**

**Channel positioning:** FTL is Rachel DeMita's coverage — but faceless. Same topics, same fan-first energy, same daily cadence. The difference is there's no face, no parasocial personality. The narrator is just a passionate Clark fan telling you what happened today and what it means for her. Conversational, direct, opinionated — not cinematic or documentary-style.

**Primary format: Clark Celebration.** This is the channel's identity. Every research session, every script idea, every thumbnail brief starts here. The "THIS Caitlin Clark ___ is ___" pattern is what builds loyal subscribers and consistent views — it's also what the Shorts strategy is already doing, and the views are confirming it.

| Format | Priority | Cadence | Length | Track record |
|---|---|---|---|---|
| **Clark Celebration** ← default | Primary | Multiple per week — whenever a clip-worthy CC play, ad, skill, dribble, or pass surfaces | 4–6 min | 217K, 204K, 204K, 179K, 94K, 43K, 38K, 15K floor — consistent and loyal |
| **Refs / Fines / Villain Reaction** | Opportunistic only | When a real fine, tech, foul, or league decision actually drops | 5–8 min | 343K, 220K, 211K, 130K, 108K — high ceiling, but only when there's a real artifact to react to |
| **Game Recap (villain-response framing)** | Opportunistic only | Game day or next morning, only for noteworthy games | 5–8 min | 152K, 94K, 69K, 61K |
| **FTL Documentary** | Rare | ~1 per month max, only for genuinely big narrative moments | 8–10 min | Recent docs landed at 490 and 698 views — underperforms |

**Operating rule:**
1. Research sessions default to Clark Celebration angles — find the clip, the play, the commercial, the skill, the moment that deserves an awe word.
2. Refs/fines/game-recap videos are reactive only. Do NOT go looking for them. If a real Sophie fine, Clark tech, or signature win happens that day, drop the Celebration plan and cover it. Otherwise, stay on Celebration.
3. The "THIS Caitlin Clark ___ is ___" title pattern is the channel's most reliable hook. Use it freely — GENIUS, AWARD, SPECTACULAR, PURE ART, NEXT LEVEL, INSANE, UNREAL, DIFFERENT.

**Yellow word library for Celebration format:** GENIUS, SPECTACULAR, UNREAL, INSANE, AWARD, DIFFERENT, ART, NEXT LEVEL, ELITE, MASTERFUL.

**Required reading before any Celebration video:**
- `research/celebration-format-playbook.md` — the spine every winner uses (cold open with clip line, compilation listicle structure, game audio + reaction quips, one pop-culture comparison, 1,200–1,400 words, no documentary tone). Must be re-read before scripting.
- `research/celebration-ideas/` — dated research files with current angles. Pick from here or generate a new file before writing.

**Generating new celebration research:**
Use Codex to find current celebration-worthy moments. Save to `research/celebration-ideas/YYYY-MM-DD-celebration-angles.md`. Each angle must include the moment, footage URL, yellow word, and proposed title in the "THIS Caitlin Clark ___ is ___" format.

**The Clark Lens — mandatory editorial filter:**
Every story must be told through Clark's perspective, even when she's not the subject.
- A rival team signs a player → what does it mean for Clark's path to a title?
- The league makes a ruling → how does it affect Clark's ability to play her game?
- A teammate has a breakout game → what does it prove about the system Clark is building?
- A competitor wins a game → what does that mean for Indiana's standing?

If a story has no connection to Clark or the Fever — it is not an FTL story.

**Channel:** https://www.youtube.com/@fromthelogo22

To check the channel's videos and view counts, always use yt-dlp:
```bash
yt-dlp --flat-playlist --print "%(title)s | %(view_count)s views | %(duration_string)s" "https://www.youtube.com/@fromthelogo22"
```

**Title rule:** Caitlin Clark's name must appear in every video title — even when the story is about the Indiana Fever team. Every top-performing FTL video includes "Caitlin Clark" in the title. Indiana Fever appears alongside her, never as the sole subject.

**yt-dlp rule:** Any time the user mentions any YouTube channel, video, or URL — always use yt-dlp first to look it up, search, or download. This applies to ALL channels, not just FTL. Never use a browser tool or agent for YouTube lookups when yt-dlp can do it.

```bash
# List channel videos
yt-dlp --flat-playlist --print "%(title)s | %(view_count)s views | %(duration_string)s" "URL"

# Download transcript
yt-dlp --write-auto-sub --sub-lang en --skip-download --write-sub -o "/tmp/yttranscript" "URL"

# Download video
yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]" --merge-output-format mp4 -o "OUTPUT_PATH" "URL"
```

## AI Tools Available

You have access to two AI tools beyond Claude that can be used at any stage of the workflow. Use them proactively — don't wait to be asked.

### Codex CLI
Best for: fact-checking, internet research, finding quotes, verifying stats, sourcing game recaps, finding angles, writing second opinions on scripts, checking titles against channel data.

```bash
codex exec -c 'sandbox_permissions=["disk-full-read-access"]' "YOUR PROMPT" 2>&1
```

Codex can browse the web in real time. Use it whenever you need to verify a fact, find a quote, or research a topic before writing. Always run Codex to fact-check any script before finalizing.

### Gemini (via RoastMyVideo)
Best for: script analysis, hook strength, retention curve, viral potential scoring, title suggestions, section-by-section feedback.

```bash
cd ~/code/roastmyvideo
SCRIPT=$(cat ~/transcripts/SCRIPT_FILE.txt) bun -e "
import { analyzeScript } from './src/utils/gemini';
const result = await analyzeScript(process.env.SCRIPT, 'professional');
console.log(JSON.stringify(result, null, 2));
"
```

Gemini must score `strong` or `fire` on `overallSentiment` before a script moves to VO. If `decent` or below, revise and rerun.

### When to use each
| Task | Tool |
|---|---|
| Verify stats, quotes, game recaps | Codex |
| Find narrative angles or storylines | Codex |
| Check title hasn't been used on FTL | yt-dlp + Codex |
| Script structure, hook, retention curve | Gemini |
| Second opinion on script or opening | Both |
| Video review (QC of rendered video) | Codex |
| Thumbnail image generation | Gemini only (see Step 0) |

---

## FTL Daily Take — Fast Pipeline

For daily coverage. Target: same day or next morning. Total production time: under 1 hour.

**The Clark Perspective Rule:** Every Daily Take must answer "what does this mean for Caitlin Clark?" — even if the story is about another player, team, or league decision. She is always the lens.

**Structure (3 acts, 400–500 words):**

1. **The News** (1 paragraph) — what happened today. One sentence. No preamble.
2. **The Evidence** (2–3 paragraphs) — the quote, the stat, the clip. Prove it. Not opinions — receipts.
3. **The Verdict** (1 sentence) — close like a gavel. One line that the audience will screenshot.

**The FTL Daily Voice:**
Sharp, punchy, and relentlessly forward-moving. The urgency of a breaking news desk with the specificity of a film room. Takes from Rachel DeMita's pulse on fan culture and Mick Talks Hoops' cold analytical rigor — but strips away Rachel's parasocial venting and Mick's livestream rambling. The narrator is not a friend, not a personality — it's an insider briefing Clark fans on what happened today and what it means for her.

**Voice rules:**
- Open with a cold declarative thesis — the take, not the setup. Never a greeting.
- Short, punchy, declarative sentences. No "I think." No filler.
- Frame stakes around fan expectations and Clark's trajectory — not personal anecdotes.
- Back opinions with actual numbers, quotes, or specifics (salary cap math, stat lines, real quotes).
- One standalone reaction line in the middle ("Read that again." "Nobody is talking about this." "That's the whole story.")
- Close on what it means for Clark — one line, no summary.
- No sign-off on Daily Takes.

**Sample Daily Take voice (use as reference):**
> The Indiana Fever have a massive math problem, and running it back simply isn't an option. Despite the front office quietly adding Kelsey Mitchell back to the 2026 roster, the salary cap reality paints a brutal picture. With Caitlin Clark locked in and Aliyah Boston commanding a max extension, a supermax for Mitchell drains the war room dry. If Indiana cores Mitchell, they are left filling out half their roster with veteran minimums — sacrificing depth pieces like Sophie Cunningham or Lexie Hull to the open market. While fans want the chemistry of last year's playoff run, the Fever's front office is staring down a financial cliff. To build a true dynasty around Clark, somebody from the core has to go.

**Title format for Daily Takes:**
Same rules as Documentary — Clark's name in the title, yellow word, villain-first or Clark-positive framing. Shorter titles work better for daily: "Clark's Injury Report Just Changed Everything" or "The WNBA Just Made A Massive Mistake."

**Thumbnail for Daily Takes:**
Format D only. One Gemini variation. No iteration — first good image ships.

**Production pipeline:**
```
1. Story identified → Clark perspective angle locked (5 min)
2. Script written — 400–500 words (20 min)
3. Fact-checked with Codex (5 min)
4. Thumbnail generated — one Format D variation (10 min)
5. VO generated — ElevenLabs, single chunk under 5000 chars (5 min)
6. Render — minimal, no heavy B-roll (10 min)
```

**Daily Take topics to cover:**
- Game recaps (same night or next morning)
- Trades, signings, waivers — what it means for Clark
- Injury reports — Clark's or key Fever players
- WNBA league decisions, rule changes, fines
- Rival team news filtered through Clark's championship path
- Reactions to other creators (Rachel DeMita, Hoop Reports) — when they get it wrong or miss the real story
- Clark quotes or press conferences from that day

---

## FTL Documentary — Full Pipeline

**Every new video must follow this order. Do not skip ahead.**

### Step 0 — Lock the title and thumbnail concept FIRST

Before any research or scripting, the title and thumbnail concept must be fully decided.

**Title rules:**
- Caitlin Clark's name must appear in every title — even when the story is about the Indiana Fever team
- The title format must be borrowed from a proven high-performing NBA/WNBA channel video (300K+ views)
- Check `https://www.youtube.com/@fromthelogo22` with yt-dlp to confirm this topic hasn't been covered already
- **The title must contain one standout word that becomes the yellow thumbnail overlay.** Pick that word first — then write the title around it. The word should be punchy, one concept, all caps energy: GENIUS, SECRETLY, EVERYTHING, EXPOSED, BACKFIRED, PROBLEM, AFRAID, NIGHTMARE. The title is written to make that word land.

**Examples of title ↔ yellow word alignment:**
| Yellow word | Title |
|---|---|
| GENIUS | This Caitlin Clark Commercial is GENIUS |
| SECRETLY | Caitlin Clark's Offseason Secretly Changed Everything |
| EXPOSED | The Day Sheryl Swoopes Was EXPOSED as a LIAR |
| BACKFIRED | The WNBA Just Fined Sophie.. But it Backfired Spectacularly |
| NIGHTMARE | The Day Caitlin Clark and The Indiana Fever Became The WNBA's Worst Nightmare |

The yellow word is the hook that stops the scroll. The title explains it. They are one system — design them together.

**Thumbnail format — FTL Standard (Format D):**

Every thumbnail follows this exact formula, proven by the "This Caitlin Clark Commercial is GENIUS" video:
- **Clark's face close-up** fills the left 60% of the frame — face and upper chest only
- **Dark background** — near-black with deep navy or teal bokeh blur
- **One bold yellow word** on the right side, large heavy condensed sans-serif, color `#FFE84D`
- **Zero clutter** — no speech bubbles, no split screens, no extra text, no graphic elements
- **Expression** — smiling, laughing, or joyful. Head tilt optional. Eyes lit up. The expression carries the emotion.

The only variable between videos is the **yellow word** (derived from the title) and the **specific expression**. Everything else stays the same.

**Generating thumbnails:**
Use Gemini only (not OpenAI) via `generate.py`. Write a brief for each expression variation you want to test.

```bash
python3 ~/.claude/skills/ftl-thumbnail/generate.py ~/transcripts/thumbnail-SLUG.txt gemini "Video Title"
```

Generate 2–3 expression variations (e.g. laughing, intense smirk, knowing smile) and serve them on port 4444 for review.

Reference: `~/ftl-thumbnails/clark-reference/hires/` — use `press-2-smiling.jpg` and `press-5-celebration.jpg` as primary refs for smiling/laughing expressions.

Only proceed to Step 1 once title and thumbnail concept are confirmed by the user.

---

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

### The Two FTL Video Formats

Every video must fit one of these two formats before any research or scripting begins. If it doesn't fit either — it's not a FTL video.

**Format 1 — The Courtroom Drama** (ceiling: 1M+)
Requires: Villain + Slight + Response. The audience arrives with a verdict; your job is to organize their existing belief into a satisfying case with receipts.
- Villain named before the 30-second mark
- The slight: a quote, a foul, a ranking, a bad call, a coach decision
- The response: Clark or the Fever answers through basketball
- Examples: "The Day Caitlin Clark DEMOLISHED her BIGGEST Rival" (2M), "The Day Sheryl Swoopes was EXPOSED as a LIAR" (1M)
- Yellow word: DEMOLISHED, EXPOSED, HUMBLED, BACKFIRED, WRONG, DISRESPECTED

**Format 2 — The Awe/Spectacle** (ceiling: 200K+)
Requires: One genius/unmissable thing Clark did, framed as something you have to see. No villain needed — underestimation itself is the antagonist.
- Opens with the play, skill, or moment
- Frames it as historic, unprecedented, or unforgettable
- Examples: "This Caitlin Clark Commercial is GENIUS" (217K), "This Caitlin Clark Play Deserves An AWARD" (204K), "This Caitlin Clark Skill is SPECTACULAR" (204K)
- Yellow word: GENIUS, SPECTACULAR, UNREAL, INSANE, AWARD, DIFFERENT

**Filter every idea before starting:** Ask "Is there a villain, a slight, and a response?" → Format 1. Ask "Is there one genius/unmissable moment?" → Format 2. Neither → not a FTL video.

---

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

Target: **1,200–1,400 words** (approx. 8 minutes at narration pace). Do not submit a script under 1,200 words — expand sections, deepen the stat context, or add a second villain beat until the count is met.

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
