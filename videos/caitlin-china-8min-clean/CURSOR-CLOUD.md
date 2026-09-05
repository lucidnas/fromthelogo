# Cursor Cloud render handoff

Cursor Cloud Agents clone the Git repository, so the composition, manifest-driven clean-base builder, and render command live here. FFmpeg performs only source cuts, five-second freeze preprocessing, slow motion, and the final 480-second conform. It adds no text. HyperFrames owns all labels in `index.html`.

Required cloud input: the complete, checksummed `caitlin-china-render-bundle-v2.tar.gz`. It contains the canonical EDL, both official sources, final Josh master/chunks, alignment, music, script, and truth evidence.

Preferred source transfer:

```bash
mkdir -p /tmp/ftl-caitlin-china-production
gh release download ftl-caitlin-china-assets-v1 \
  --repo lucidnas/fromthelogo \
  --pattern caitlin-china-render-bundle-v2.tar.gz \
  --dir /tmp/ftl-caitlin-download
echo 'e8c568917226b533a51e559d1663c395efc1a45571bbe69e72a62d250ff43d3b  /tmp/ftl-caitlin-download/caitlin-china-render-bundle-v2.tar.gz' | sha256sum --check
tar -xzf /tmp/ftl-caitlin-download/caitlin-china-render-bundle-v2.tar.gz -C /tmp/ftl-caitlin-china-production
(cd /tmp/ftl-caitlin-china-production && sha256sum --check ASSET-CHECKSUMS.sha256)
export FTL_PRODUCTION_DIR=/tmp/ftl-caitlin-china-production
```

Run `./render-cloud.sh` after assets are present, followed by `bash publish-results.sh`. Outputs are the clean master, HyperFrames-labeled master, and QC manifest.

Cursor authentication is configured for the FTL account. Cursor Cloud is a render worker only, matching the existing Modal render-job pattern. It must consume the supplied, final, checksummed narration and timing package; it must not generate, rewrite, transform, or editorially revise voiceover. All video assembly, HyperFrames rendering, and encoded QC run in Cursor Cloud. Do not render or encode video locally.

Revision requirements:

- Use the bundled approved FTL Josh Australian narration exactly as supplied.
- Verify every narration chunk against the bundle checksum manifest before rendering.
- Derive the edit timeline from the supplied measured chunk durations.
- Never apply global `atempo`, time compression, pitch adjustment, or other transformation to narration.
- Remove unintended dead silence. Use only 0.3–0.6 second spoken transitions; carry ducked native game audio through longer visual intervals.
- Keep the longer decision freeze before each scoring or assisted play, followed by the relevant action in slow motion.
- Do not speak editing cues such as “freeze it,” “pause here,” or “watch this.” The narration states the basketball read directly.
- Render two otherwise identical comparison masters: one with all labels authored by HyperFrames and one with no text layer at all.
- Do not use FFmpeg `drawtext`, ASS, subtitles, or any other baked text filter.
- Let the runtime land naturally near eight minutes. Do not force an exact 480 seconds by speeding up narration.

Publish completed work to a separate GitHub prerelease named `ftl-caitlin-china-results-v1`. Attach the labeled master, the text-free master, and a JSON QC manifest containing duration, resolution, codecs, file sizes, SHA-256 hashes, silence findings, and A/V-sync findings. Never overwrite or attach results to the source-assets release.

Also copy both full-resolution MP4 masters and the QC manifest into the Cloud Agent's `artifacts/` directory so Cursor uploads them as native Cursor artifacts. Verify they appear in the agent artifact listing and record the Cursor artifact paths and `sizeBytes` in the QC manifest. GitHub Release assets remain the durable canonical copies; Cursor artifacts are an explicit size-and-download-path test and must not be the only copies.
