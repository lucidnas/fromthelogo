#!/usr/bin/env bash
set -euo pipefail

: "${FTL_PRODUCTION_DIR:?Set FTL_PRODUCTION_DIR to the prepared production directory}"

test -f "$FTL_PRODUCTION_DIR/ASSET-CHECKSUMS.sha256"
(cd "$FTL_PRODUCTION_DIR" && grep -v '/\._' ASSET-CHECKSUMS.sha256 | sha256sum --check --strict -)
test -f "$FTL_PRODUCTION_DIR/edl.json"
test -f "$FTL_PRODUCTION_DIR/sources/official/FIBA-4mhTX8ETAeY.mp4"
test -f "$FTL_PRODUCTION_DIR/sources/official/postgame/USA-Basketball-mWNTPDreG1k.mp4"
test -f "$FTL_PRODUCTION_DIR/sources/official/awards/u19-2021-mvp.png"
test -f "$FTL_PRODUCTION_DIR/sources/official/awards/san-juan-2026-mvp-trophy.jpg"
test -f "$FTL_PRODUCTION_DIR/sources/stage-progression/college-iowa-deep-three-i7aM979td7w.mp4"
test -f "$FTL_PRODUCTION_DIR/sources/stage-progression/wnba-fever-deep-three-jANcTPAOIYQ.mp4"
test -f "$FTL_PRODUCTION_DIR/sources/stage-progression/usa-qualifying-deep-three-rOWGkfWSmgc.mp4"

node build-clean-base.mjs
FTL_QC_FILES=caitlin-clark-vs-china-8min-clean.mp4 \
FTL_QC_MANIFEST=qc-manifest-revision-5.json \
FTL_QC_REVISION=5 \
node cloud-qc.mjs

mkdir -p artifacts
cp renders/caitlin-clark-vs-china-8min-clean.mp4 artifacts/caitlin-clark-vs-china-8min-ffmpeg-revision-5.mp4
cp renders/qc-manifest-revision-5.json artifacts/
