<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# From The Logo — Channel Overview

FTL is a faceless YouTube channel covering the WNBA every day from the Caitlin Clark and Indiana Fever perspective. Every story — trades, games, league decisions, rival teams, drama — gets filtered through one question: **what does this mean for Caitlin Clark?**

**Channel positioning:** FTL is Rachel DeMita's coverage — but faceless. Same topics, same fan-first energy, same daily cadence. The difference is there's no face, no parasocial personality. The narrator is just a passionate Clark fan telling you what happened today and what it means for her. Conversational, direct, opinionated — not cinematic or documentary-style.

**Primary format: Clark Celebration.** This is the channel's identity. Every research session, every script idea, every thumbnail brief starts here. The "THIS Caitlin Clark ___ is ___" pattern is what builds loyal subscribers and consistent views — it's also what the Shorts strategy is already doing, and the views are confirming it.

| Format | Priority | Cadence | Length | Track record |
|---|---|---|---|---|
| **Clark Celebration** ← default | Primary | Multiple per week — whenever a clip-worthy CC play, ad, skill, dribble, or pass surfaces | 4–6 min | 217K, 204K, 204K, 179K, 94K, 43K, 38K, 15K floor — consistent and loyal |
| **Refs / Fines / Villain Reaction** | Opportunistic only | When a real fine, tech, foul, or league decision actually drops | 5–8 min | 343K, 220K, 211K, 130K, 108K — high ceiling, but only when there's a real artifact to react to |
| **Game Recap (villain-response framing)** | Opportunistic only | Game day or next morning, only for noteworthy games | 5–8 min | 152K, 94K, 69K, 61K |
| **FTL Documentary** | Rare | ~1 per month max, only for genuinely big narrative moments | 8–10 min | Recent docs landed at 490 and 698 views — underperforms |
| **News Recap (trending-story, image-led)** | Daily/opportunistic | When the day's story is a news beat (quote, ruling, report, social post) rather than a clip-worthy play | 4–6 min | New lane — additional, not a replacement |

**Operating rule:**
1. Research sessions default to Clark Celebration angles — find the clip, the play, the commercial, the skill, the moment that deserves an awe word.
2. Refs/fines/game-recap videos are reactive only. Do NOT go looking for them. If a real Sophie fine, Clark tech, or signature win happens that day, drop the Celebration plan and cover it. Otherwise, stay on Celebration.
3. The "THIS Caitlin Clark ___ is ___" title pattern is the channel's most reliable hook. Use it freely — GENIUS, AWARD, SPECTACULAR, PURE ART, NEXT LEVEL, INSANE, UNREAL, DIFFERENT.

**Yellow word library for Celebration format:** GENIUS, SPECTACULAR, UNREAL, INSANE, AWARD, DIFFERENT, ART, NEXT LEVEL, ELITE, MASTERFUL.

---

## Format-Specific Playbooks

Each FTL production lane has its own doc. Load the one that matches the work; do not pre-load all of them.

- [Clip-First Celebration](docs/formats/clip-first-celebration.md) — default formula for Clark game/play breakdowns. Manifest-driven, Johnny VO, Hyperframes.
- [Increasingly Compilation](docs/formats/increasingly-compilation.md) — 8-minute one-clip-per-unique-game assist/pass/threes/handles compilations. Minimal VO, Hyperframes finishing.
- [Shorts](docs/formats/shorts.md) — 9:16 daily Caitlin Clark Shorts. Music-bed, 10–30 sec, clean-clip library first.
- [Daily Take](docs/formats/daily-take.md) — same-day 400–500 word reactive takes. Johnny VO, minimal B-roll.
- [Reaction Commentary](docs/formats/reaction-commentary.md) — **DEFAULT commentary format.** Opinion/reaction/news videos carried by clips + our take. Casual flowing FTL fan voice, reaction rhythm (commentary-over-clip → clip-with-audio), captions on clip soundbites only, community-reaction wall, Johnny VO. Tooling: `tools/ftl-reaction-build.py` + `tools/ftl-reaction-captions.py`.
- [Reaction Video](docs/formats/reaction-video.md) — ChazNBA-style reaction frames, Clark-lensed. 60–180 sec mini-reactions.
- [Documentary](docs/formats/documentary.md) — rare, full 8-step pipeline. Title-and-thumbnail-first, 1,200–1,400 word script, RoastMyVideo gate.
- [News Recap](docs/formats/news-recap.md) — trending-story, image-led 4–6 min videos. Scan the outlets + CC/Sophie social, sensational-but-factual title, Johnny VO, hybrid visuals (AI images + factual receipt cards + Caitlin Clark b-roll, still and moving), Hyperframes. Use the `ftl-news-recap` skill.

