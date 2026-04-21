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

### Step 6 — Generate and deploy

Once the script is approved:
1. Paste into the fromthelogo app at `/scripts` — hit Regenerate if needed
2. Generate ElevenLabs audio via the script reader at port 4317
3. Use the generated audio + B-roll for the final video

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
