#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (!arg.startsWith("--")) continue;
  const key = arg.slice(2);
  const next = process.argv[i + 1];
  if (next && !next.startsWith("--")) {
    args.set(key, next);
    i += 1;
  } else {
    args.set(key, "1");
  }
}

const input = args.get("in");
const output = args.get("out");
const preset = args.get("preset") || "tts-light";
const lufs = args.get("lufs") || "-16";

if (!input || !output) {
  console.error("Usage: node tools/process-vo-audio.mjs --in vo.mp3 --out vo-clean.mp3 [--preset tts-light|denoise-medium|normalize-only] [--lufs -16]");
  process.exit(1);
}

if (!fs.existsSync(input)) throw new Error(`Missing input: ${input}`);

const filters = {
  "normalize-only": [
    `loudnorm=I=${lufs}:TP=-1.5:LRA=11`,
  ],
  "tts-light": [
    "highpass=f=70",
    "lowpass=f=14500",
    "afftdn=nf=-35",
    "acompressor=threshold=-18dB:ratio=2.2:attack=8:release=120:makeup=1.5",
    `loudnorm=I=${lufs}:TP=-1.5:LRA=11`,
  ],
  "denoise-medium": [
    "highpass=f=80",
    "lowpass=f=13500",
    "afftdn=nf=-28",
    "anlmdn=s=0.0005:p=0.002:r=0.002:m=11",
    "acompressor=threshold=-20dB:ratio=2.5:attack=8:release=140:makeup=2",
    `loudnorm=I=${lufs}:TP=-1.5:LRA=10`,
  ],
};

const filter = filters[preset];
if (!filter) throw new Error(`Unknown --preset ${preset}`);

fs.mkdirSync(path.dirname(output), { recursive: true });

const ffmpeg = spawnSync("ffmpeg", [
  "-y",
  "-i", input,
  "-af", filter.join(","),
  "-ar", "44100",
  "-ac", "1",
  "-b:a", "160k",
  output,
], { stdio: "inherit" });

if (ffmpeg.status !== 0) throw new Error("ffmpeg audio processing failed");

const manifest = {
  input,
  output,
  preset,
  lufs,
  filters: filter,
  createdAt: new Date().toISOString(),
};
fs.writeFileSync(`${output}.manifest.json`, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Saved ${output}`);