CLAUDE.md keeps the short operational reminders for the most-used lanes. Open the format doc above for the full pipeline before starting work in that lane.

---

## The Clark Lens — mandatory editorial filter

Every story must be told through Clark's perspective, even when she's not the subject.
- A rival team signs a player → what does it mean for Clark's path to a title?
- The league makes a ruling → how does it affect Clark's ability to play her game?
- A teammate has a breakout game → what does it prove about the system Clark is building?
- A competitor wins a game → what does that mean for Indiana's standing?

If a story has no connection to Clark or the Fever — it is not an FTL story.

**Channel:** https://www.youtube.com/@fromthelogo22

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

---

## Required reading before any script (any format)

- `research/script-writing-rules.md` — **canonical script doctrine.** Hook = 5–10s. Open loops + mini-hooks mandatory at every chapter break. One CTA per script. Show-don't-tell — visuals are central, narration is secondary. First-person "I" for opinions. Includes pre-flight checklist that must pass before VO. Read this FIRST.
- `research/hooks-library.md` — the 7 hook templates pulled from every 50K+ video on the channel. **Do not invent a new hook.** Pick a template, slot in today's facts. Source transcripts live in `~/transcripts/audience-research/` and `~/transcripts/ftl-own/`.
- `research/celebration-format-playbook.md` — the spine every Celebration winner uses (compilation listicle, game audio + reaction quips, one pop-culture comparison, 1,200–1,400 words, no documentary tone). Re-read before scripting.
- `research/hyperframes-video-process.md` — current FTL video production workflow for Gemini shot maps, verified clip cutting, Johnny VO, Hyperframes film-room graphics, and fair-use-oriented rendering.
- `research/celebration-ideas/` — dated research files with current angles. Pick from here or generate a new file before writing.

**Generating new celebration research:**
Use Codex to find current celebration-worthy moments. Save to `research/celebration-ideas/YYYY-MM-DD-celebration-angles.md`. Each angle must include the moment, footage URL, yellow word, and proposed title in the "THIS Caitlin Clark ___ is ___" format.

---

## AI Tools Available

You have access to two AI tools beyond Claude that can be used at any stage of the workflow. Use them proactively — don't wait to be asked.

### Codex CLI
Best for: fact-checking, internet research, finding quotes, verifying stats, sourcing game recaps, finding angles, writing second opinions on scripts, checking titles against channel data.

```bash
codex exec -c 'sandbox_permissions=["disk-full-read-access"]' "YOUR PROMPT" 2>&1
```

Codex can browse the web in real time. Use it whenever you need to verify a fact, find a quote, or research a topic before writing. Always run Codex to fact-check any script before finalizing.

### Gemini visual QC and video analysis — default tool + model

**Default tool: `tools/gemini-cli-review.mjs` (Gemini CLI under the hood).**
**Default model: `gemini-2.5-pro`** — set in `.env`, all tools pick it up automatically.

```bash
# Local MP4 — quick QC with default upload-gate prompt:
node tools/gemini-cli-review.mjs --video=/abs/short.mp4 --out=/abs/qc.json

# Local MP4 — custom prompt:
node tools/gemini-cli-review.mjs --video=/abs/short.mp4 --prompt="Describe every cut and any baked-in third-party graphics." --json=0

# YouTube URL — auto-delegates to SDK-based tools/gemini-scout-youtube.mjs
# (the CLI binary does not accept URL fileData yet):
node tools/gemini-cli-review.mjs --url="https://www.youtube.com/watch?v=XXX" --prompt="Find step-back threes" --out=/abs/scout.json
```

