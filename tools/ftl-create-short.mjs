#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const SSD = "/Volumes/SSK SSD";
const DEFAULT_HANDLE = "@fromthelogo22";

function usage() {
  console.error(`Usage:
  node tools/ftl-create-short.mjs --input FILE --start SECS --end SECS --top TEXT --out FILE [options]
  node tools/ftl-create-short.mjs --manifest FILE

Options:
  --handle TEXT      Default: ${DEFAULT_HANDLE}
  --mode contain     Default. Blurred 9:16 background with contained game video.
  --fill-ratio N     Foreground video height as share of 9:16 frame in contain mode. Default: 0.80
  --mode crop        Fill 9:16 by cropping center.
  --music FILE       Optional background music mixed under source audio.
  --music-volume N   Default: 0.18
  --source-volume N  Default: 1.0
  --no-source-audio  Remove broadcast/commentary audio and use music only.
  --out-dir DIR      Build output filename from --top inside this directory.
  --slowmo-replay    Append a muted slow-motion replay after the normal-speed clip.
  --slowmo-speed N   Replay speed. Default: 0.5
  --slowmo-start N   Replay start, relative to selected clip start. Default: 0
  --slowmo-end N     Replay end, relative to selected clip start. Default: full clip
  --crf N            Default: 18

Manifest shape:
[
  {
    "id": "clark-deep-three",
    "input": "/abs/source.mp4",
    "start": 12.4,
    "end": 28.0,
    "top": "Caitlin Clark pulls from DEEP",
    "out": "/Volumes/SSK SSD/ftl/shorts/season-start/renders/clark-deep-three.mp4"
  }
]`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { mode: "contain", handle: DEFAULT_HANDLE, crf: "18" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) usage();
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function ffText(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll(":", "\\:")
    .replaceAll("'", "\\'")
    .replaceAll("%", "\\%");
}

function wrapText(text, maxChars = 22) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "short";
}

function fontFile() {
  const candidates = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
  ];
  return candidates.find((file) => fs.existsSync(file)) || "";
}

function buildDrawText({ top, handle }) {
  const font = fontFile();
  const fontPart = font ? `fontfile='${ffText(font)}':` : "";
  const topLines = wrapText(top);
  const filters = [];
  const startY = topLines.length === 1 ? 108 : topLines.length === 2 ? 78 : 52;
  topLines.forEach((line, index) => {
    filters.push(
      `drawtext=${fontPart}text='${ffText(line.toUpperCase())}':` +
      `x=(w-text_w)/2:y=${startY + index * 78}:` +
      `fontsize=70:fontcolor=white:borderw=5:bordercolor=black@0.85:` +
      `shadowx=0:shadowy=6:shadowcolor=black@0.65`
    );
  });
  filters.push(
    `drawtext=${fontPart}text='${ffText(handle)}':` +
    `x=(w-text_w)/2:y=h-178:` +
    `fontsize=58:fontcolor=white:borderw=5:bordercolor=black@0.85:` +
    `shadowx=0:shadowy=5:shadowcolor=black@0.65`
  );
  return filters;
}

function buildVisualFilter({ input, out, mode, top, handle, fillRatio = 0.8, tag = "main" }) {
  const topShade = "drawbox=x=0:y=0:w=iw:h=330:color=black@0.35:t=fill";
  const bottomShade = "drawbox=x=0:y=ih-310:w=iw:h=310:color=black@0.35:t=fill";
  const textFilters = buildDrawText({ top, handle }).join(",");

  if (mode === "crop") {
    return `${input}scale=1080:1920:force_original_aspect_ratio=increase,` + [
      "crop=1080:1920",
      "setsar=1",
      topShade,
      bottomShade,
      textFilters,
    ].join(",") + out;
  }

  const fgHeight = Math.max(0.35, Math.min(1, Number(fillRatio) || 0.8)) * 1920;
  return [
    `${input}split=2[${tag}bgsrc][${tag}fgsrc]`,
    `[${tag}bgsrc]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:8,eq=brightness=-0.08:saturation=0.9[${tag}bg]`,
    `[${tag}fgsrc]scale=-2:${Math.round(fgHeight)}:force_original_aspect_ratio=increase,crop=1080:${Math.round(fgHeight)},setsar=1[${tag}fg]`,
    `[${tag}bg][${tag}fg]overlay=(W-w)/2:(H-h)/2,${topShade},${bottomShade},${textFilters}${out}`,
  ].join(";");
}

