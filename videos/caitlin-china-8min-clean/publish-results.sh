#!/usr/bin/env bash
set -euo pipefail
repo="lucidnas/fromthelogo"
tag="ftl-caitlin-china-results-v1"
if ! gh release view "$tag" --repo "$repo" >/dev/null 2>&1; then
  gh release create "$tag" --repo "$repo" --target codex/caitlin-china-hyperframes --title "FTL Caitlin Clark vs China render results v1" --notes "Cursor Cloud render outputs. Clean and HyperFrames-labeled masters share the canonical truth-approved EDL." --prerelease
fi
gh release upload "$tag" --repo "$repo" --clobber \
  renders/caitlin-clark-vs-china-8min-clean.mp4 \
  renders/caitlin-clark-vs-china-8min-hyperframes.mp4 \
  renders/qc-manifest.json
