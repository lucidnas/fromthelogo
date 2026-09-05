#!/usr/bin/env bash
set -euo pipefail

: "${FTL_PRODUCTION_DIR:?Set FTL_PRODUCTION_DIR to the prepared production directory}"

test -f "$FTL_PRODUCTION_DIR/ASSET-CHECKSUMS.sha256"
# The bundle is built on macOS; its manifest lists AppleDouble "._*" xattr sidecars
# that GNU tar extracts differently. Every real asset is still checked strictly.
(cd "$FTL_PRODUCTION_DIR" && grep -v '/\._' ASSET-CHECKSUMS.sha256 | sha256sum --check --strict -)
test -f "$FTL_PRODUCTION_DIR/audio/chronological-recap-v5-josh-normal/vo-master-postgame-final.mp3"
test -f "$FTL_PRODUCTION_DIR/edl.json"
test -f "$FTL_PRODUCTION_DIR/sources/official/postgame/USA-Basketball-mWNTPDreG1k.mp4"

node build-clean-base.mjs
node generate-composition.mjs
npm run check
# 3 workers on this 4-vCPU / 15 GB VM: one core left for encode/OS, enough RAM for 3 Chromes.
npm run render -- --quality high --workers 3 --output renders/caitlin-clark-vs-china-8min-hyperframes.mp4
# HyperFrames high encode defaults to keyint 250 (8.33s). Conform labeled video to GOP 30; copy audio.
labeled="renders/caitlin-clark-vs-china-8min-hyperframes.mp4"
ffmpeg -y -hide_banner -loglevel error -i "$labeled" \
  -c:v libx264 -preset veryfast -crf 15 -r 30 -g 30 -keyint_min 30 -pix_fmt yuv420p \
  -c:a copy -movflags +faststart -frames:v 14460 \
  "${labeled}.gop30.mp4"
mv "${labeled}.gop30.mp4" "$labeled"
node cloud-qc.mjs
mkdir -p artifacts
cp renders/caitlin-clark-vs-china-8min-clean.mp4 artifacts/
cp renders/caitlin-clark-vs-china-8min-hyperframes.mp4 artifacts/
cp renders/qc-manifest.json artifacts/
