#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: tools/ftl-cursor-cloud-render.sh \
  --project-dir videos/<render-project> \
  --asset-repo owner/repo --asset-tag TAG --asset-name BUNDLE.tar.gz \
  --asset-sha256 SHA256 [--workers auto|N] [--publish]

Runs an FTL render project entirely on a Cursor Cloud machine. The project must
provide render-cloud.sh and, when --publish is used, publish-results.sh.
EOF
}

PROJECT_DIR=""
ASSET_REPO=""
ASSET_TAG=""
ASSET_NAME=""
ASSET_SHA256=""
WORKERS="auto"
PUBLISH=0

while (($#)); do
  case "$1" in
    --project-dir) PROJECT_DIR="$2"; shift 2 ;;
    --asset-repo) ASSET_REPO="$2"; shift 2 ;;
    --asset-tag) ASSET_TAG="$2"; shift 2 ;;
    --asset-name) ASSET_NAME="$2"; shift 2 ;;
    --asset-sha256) ASSET_SHA256="$2"; shift 2 ;;
    --workers) WORKERS="$2"; shift 2 ;;
    --publish) PUBLISH=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

for value in PROJECT_DIR ASSET_REPO ASSET_TAG ASSET_NAME ASSET_SHA256; do
  if [[ -z "${!value}" ]]; then
    echo "Missing required argument for $value" >&2
    usage >&2
    exit 2
  fi
done

if [[ ! -x "$PROJECT_DIR/render-cloud.sh" ]]; then
  echo "Missing executable $PROJECT_DIR/render-cloud.sh" >&2
  exit 1
fi

install_missing_tools() {
  local missing=()
  local command_name
  for command_name in gh ffmpeg ffprobe node npm sha256sum tar; do
    command -v "$command_name" >/dev/null 2>&1 || missing+=("$command_name")
  done
  ((${#missing[@]} == 0)) && return

  if [[ "${FTL_INSTALL_MISSING:-1}" != "1" ]] || ! command -v apt-get >/dev/null 2>&1; then
    echo "Missing required tools: ${missing[*]}" >&2
    exit 1
  fi

  local apt=(apt-get)
  if [[ "$(id -u)" != "0" ]]; then
    command -v sudo >/dev/null 2>&1 || { echo "sudo is required to install: ${missing[*]}" >&2; exit 1; }
    apt=(sudo apt-get)
  fi
  "${apt[@]}" update
  "${apt[@]}" install -y ffmpeg gh nodejs npm coreutils tar
}

auto_workers() {
  local cpus=1 mem_kib=0 by_cpu=1 by_mem=1 selected=1
  cpus="$(getconf _NPROCESSORS_ONLN 2>/dev/null || nproc 2>/dev/null || echo 1)"
  [[ "$cpus" =~ ^[0-9]+$ ]] || cpus=1
  ((cpus > 1)) && by_cpu=$((cpus - 1))
  if [[ -r /proc/meminfo ]]; then
    mem_kib="$(awk '/^MemAvailable:/ {print $2; exit}' /proc/meminfo)"
    [[ "$mem_kib" =~ ^[0-9]+$ ]] || mem_kib=0
    ((mem_kib > 0)) && by_mem=$((mem_kib / 3145728))
    ((by_mem < 1)) && by_mem=1
  else
    by_mem="$by_cpu"
  fi
  selected="$by_cpu"
  ((by_mem < selected)) && selected="$by_mem"
  ((selected > 4)) && selected=4
  ((selected < 1)) && selected=1
  echo "$selected"
}

install_missing_tools

if [[ "$WORKERS" == "auto" ]]; then
  WORKERS="$(auto_workers)"
fi
[[ "$WORKERS" =~ ^[1-9][0-9]*$ ]] || { echo "--workers must be auto or a positive integer" >&2; exit 2; }

DOWNLOAD_DIR="$(mktemp -d /tmp/ftl-cloud-download.XXXXXX)"
PRODUCTION_DIR="$(mktemp -d /tmp/ftl-cloud-production.XXXXXX)"
cleanup() { rm -rf "$DOWNLOAD_DIR"; }
trap cleanup EXIT

gh release download "$ASSET_TAG" --repo "$ASSET_REPO" --pattern "$ASSET_NAME" --dir "$DOWNLOAD_DIR"
printf '%s  %s\n' "$ASSET_SHA256" "$DOWNLOAD_DIR/$ASSET_NAME" | sha256sum --check --strict
tar -xzf "$DOWNLOAD_DIR/$ASSET_NAME" -C "$PRODUCTION_DIR"

export FTL_PRODUCTION_DIR="$PRODUCTION_DIR"
export HYPERFRAMES_WORKERS="$WORKERS"
echo "Cursor Cloud render: project=$PROJECT_DIR workers=$HYPERFRAMES_WORKERS production=$FTL_PRODUCTION_DIR"

(cd "$PROJECT_DIR" && ./render-cloud.sh)
if ((PUBLISH)); then
  (cd "$PROJECT_DIR" && bash publish-results.sh)
fi

