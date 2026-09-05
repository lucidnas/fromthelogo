#!/usr/bin/env bash
set -euo pipefail

: "${FTL_PRODUCTION_DIR:?Set FTL_PRODUCTION_DIR to the prepared production directory}"

test -f "$FTL_PRODUCTION_DIR/ASSET-CHECKSUMS.sha256"
(cd "$FTL_PRODUCTION_DIR" && sha256sum --check ASSET-CHECKSUMS.sha256)
test -f "$FTL_PRODUCTION_DIR/audio/chronological-recap-v5-josh-normal/vo-master-postgame-final.mp3"
test -f "$FTL_PRODUCTION_DIR/edl.json"
test -f "$FTL_PRODUCTION_DIR/sources/official/postgame/USA-Basketball-mWNTPDreG1k.mp4"

node build-clean-base.mjs
node generate-composition.mjs
npm run check
npm run render -- --quality high --output renders/caitlin-clark-vs-china-8min-hyperframes.mp4
node cloud-qc.mjs
mkdir -p artifacts
cp renders/caitlin-clark-vs-china-8min-clean.mp4 artifacts/
cp renders/caitlin-clark-vs-china-8min-hyperframes.mp4 artifacts/
cp renders/qc-manifest.json artifacts/
