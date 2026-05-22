# Caitlin Clark 1,000 Points - Section Repair Plan

Slug: `caitlin-clark-1000-wnba-point-genius`

Working rule: repair and QC one section at a time, then stitch approved sections into the final. Do not regenerate Johnny VO unless a spoken error cannot be fixed visually. Do not use `cuts-v2`.

## Source Rules

- A-roll: X/social clips when they contain the exact play and useful source/announcer audio.
- B-roll / analysis inserts: highest-quality source video or verified `cuts/` v1 files.
- ESPN 5:51 source is available at:
  `/Volumes/SSK SSD/broll/aroll/caitlin-clark-1000-wnba-point-genius/youtube-espn-season-opener-thriller-paige-vs-caitlin-4Yf9X2JSDYI.mp4`
- Current active edit script:
  `/Volumes/SSK SSD/ftl/videos/caitlin-clark-1000-wnba-point-genius/edit-script-johnny-v2.json`

## Sections

| Section | Time | Status | Main Job | Notes |
|---|---:|---|---|---|
| S01 Hook | 00:00-00:49 | Needs polish | Make the opening feel sharp, not repetitive. Keep the record moment, animate CTA image, use high-quality v1/source or X only. | Low-quality `cuts-v2` is removed, but the hook still leans on repeated 1,000-point footage. |
| S02 Receipts Menu | 00:49-01:48 | Repaired, needs review | VO names each action, then pause and show the full matching action with source audio. | This is the v5 expanded receipt section. |
| S03 First Bucket / Defender Dilemma | 01:48-03:03 | Needs fix | Show how early drives create the defender problem. Add freeze/telestration: `BACK UP = JUMPER`, `CLIMB HIGH = LANE`. | Gemini issue #2 lives here, especially 02:00-02:36. |
| S04 Range Proof | 03:03-04:43 | Mostly works | Show the two threes, 26-foot answer, 29-foot pressure, and box-score-vs-damage idea. | Use X/social for A-roll; source/v1 for silent analysis. |
| S05 Passing Proof | 04:43-05:37 | Mostly works | Behind-the-back pass and replay should clearly identify Myisha Hines-Allen #2. | Avoid Boston mislabel. Let the replay breathe. |
| S06 Final Possession Decision | 05:37-07:47 | Needs major fix | Freeze at 17.6 / 998, show the available logo pull-up, then show the smarter drive lane. | Gemini issue #3. This is the core thesis. |
| S07 Range Creates The Lane / Context | 07:47-08:39 | Needs fix | Connect deep-range fear to easy lanes, then transition into loss context. | Gemini issue #4. Flash 29-foot receipt before final lane receipt. |
| S08 Recap / Outro | 08:39-09:15 | Needs light QC | Recap should feel like a payoff, not another random montage. | Keep 1,000-point layup only if it has a new purpose. |

## Stitch Workflow

1. Repair one section in `edit-script-johnny-v2.json`.
2. Create a section-only render input with trimmed VO, trimmed flat background, and shifted cues:
   ```bash
   node tools/create-section-render-input.mjs caitlin-clark-1000-wnba-point-genius S01 0 49
   ```
3. Build and render that section only:
   ```bash
   cd local/ftl-render
   FTL_FLAT_BACKGROUND=1 bun run build.ts caitlin-clark-1000-wnba-point-genius-section-S01
   npx hyperframes render --quality draft --output "/Volumes/SSK SSD/ftl/videos/caitlin-clark-1000-wnba-point-genius/render/sections/S01-hook.mp4"
   ```
4. Make a contact sheet for the section.
5. Watch in browser/QuickTime and check:
   - VO claim matches the visible play.
   - No `cuts-v2`.
   - No player-name mismatch.
   - Clip is not repeated without a new teaching purpose.
   - Any raw broadcast/social audio is short and directly tied to analysis.
6. Once approved, export the section as:
   `/Volumes/SSK SSD/ftl/videos/caitlin-clark-1000-wnba-point-genius/render/sections/SXX-name.mp4`
7. Stitch approved sections with ffmpeg concat, then add Illusions at `-15dB`.

## Stitch Command Shape

```bash
ffmpeg -y -f concat -safe 0 \
  -i /Volumes/SSK\ SSD/ftl/videos/caitlin-clark-1000-wnba-point-genius/render/sections/concat.txt \
  -c copy \
  /Volumes/SSK\ SSD/ftl/videos/caitlin-clark-1000-wnba-point-genius/render/final-section-stitched-no-music.mp4
```

Then add the low music bed:

```bash
ffmpeg -y \
  -i /Volumes/SSK\ SSD/ftl/videos/caitlin-clark-1000-wnba-point-genius/render/final-section-stitched-no-music.mp4 \
  -stream_loop -1 -i /Volumes/SSK\ SSD/Downloads/Illusions\ -\ Anno\ Domini\ Beats.mp3 \
  -filter_complex "[1:a]volume=-15dB[m];[0:a][m]amix=inputs=2:duration=first:normalize=0[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -movflags +faststart \
  /Volumes/SSK\ SSD/ftl/videos/caitlin-clark-1000-wnba-point-genius/render/final-section-stitched.mp4
```
