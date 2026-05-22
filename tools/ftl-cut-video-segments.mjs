#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

function usage() {
  console.error(`Usage:
  node tools/ftl-cut-video-segments.mjs --input FILE --out-dir DIR --segment SPEC [--segment SPEC...]

Cuts exact review segments from one source video and writes a JSON ledger plus contact sheets.

Segment SPEC format:
  label|start|end|filename|note

Times can be seconds, MM:SS, or HH:MM:SS.

Example:
  node tools/ftl-cut-video-segments.mjs \\
    --input "/path/source.mp4" \\
    --out-dir "/path/cuts" \\
    --segment "q4-mitchell|1:17|1:29|02-q4-mitchell.mp4|Direct Clark pass to Mitchell three"`);
  process.exit(1);
}

const args = [];
for (let i = 2; i < process.argv.length; i += 1) args.push(process.argv[i]);

function valuesFor(flag) {
  const out = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === flag && args[i + 1]) {
      out.push(args[i + 1]);
      i += 1;
    }
  }
  return out;
}

function valueFor(flag) {
  return valuesFor(flag)[0];
}

function parseTime(raw) {
  if (raw == null || raw === "") throw new Error("Missing time");
  const text = String(raw).trim();
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text);
  const parts = text.split(":").map(Number);
  if (parts.some((part) => Number.isNaN(part))) throw new Error(`Invalid time: ${raw}`);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  throw new Error(`Invalid time: ${raw}`);
}

function formatSecs(secs) {
  return Number(secs.toFixed(3));
}

function ffprobeDuration(filePath) {
  const out = execFileSync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    filePath,
  ], { encoding: "utf8" });
  return Number(out.trim());
}

function run(command, commandArgs) {
  execFileSync(command, commandArgs, { stdio: "inherit" });
}

const input = valueFor("--input");
const outDir = valueFor("--out-dir");
const segmentSpecs = valuesFor("--segment");

if (!input || !outDir || segmentSpecs.length === 0) usage();
if (!fs.existsSync(input)) throw new Error(`Missing input video: ${input}`);

const sourceDuration = ffprobeDuration(input);
fs.mkdirSync(outDir, { recursive: true });
const contactDir = path.join(outDir, "contact-sheets");
fs.mkdirSync(contactDir, { recursive: true });

const ledger = {
  source: input,
  sourceDuration: formatSecs(sourceDuration),
  generatedAt: new Date().toISOString(),
  segments: [],
};

for (let index = 0; index < segmentSpecs.length; index += 1) {
  const spec = segmentSpecs[index];
  const [label, startRaw, endRaw, filenameRaw, ...noteParts] = spec.split("|");
  if (!label || !startRaw || !endRaw || !filenameRaw) {
    throw new Error(`Invalid --segment spec: ${spec}`);
  }

  const start = parseTime(startRaw);
  const requestedEnd = parseTime(endRaw);
  if (requestedEnd <= start) throw new Error(`Segment end must be after start: ${spec}`);
  const end = Math.min(requestedEnd, sourceDuration);
  const duration = end - start;
  const filename = filenameRaw.endsWith(".mp4") ? filenameRaw : `${filenameRaw}.mp4`;
  const outputPath = path.join(outDir, filename);
  const contactPath = path.join(contactDir, `${path.basename(filename, ".mp4")}.jpg`);
  const note = noteParts.join("|").trim();

  console.log(`Cutting ${label}: ${formatSecs(start)}-${formatSecs(end)} -> ${outputPath}`);
  run("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel", "error",
    "-ss", String(start),
    "-i", input,
    "-t", String(duration),
    "-map", "0:v:0",
    "-map", "0:a?",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    outputPath,
  ]);

  run("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel", "error",
    "-i", outputPath,
    "-vf", "fps=1,scale=320:-1,tile=4x3:padding=8:margin=8",
    "-frames:v", "1",
    contactPath,
  ]);

  ledger.segments.push({
    index: index + 1,
    label,
    start: formatSecs(start),
    end: formatSecs(end),
    duration: formatSecs(duration),
    outputPath,
    contactSheet: contactPath,
    note,
  });
}

const ledgerPath = path.join(outDir, "segments-ledger.json");
fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
console.log(ledgerPath);
