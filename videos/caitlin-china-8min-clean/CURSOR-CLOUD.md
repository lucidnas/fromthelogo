# Cursor Cloud render handoff

Cursor Cloud Agents clone the Git repository, so the composition, manifest-driven clean-base builder, and render command live here. FFmpeg performs only source cuts, five-second freeze preprocessing, slow motion, and the final 480-second conform. It adds no text. HyperFrames owns all labels in `index.html`.

Required cloud inputs:

- A prepared production directory containing `selected-play-manifest-v2.json` and the 17 approved narration chunks.
- `FTL_PRODUCTION_DIR` pointing to that directory.
- A reachable source video, supplied with `FTL_SOURCE_VIDEO` when the manifest's local SSD path is unavailable.

Preferred source transfer:

```bash
gh release download ftl-caitlin-china-assets-v1 \
  --repo lucidnas/fromthelogo \
  --pattern FIBA-4mhTX8ETAeY.mp4 \
  --dir assets/source
echo 'ff4bc48c38a2a6f980758b23157503c7d93d5db138840bfaf255c03248efbc61  assets/source/FIBA-4mhTX8ETAeY.mp4' | sha256sum --check
```

Set `FTL_SOURCE_VIDEO=assets/source/FIBA-4mhTX8ETAeY.mp4` after verification.

Run `./render-cloud.sh` after assets are present. The final artifact is `renders/caitlin-clark-vs-china-8min-hyperframes.mp4`.

Cursor authentication is configured for the FTL account. All narration regeneration, media processing, alignment, HyperFrames rendering, and QC must run in Cursor Cloud. Do not render or encode locally.

Revision requirements:

- Regenerate the approved FTL Josh Australian voice at natural speed. Never apply global `atempo` or other time compression to narration.
- Derive the edit timeline from the regenerated chunk durations.
- Remove unintended dead silence. Use only 0.3–0.6 second spoken transitions; carry ducked native game audio through longer visual intervals.
- Keep the longer decision freeze before each scoring or assisted play, followed by the relevant action in slow motion.
- Do not speak editing cues such as “freeze it,” “pause here,” or “watch this.” The narration states the basketball read directly.
- Render two otherwise identical comparison masters: one with all labels authored by HyperFrames and one with no text layer at all.
- Do not use FFmpeg `drawtext`, ASS, subtitles, or any other baked text filter.
- Let the runtime land naturally near eight minutes. Do not force an exact 480 seconds by speeding up narration.

Publish completed work to a separate GitHub prerelease named `ftl-caitlin-china-results-v1`. Attach the labeled master, the text-free master, and a JSON QC manifest containing duration, resolution, codecs, file sizes, SHA-256 hashes, silence findings, and A/V-sync findings. Never overwrite or attach results to the source-assets release.

Also copy both full-resolution MP4 masters and the QC manifest into the Cloud Agent's `artifacts/` directory so Cursor uploads them as native Cursor artifacts. Verify they appear in the agent artifact listing and record the Cursor artifact paths and `sizeBytes` in the QC manifest. GitHub Release assets remain the durable canonical copies; Cursor artifacts are an explicit size-and-download-path test and must not be the only copies.