function renderOne(item, defaults = {}) {
  const input = item.input || defaults.input;
  const start = Number(item.start ?? defaults.start ?? 0);
  const end = Number(item.end ?? defaults.end);
  const top = item.top || defaults.top;
  let out = item.out || defaults.out;
  const outDir = item.outDir || item["out-dir"] || defaults.outDir || defaults["out-dir"];
  const mode = item.mode || defaults.mode || "contain";
  const handle = item.handle || defaults.handle || DEFAULT_HANDLE;
  const crf = String(item.crf || defaults.crf || "18");
  const fillRatio = Number(item.fillRatio || item["fill-ratio"] || defaults.fillRatio || defaults["fill-ratio"] || 0.8);
  const music = item.music || defaults.music || "";
  const musicVolume = Number(item.musicVolume || item["music-volume"] || defaults.musicVolume || defaults["music-volume"] || 0.18);
  const sourceVolume = Number(item.sourceVolume || item["source-volume"] || defaults.sourceVolume || defaults["source-volume"] || 1.0);
  const noSourceAudio = Boolean(item.noSourceAudio || item["no-source-audio"] || defaults.noSourceAudio || defaults["no-source-audio"]);
  const slowmoReplay = Boolean(item.slowmoReplay || item["slowmo-replay"] || defaults.slowmoReplay || defaults["slowmo-replay"]);
  const slowmoSpeed = Number(item.slowmoSpeed || item["slowmo-speed"] || defaults.slowmoSpeed || defaults["slowmo-speed"] || 0.5);
  const slowmoStart = Number(item.slowmoStart || item["slowmo-start"] || defaults.slowmoStart || defaults["slowmo-start"] || 0);
  const slowmoEndRaw = item.slowmoEnd || item["slowmo-end"] || defaults.slowmoEnd || defaults["slowmo-end"];

  if (!input || !fs.existsSync(input)) throw new Error(`Missing input: ${input}`);
  if (music && !fs.existsSync(music)) throw new Error(`Missing music: ${music}`);
  if (!Number.isFinite(end) || end <= start) throw new Error(`Invalid start/end for ${input}`);
  if (!top) throw new Error("--top is required");
  if (!out && outDir) out = path.join(outDir, `${slugify(top)}.mp4`);
  if (!out) throw new Error("--out or --out-dir is required");
  fs.mkdirSync(path.dirname(out), { recursive: true });

  const duration = end - start;
  const slowEnd = slowmoEndRaw == null ? duration : Number(slowmoEndRaw);
  const slowStartClamped = Math.max(0, Math.min(duration - 0.1, slowmoStart));
  const slowEndClamped = Math.max(slowStartClamped + 0.1, Math.min(duration, slowEnd));
  const slowDuration = slowmoReplay ? (slowEndClamped - slowStartClamped) / Math.max(0.1, slowmoSpeed) : 0;
  const outputDuration = duration + slowDuration;

  const filters = [];
  if (slowmoReplay) {
    filters.push(`[0:v]trim=0:${duration.toFixed(3)},setpts=PTS-STARTPTS[vnormalraw]`);
    filters.push(buildVisualFilter({ input: "[vnormalraw]", out: "[vnormal]", mode, top, handle, fillRatio, tag: "normal" }));
    filters.push(`[0:v]trim=${slowStartClamped.toFixed(3)}:${slowEndClamped.toFixed(3)},setpts=(PTS-STARTPTS)/${Math.max(0.1, slowmoSpeed).toFixed(3)}[vslowraw]`);
    filters.push(buildVisualFilter({ input: "[vslowraw]", out: "[vslow]", mode, top, handle, fillRatio, tag: "slow" }));
    filters.push("[vnormal][vslow]concat=n=2:v=1:a=0[v]");
  } else {
    filters.push(buildVisualFilter({ input: "[0:v]", out: "[v]", mode, top, handle, fillRatio, tag: "main" }));
  }

  const args = [
    "-y",
    "-hide_banner",
    "-loglevel", "error",
    "-ss", start.toFixed(3),
    "-i", input,
  ];
  if (music) {
    args.push("-stream_loop", "-1", "-i", music);
  }
  const audioFilter = (() => {
    if (music && noSourceAudio) {
      return `[1:a]volume=${musicVolume},atrim=0:${outputDuration.toFixed(3)},asetpts=PTS-STARTPTS[a]`;
    }
    if (music) {
      return `[0:a]volume=${sourceVolume},asetpts=PTS-STARTPTS,apad=pad_dur=${slowDuration.toFixed(3)}[a0];[1:a]volume=${musicVolume},atrim=0:${outputDuration.toFixed(3)},asetpts=PTS-STARTPTS[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=0[a]`;
    }
    if (slowmoReplay) {
      return `[0:a]volume=${sourceVolume},asetpts=PTS-STARTPTS,apad=pad_dur=${slowDuration.toFixed(3)}[a]`;
    }
    return "";
  })();
  args.push(
    "-t", outputDuration.toFixed(3),
    "-filter_complex",
    audioFilter ? `${filters.join(";")};${audioFilter}` : filters.join(";"),
    "-map", "[v]",
  );
  if (audioFilter) {
    args.push("-map", "[a]");
  } else {
    args.push("-map", "0:a?");
  }
  args.push(
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", crf,
    "-r", "30",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    out,
  );

  console.log(`render short: ${out}`);
  const proc = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (proc.status !== 0) {
    throw new Error(proc.stderr || `ffmpeg failed with ${proc.status}`);
  }
}

const args = parseArgs(process.argv.slice(2));
if (args.manifest) {
  const manifest = JSON.parse(fs.readFileSync(args.manifest, "utf8"));
  if (!Array.isArray(manifest)) throw new Error("Manifest must be a JSON array");
  for (const item of manifest) renderOne(item, args);
} else {
  renderOne(args);
}
