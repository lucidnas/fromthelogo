#!/usr/bin/env bash
set -euo pipefail

repo="lucidnas/fromthelogo"
tag="ftl-caitlin-china-ffmpeg-revision-5-v1"
if ! gh release view "$tag" --repo "$repo" >/dev/null 2>&1; then
  gh release create "$tag" --repo "$repo" --target codex/caitlin-china-hyperframes \
    --title "FTL Caitlin Clark vs China FFmpeg revision 5" \
    --notes "Cursor Cloud FFmpeg render. Earlier pre-action freezes, slow motion through every made-basket payoff, official MVP imagery, and college/WNBA/USA stage progression."
fi
gh release upload "$tag" --repo "$repo" --clobber \
  artifacts/caitlin-clark-vs-china-8min-ffmpeg-revision-5.mp4 \
  artifacts/qc-manifest-revision-5.json
