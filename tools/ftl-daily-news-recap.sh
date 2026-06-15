#!/bin/bash
# FTL daily news-recap automation — fires a headless Claude run of the ftl-news-recap pipeline
# each morning (driven by launchd). Builds the env launchd does not provide (PATH for node/whisper/
# codex/modal/ffmpeg/claude), guards on the SSD mount + a lock, logs everything, then runs
# `claude -p` with the daily prompt.
#
#   ftl-daily-news-recap.sh            run the daily pipeline
#   ftl-daily-news-recap.sh --check    validate the environment (no video) and exit
set -uo pipefail

REPO="/Users/abdul/code/fromthelogo"
SSD="/Volumes/SSK SSD"
LOG_DIR="$SSD/ftl/logs/daily-news-recap"
LOCK="$REPO/.claude/ftl-daily.lock"
PROMPT_FILE="$REPO/tools/ftl-daily-news-recap-prompt.md"

# --- environment launchd does not provide -----------------------------------
export HOME="/Users/abdul"
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.nvm/versions/node/v22.22.2/bin:$HOME/.nvm/versions/node/v20.19.0/bin:$HOME/.pyenv/shims:$HOME/.pyenv/versions/3.11.0/envs/modal-env/bin:/usr/bin:/bin:/usr/sbin:/sbin"
source "$HOME/.nvm/nvm.sh" 2>/dev/null && nvm use 22 >/dev/null 2>&1 || true

CHECK=0
[ "${1:-}" = "--check" ] && CHECK=1

fail=0
need() { if command -v "$1" >/dev/null 2>&1; then echo "  ok   $1 -> $(command -v "$1")"; else echo "  MISS $1"; fail=1; fi; }

echo "=== FTL daily env check ($(date)) ==="
need claude; need node; need npx; need ffmpeg; need ffprobe; need whisper; need codex
[ -x "$HOME/.pyenv/versions/3.11.0/envs/modal-env/bin/modal" ] && echo "  ok   modal" || { echo "  MISS modal"; fail=1; }
if [ -d "$SSD" ]; then echo "  ok   SSD mounted ($SSD)"; else echo "  MISS SSD not mounted"; fail=1; fi
[ -f "$PROMPT_FILE" ] && echo "  ok   prompt file" || { echo "  MISS prompt file"; fail=1; }

if [ "$CHECK" = "1" ]; then
  [ "$fail" = "0" ] && echo "ENV OK" || echo "ENV INCOMPLETE"
  exit "$fail"
fi

if [ "$fail" != "0" ]; then
  echo "Aborting daily run: environment incomplete (SSD not mounted or a tool missing)."
  exit 1
fi

# --- single-instance lock ---------------------------------------------------
mkdir -p "$(dirname "$LOCK")" "$LOG_DIR"
if [ -e "$LOCK" ] && kill -0 "$(cat "$LOCK" 2>/dev/null)" 2>/dev/null; then
  echo "Another daily run is active (lock $LOCK); exiting."
  exit 0
fi
echo $$ > "$LOCK"
trap 'rm -f "$LOCK"' EXIT

DATE="$(date +%Y-%m-%d)"
LOG="$LOG_DIR/$DATE.log"
echo "=== FTL daily news-recap $DATE start $(date) ===" | tee -a "$LOG"

cd "$REPO" || exit 1
# Load FTL env (Gemini/ElevenLabs keys etc.); CLI auth (codex/modal/gemini) comes from the user's home.
set -a; source "$REPO/.env" 2>/dev/null; source "$REPO/local/.env.local" 2>/dev/null; set +a

PROMPT="$(cat "$PROMPT_FILE")"

# Headless Claude run with full local access; SSD added so tools may write there.
claude -p "$PROMPT" \
  --add-dir "$SSD" \
  --dangerously-skip-permissions \
  >> "$LOG" 2>&1
status=$?

echo "=== FTL daily news-recap $DATE done (exit $status) $(date) ===" | tee -a "$LOG"
exit "$status"
