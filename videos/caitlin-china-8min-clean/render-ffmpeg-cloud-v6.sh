#!/usr/bin/env bash
set -euo pipefail

: "${FTL_PRODUCTION_DIR:?Set FTL_PRODUCTION_DIR to the prepared production directory}"

test -f "$FTL_PRODUCTION_DIR/ASSET-CHECKSUMS.sha256"
(cd "$FTL_PRODUCTION_DIR" && grep -v '/\._' ASSET-CHECKSUMS.sha256 | sha256sum --check --strict -)
test -f "$FTL_PRODUCTION_DIR/edl.json"
test -f "$FTL_PRODUCTION_DIR/audio/chronological-recap-v6-josh-normal/vo-master-stage-pauses.mp3"
test -f "$FTL_PRODUCTION_DIR/sources/graphics/revision-6/caitlin-stats-16x9.png"
test -f "$FTL_PRODUCTION_DIR/sources/graphics/revision-6/usa-china-33-point-win-16x9.png"
test -f "$FTL_PRODUCTION_DIR/sources/graphics/revision-6/caitlin-tissot-mvp-16x9.png"
test -f "$FTL_PRODUCTION_DIR/sources/stage-progression/college-iowa-deep-three-i7aM979td7w.mp4"
test -f "$FTL_PRODUCTION_DIR/sources/stage-progression/wnba-fever-deep-three-jANcTPAOIYQ.mp4"
test -f "$FTL_PRODUCTION_DIR/sources/stage-progression/usa-qualifying-deep-three-rOWGkfWSmgc.mp4"

node build-clean-base.mjs
FTL_QC_FILES=caitlin-clark-vs-china-8min-clean.mp4 \
FTL_QC_MANIFEST=qc-manifest-revision-6.json \
FTL_QC_REVISION=6 \
FTL_QC_EXPECTED_DURATION=496.99 \
node cloud-qc.mjs

mkdir -p artifacts
cp renders/caitlin-clark-vs-china-8min-clean.mp4 artifacts/caitlin-clark-vs-china-8min-ffmpeg-revision-6.mp4
cp renders/qc-manifest-revision-6.json artifacts/
