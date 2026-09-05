#!/usr/bin/env bash
set -euo pipefail

repo="lucidnas/fromthelogo"
tag="ftl-caitlin-china-ffmpeg-revision-6-v1"
if ! gh release view "$tag" --repo "$repo" >/dev/null 2>&1; then
  gh release create "$tag" --repo "$repo" --target codex/caitlin-china-hyperframes \
    --title "FTL Caitlin Clark vs China FFmpeg revision 6" \
    --notes "Cursor Cloud FFmpeg render. Full-screen college/WNBA/USA proof clips with original commentator calls, approved 16:9 stat and result graphics, full-screen TISSOT MVP poster, Josh 1.00x, and continuous pre-action freeze-to-slow-motion analysis."
fi
gh release upload "$tag" --repo "$repo" --clobber \
  artifacts/caitlin-clark-vs-china-8min-ffmpeg-revision-6.mp4 \
  artifacts/qc-manifest-revision-6.json
