# FTL Hyperframes Video Process

Use this process for Caitlin Clark / Indiana Fever analysis videos that need precise clip matching, fair-use-oriented editing, and film-room graphics.

## 1. Source Official Footage

- Use `yt-dlp` first for every YouTube lookup or download.
- Prefer official WNBA, Indiana Fever, team, and league accounts.
- Save full highlights to `/Volumes/SSK SSD/broll/aroll/{slug}/`.
- Preserve the original source file. Cut working clips into versioned folders, but do not assume the newest cut folder is the best footage.
- Use X/social clips as A-roll when they contain the exact play with useful source/announcer audio.
- Use the highest-quality source video or verified `cuts/` / v1 clips for silent B-roll and film-room analysis inserts.
- Avoid using poor-quality `cuts-v2` clips as primary action footage when the source or social version is cleaner.

### YouTube 403 / SABR fallback

If the default `yt-dlp` command fails with `403 Forbidden`, SABR, or HLS fragment errors, check whether the shell is using the older pyenv shim. Prefer the Homebrew binary and retry with Chrome cookies plus the downgraded/default TV client:

```bash
which yt-dlp
/opt/homebrew/bin/yt-dlp --version

/opt/homebrew/bin/yt-dlp \
  --cookies-from-browser chrome \
  --extractor-args "youtube:player_client=default,-tv" \
  -f "300-21/300/18" \
  --merge-output-format mp4 \
  -o "/Volumes/SSK SSD/broll/aroll/{slug}/youtube-source-%(id)s.%(ext)s" \
  "YOUTUBE_URL"
```

Test the method on a short range before pulling the full file:

```bash
/opt/homebrew/bin/yt-dlp \
  --cookies-from-browser chrome \
  --extractor-args "youtube:player_client=default,-tv" \
  -f "300-21/300/18" \
  --download-sections "*0:00-0:08" \
  --force-keyframes-at-cuts \
  --merge-output-format mp4 \
  -o "/tmp/yt-test-%(id)s.%(ext)s" \
  "YOUTUBE_URL"
```

## 2. Ask Gemini For A Shot Map

Upload the full highlight to Gemini and request strict JSON:

- Every Caitlin Clark moment with source start/end.
- Game clock, quarter, score, jersey numbers, player names only when confirmed.
- Confidence and uncertainty fields.
- Recommended cuts for replay, slow motion, freeze frames, and telestration.

For questionable plays, cut a short target window and ask Gemini again. Do not let the script guess player names from memory.

## 3. Cut Verified Clips

Cut only the verified moments:

```bash
ffmpeg -y -ss START -i SOURCE.mp4 -t DURATION \
  -vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30,setpts=PTS-STARTPTS" \
  -an -c:v libx264 -preset veryfast -crf 18 -r 30 -g 30 -keyint_min 30 \
  -pix_fmt yuv420p -movflags +faststart OUTPUT.mp4
```

Generate contact sheets for visual QC. Ignore macOS `._*.mp4` sidecars.

## 4. Fix The Script Before VO

- ElevenLabs Johnny is the default VO provider for FTL film-room/clip-first videos.
- Voice ID: `jyskLvwz58RBB27YwdcR`.
- Do not use Gemini TTS for production VO on these videos.
- Generate with `tools/generate-elevenlabs-vo-single.mjs` for short beat/section VO, or `tools/generate-elevenlabs-vo-with-pauses.mjs` when the script includes explicit pause markers.
- Write the script so visuals are central and the VO leaves room for replays.
- Keep the VO in casual basketball speak. The viewer should hear a sharp Clark fan breaking down hoops, not an editor describing footage. Prefer "that bucket," "that moment," "this play," "the read," "watch it back," and "the possession." Avoid "the clip," "the sequence," "the segment," "visual," "asset," and "B-roll" in spoken lines.
- If a clip changes player identity, update the VO script before rendering. Do not rely on overlay text to correct a wrong spoken name.
- For this project, Gemini confirmed the behind-the-back pass is to Myisha Hines-Allen #2, not Aliyah Boston #7.

## 5. Build A Timestamped EDL

Save the active edit script to:

`/Volumes/SSK SSD/ftl/videos/{slug}/edit-script-gemini-v1.json`

Each cue should include:

- `start`, `end`, `beat`, `vo`
- `asset`, `assetPath`
- `treatment`
- `overlays`
- optional `graphics[]` for Hyperframes film-room annotations

Cadence rule:

- A moving clip should usually last 5-10 seconds max.
- If a cue runs longer than 10 seconds, it must be a deliberate freeze frame, still image, graphic board, or overlay-heavy analysis pause.
- When extending a play, use alternate angles first: live angle, replay, baseline/slow angle, social angle, then freeze-frame/graphics only if no new angle exists.
- Do not stretch one highlight under VO just because it technically matches the topic. The viewer should feel a new receipt every few seconds unless the edit is intentionally paused to teach.

Graphics support:

- `ring`: circle a player or gap
- `arrow`: show pass path, driving lane, help movement
- `line`: show spacing or pickup point
- `label`: add a short receipt or teaching point

## 6. Render With Hyperframes Only

Build from `local/ftl-render`:

```bash
cd /Users/abdul/code/fromthelogo/local/ftl-render
bun run build.ts {slug}
npx hyperframes lint
npx hyperframes inspect --samples 8
```

Do not use Remotion for FTL renders, previews, cue wiring, or edit-script wiring.

For complex analysis videos, render section by section and stitch only approved sections. A section render is the default review unit. Do not render the full 8-10 minute composition to inspect one repaired beat.

```bash
node ../../tools/create-section-render-input.mjs {slug} S01 0 49
FTL_FLAT_BACKGROUND=1 bun run build.ts {slug}-section-S01
node ../../tools/render-hyperframes-clean.mjs --quality draft --workers 1 \
  --output "/Volumes/SSK SSD/ftl/videos/{slug}/render/sections/S01-hook.mp4"
```

After each section render:

- make a contact sheet
- review the playable MP4 locally
- fix only that section's cues if needed
- verify the wrapper printed `[render-cleanup]`; do not use raw `npx hyperframes render` for FTL section work
- append approved sections to `render/sections/concat.txt`
- stitch the final video with ffmpeg concat, then add the low music bed

## 7. Fair-Use-Oriented Editing Rules

- Use short clips tied directly to analysis.
- Mute broadcast audio.
- Prefer replay/alternate angles for explanation.
- Moving clips should change every 5-10 seconds unless the edit is holding an intentional freeze frame, still image, graphic board, or overlay-heavy analysis pause.
- Alternate angles are the first choice when avoiding repetition; they are stronger than replaying the same broadcast shot.
- Add freeze frames, arrows, rings, labels, clock/score receipts, and teaching-board pauses.
- Repeating a clip is only acceptable if each repeat reveals new information.
- Do not make a raw highlight reel with commentary on top.
