#!/usr/bin/env bash
set -euo pipefail

: "${FTL_PRODUCTION_DIR:?Set FTL_PRODUCTION_DIR to the prepared production directory}"

node build-clean-base.mjs
node generate-composition.mjs
npm run check
npm run render -- --quality high --output renders/caitlin-clark-vs-china-8min-hyperframes.mp4
