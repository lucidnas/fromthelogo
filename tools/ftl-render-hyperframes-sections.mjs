#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const SSD = "/Volumes/SSK SSD";
const REPO = "/Users/abdul/code/fromthelogo";
const RENDER_DIR = path.join(REPO, "local/ftl-render");

const DEFAULT_SECTIONS = [
  { id: "S01", start: 0, end: 85, name: "hook" },
  { id: "S02", start: 85, end: 175, name: "body" },
  { id: "S03", start: 175, end: 266, name: "body" },
  { id: "S04", start: 266, end: 356, name: "body" },
  { id: "S05", start: 356, end: 446, name: "body" },
  { id: "S06", start: 446, end: null, name: "close" },
];

function usage() {
  console.log(`Usage:
  node tools/ftl-render-hyperframes-sections.mjs SLUG [options]

Options:
  --from S03             Start at a section id.
  --only S03,S04        Render only these section ids.
  --skip-existing       Do not rerender an existing section mp4.
  --quality draft       Hyperframes quality. Default: draft.
  --workers 1           Hyperframes workers. Default: 1.
  --no-contact-sheet    Skip contact sheet generation.

Uses the standard FTL section plan:
  S01 0-85, S02 85-175, S03 175-266, S04 266-356, S05 356-446, S06 446-end.
`);
}

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  usage();
  process.exit(0);
}

const slug = args[0];
if (!slug || slug.startsWith("--")) {
  usage();
  process.exit(1);
}

function optionValue(flag, fallback = null) {
  const index = args.indexOf(flag);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
}

const from = optionValue("--from");
const only = optionValue("--only");
const skipExisting = args.includes("--skip-existing");
const noContactSheet = args.includes("--no-contact-sheet");
const quality = optionValue("--quality", "draft");
const workers = optionValue("--workers", "1");

const videoDir = path.join(SSD, "ftl/videos", slug);
const voPath = path.join(videoDir, "vo.mp3");
if (!fs.existsSync(voPath)) {
  console.error(`Missing VO: ${voPath}`);
  process.exit(1);
}

function run(command, commandArgs, options = {}) {
  console.log(`\n$ ${[command, ...commandArgs].join(" ")}`);
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    cwd: options.cwd ?? REPO,
    env: { ...process.env, ...(options.env ?? {}) },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function readDuration(file) {
  const result = spawnSync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    file,
  ], { encoding: "utf8" });
  if (result.status !== 0) {
    console.error(result.stderr);
    process.exit(result.status ?? 1);
  }
  const duration = Number(result.stdout.trim());
  if (!Number.isFinite(duration)) {
    console.error(`Could not read duration from ${file}`);
    process.exit(1);
  }
  return duration;
}

const voiceDuration = readDuration(voPath);
const sections = DEFAULT_SECTIONS
  .map((section) => ({
    ...section,
    end: section.end == null ? voiceDuration : Math.min(section.end, voiceDuration),
  }))
  .filter((section) => section.start < voiceDuration - 0.01);

let selected = sections;
if (from) {
  const index = selected.findIndex((section) => section.id === from);
  if (index === -1) {
    console.error(`Unknown --from section: ${from}`);
    process.exit(1);
  }
  selected = selected.slice(index);
}
if (only) {
  const ids = new Set(only.split(",").map((id) => id.trim()).filter(Boolean));
  selected = selected.filter((section) => ids.has(section.id));
}

if (selected.length === 0) {
  console.error("No sections selected.");
  process.exit(1);
}

const sectionsDir = path.join(videoDir, "render/sections");
fs.mkdirSync(sectionsDir, { recursive: true });

const rendered = [];
for (const section of selected) {
  const outPath = path.join(sectionsDir, `${section.id}-${section.name}.mp4`);
  const contactPath = path.join(sectionsDir, `${section.id}-${section.name}-contact.jpg`);

  if (skipExisting && fs.existsSync(outPath)) {
    console.log(`\nSkipping existing ${section.id}: ${outPath}`);
    rendered.push(outPath);
    continue;
  }

  run("node", [
    "tools/create-section-render-input.mjs",
    slug,
    section.id,
    String(section.start),
    String(section.end),
  ]);

  const sectionSlug = `${slug}-section-${section.id}`;
  run("bun", ["run", "build.ts", sectionSlug], {
    cwd: RENDER_DIR,
    env: { FTL_FLAT_BACKGROUND: "1" },
  });

  run("npx", ["hyperframes", "lint"], { cwd: RENDER_DIR });

  run("node", [
    "../../tools/render-hyperframes-clean.mjs",
    "--quality", quality,
    "--workers", workers,
    "--output", outPath,
  ], { cwd: RENDER_DIR });

  if (!noContactSheet) {
    run("ffmpeg", [
      "-y",
      "-i", outPath,
      "-vf", "fps=1/8,scale=320:-1,tile=5x4:padding=8:margin=8",
      "-frames:v", "1",
      "-update", "1",
      contactPath,
    ]);
  }

  rendered.push(outPath);
}

const concatPath = path.join(sectionsDir, "concat.txt");
const allRendered = sections
  .map((section) => path.join(sectionsDir, `${section.id}-${section.name}.mp4`))
  .filter((file) => fs.existsSync(file));
fs.writeFileSync(
  concatPath,
  allRendered.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join("\n") + "\n",
);

console.log("\nRendered sections:");
for (const file of rendered) console.log(`- ${file}`);
console.log(`Concat list: ${concatPath}`);