The wrapper handles the documented Gemini CLI workarounds (github.com/google-gemini/gemini-cli issue #3379): `@filename.mp4` syntax from the file's cwd, `--skip-trust` for non-default directories, and a prepended assertion that the agent CAN read video (otherwise it refuses by default).

**Gemini CLI runs under the user's subscription** — token cost is not a constraint. Use `tools/gemini-cli-review.mjs` as the default for any video QC or video analysis task. The SDK-based `tools/gemini-review-ftl-shorts-batch.mjs` is a fallback for the rare case where the CLI workarounds break.

**Where the `gemini-2.5-pro` default applies:**
- Rendered-video upload-gate QC, YouTube URL scouting via `fileData.fileUri`, highlight-game identification, assist-timestamp mapping, freeze-frame planning, visual editorial audits, blind clip review, and any other tool that has Gemini *watch* video.
- Does NOT apply to: TTS generation, thumbnail image generation, script text analysis — those keep their own model defaults.

**Do NOT use** `gemini-3.1-flash-lite-preview` or `gemini-3.1-pro-preview` for upload-gate QC. Flash Lite under-reports issues (rubber-stamps); 2.5 Pro is cheaper than 3.1 Pro Preview while catching the same or more issues.

Override with `--model gemini-X.Y-name` per tool when intentionally A/B-testing.

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
| Thumbnail image generation | Gemini only (see Documentary Step 0) |

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

---

## News Recap lane — build notes / gotchas (2026-06-13)

- **`ftl-script-pipeline.mjs --mode news`** makes `--clips` optional and targets 600–950 words. The
  news draft prompt enforces sensational-but-factual + outlet attribution and reuses the same
  required signoff as celebration.
- **RoastMyVideo step is flaky:** `runRoast` sometimes throws `Unterminated string in JSON at
  position ~8192` parsing the `bun -e` output from `~/code/roastmyvideo`. It is now NON-FATAL in
  the script pipeline (the draft is already written; the run continues). Not specific to news mode.
- **Fact-check is the hard gate and it works:** Codex caught a real error in the first news draft —
  the WNBA suspension threshold is the **8th** technical (auto one-game suspension, then every ~2
  after), not "beyond the seventh." The Athlon source phrasing ("beyond the seventh") is ambiguous;
  prefer the explicit 8th-technical rule and attribute. `passGate` now requires an explicit
  `VERDICT: PASS` final line from the fact-check — a bare "PASS" in the prose is no longer enough.
- **Renderer Hyperframes bootstrap:** hyperframes is NOT installed in the repo. `ftl-render-news-recap.mjs`
  inits a local project per video via `npx -y hyperframes@latest init render --example blank
  --non-interactive --skip-skills` (same as the kinetic-video skill), then renders through
  `tools/render-hyperframes-clean.mjs` (cwd = `<video-dir>/render`) so leftover Chrome/ffmpeg die.
- **Receipt beats** render as factual headline/quote CARDS via codex-image-gen by default (clean +
  copyright-safe). Swap in the literal outlet screenshot only if you keep the on-screen attribution.

### News Recap — QC + render gotchas (from first end-to-end run)
- **whisper is not on PATH in the fromthelogo pyenv context.** `ftl-render-news-recap.mjs` resolves it
  from `~/.pyenv/versions/psych-channel/bin/whisper` (and 3.9.21 / 3.11.0-psych-channel envs), or set
  `WHISPER_BIN`.
- **Caption from the SCRIPT, not Whisper ASR.** Whisper base.en mishears proper nouns ("Aliyah"→"Alia",
  "Aliyah Boston"→"a LeBron", "Caitlin"→"Catlin"). The renderer borrows Whisper *timing* but uses the
  locked script text for caption words. This was a QC blocker on the first render.
- **broll-video beats must loop-fill the beat.** A short clip (4-6s) on a long beat (17-25s) left a BLACK
  SCREEN after it ended. The renderer now loop-extends each broll clip to the aligned beat duration
  (ffmpeg `-stream_loop -1 -t <beatDur>`, scaled/letterboxed to 1920x1080).
- **Receipt cards are NOT AI-drawn.** codex image_gen (gpt-image-2) cannot spell long exact headline/stat
  text; receipts are typeset with ffmpeg `drawtext` (font: Arial Bold) — guaranteed accurate + legible.
- **codex image_gen copy grabs the `._ig_*` AppleDouble** (4 KB) instead of the real PNG intermittently
  (macOS/exFAT). The beat builder validates PNG magic bytes and recovers the real `ig_*.png` from
  `~/.codex/generated_images/<session>/`. Also exclude `._*` files when scanning the b-roll library.
- **Do NOT QC with `tools/gemini-cli-review.mjs`** — it routes >20 MB videos to the Shorts batch reviewer,
  which fails any 4-6 min recap for exceeding 60s. Use `tools/ftl-news-recap-qc.mjs` (long-form).
- **Gemini visual QC is unreliable for CURRENT-EVENT FACTS** (knowledge cutoff). It "corrected" verified
  2026 stats to its 2024 memory. The QC prompt now tells Gemini NOT to fact-check stats/dates from its own
  knowledge — Codex's live-web fact-check in the script step is the fact authority; Gemini only judges
  legibility, spelling, visual match, framing, captions, pacing.

---

## YouTube Studio uploader (Playwright) — auth + upload gotchas (2026-07-03)

`tools/yt_studio_upload.py` uploads to the FTL brand channel and leaves videos as **drafts** (login / clone-profile / save-state / status / upload / verify / list modes). Run with `~/.pyenv/versions/tiktok-browser-agents/bin/python`. Proven end-to-end: a Short → Draft on the Shorts tab, a longform → Draft on the Videos tab.

**Why browser automation, not the API:** the brand account blocks API upload, AND the YouTube Data API v3 has NO "draft" privacyStatus (only public/private/unlisted), and unverified API projects get uploads force-locked private. So browser automation is the only path to a real draft. (Open-source survey: tiktoka-studio-uploader/ytb-up is the closest Python+Playwright match but bloated; fawazahmed0/youtube-uploader has an `uploadAsDraft` flag but is Node+password-login and fights bot-detection; linouk23 selenium is dead; 7x11x13/youtube-up is API-replay with no draft mode. Verdict: own ~200-line script.)

**Auth — the hard part (macOS Keychain):**
- Playwright launches Chrome with `--use-mock-keychain --password-store=basic`, so it CANNOT decrypt the real Chrome profile's cookies. Injecting yt-dlp-exported cookies via `add_cookies` also failed — Google's account-chooser rejected the session, and cloud/gemini subdomain cookies carry WebKit-epoch `expires` that Playwright rejects.
- **What works:** `clone-profile` rsyncs the real Chrome profile (Tales = Profile 3 holds @fromthelogo22) + `Local State` into an isolated user-data-dir, then launch `channel="chrome"` with `ignore_default_args=["--use-mock-keychain","--password-store=basic"]` so the REAL macOS Keychain decrypts the cloned session. Requires **headed** (GUI login session) — Allow the Keychain prompt once.
- **Headless does NOT work:** headless Chrome can't reach the Keychain, and `storage_state` JSON captured from the live session is rejected by Google's headless detection (bounces to accounts.google.com). So uploads run HEADED. save-state exists but the headless path is unreliable — treat headed as the supported mode.

**Upload dialog selectors (current Studio, changes often):**
- Create button = `[aria-label="Create"]` (the old `#create-icon` is gone) → click text "Upload videos" → `input[type=file]` appears (Playwright pierces shadow DOM) inside `ytcp-uploads-dialog`.
- Title/desc = the two `#textbox` elements. Not-made-for-kids = `tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]`.
- **Draft = upload the file, fill details, then CLOSE the dialog without assigning visibility.** Studio autosaves it as a draft. Confirm any "Save as draft" prompt.

**Completion polling (this bit hung the first runs):** `ytcp-video-upload-progress` `state` attribute is often empty (`-`). Do NOT loop on `.progress-label` — it returns empty → infinite loop until timeout (the raw upload finishes but the script never detects it; the draft still autosaves, which is why the first Short appeared despite the hang). Instead read `ytcp-uploads-dialog` inner_text: it goes `uploading N%` → `processing will begin shortly` / `checks complete`. Break when text shows processing/complete and no "uploading". Confirmed working on the longform (24%→98%→processing→closed clean, no hang).

**Content tabs are SEPARATE:** longform lives at `.../channel/UC.../videos/upload`, Shorts at `.../videos/short`. A Short draft ONLY shows on the Shorts tab — checking Videos alone will falsely report "not found". `verify`/`list` now read BOTH tabs.

- Channel: @fromthelogo22 = `UCvWdLRqA7R2Gggisxn4Xkhg`. Profile clone + shots + auth.json live under `/Volumes/SSK SSD/fromthelogo-cache/yt-uploader-*`.
- Minor: python stdout buffers to a pipe, so `state=` lines don't stream live until flush/exit — fine, just don't expect live progress in a `| tail` monitor.

**SEO metadata auto-fill (2026-07-03):** `tools/ftl_meta.py generate --file F --kind short|long` derives title/description/tags FROM the video's bank entry (source channel, soundbite quote, topic in `/Volumes/SSK SSD/clip-library/ftl-shorts-bank.db`) and optimizes for BOTH YouTube surfaces via Codex (live web) — Search (front-loaded "Caitlin Clark", search-intent phrasing, keyword-rich first description line, long-tail tags) and Browse/Suggested (curiosity hook + co-associated entities + hashtags). Deterministic template fallback if Codex fails. `yt_studio_upload.py upload --auto` calls it (auto-detects short vs long by aspect+duration), fills title+description+not-made-for-kids, and fills the Tags field via "Show more" -> `#tags-container input` (comma-typed chips). Proven: Nightcap short auto-generated "Caitlin Clark Throat Hit: Nightcap Says the Physics Don't Add Up #shorts" + 16 tags, left as Draft.
