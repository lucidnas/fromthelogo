#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const SSD = "/Volumes/SSK SSD";
const WORKFLOW_ROOT = `${SSD}/ftl/workflows/clip-first-clark-celebration`;
const VIDEOS_ROOT = `${SSD}/ftl/videos`;

function usage() {
  console.log(`Usage:
  node tools/ftl-clip-first-formula.mjs init --slug SLUG --title TITLE [--player "Caitlin Clark"] [--yellow-word SPECTACULAR]
  node tools/ftl-clip-first-formula.mjs validate --manifest PATH
  node tools/ftl-clip-first-formula.mjs export-vo --manifest PATH --out PATH
  node tools/ftl-clip-first-formula.mjs build-edit --manifest PATH --video-slug SLUG [--vo PATH]
  node tools/ftl-clip-first-formula.mjs checklist --slug SLUG

The manifest is the source of truth. If a play is not in manifest.plays[], it should not be in the VO.`);
}

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}

function required(name) {
  const value = arg(name);
  if (!value) {
    console.error(`Missing --${name}`);
    usage();
    process.exit(1);
  }
  return value;
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
  mkdirp(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function exists(p) {
  return typeof p === "string" && p.length > 0 && fs.existsSync(p);
}

function durationSeconds(file) {
  if (!exists(file)) return null;
  const proc = spawnSync("ffprobe", [
    "-v", "quiet",
    "-print_format", "json",
    "-show_format",
    file
  ], { encoding: "utf8" });
  if (proc.status !== 0) return null;
  try {
    return Number(JSON.parse(proc.stdout).format.duration);
  } catch {
    return null;
  }
}

function estimateSpeechSeconds(text) {
  const words = String(text ?? "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(8, words / 2.45);
}

function playVo(play) {
  if (typeof play.voBeat === "string") return play.voBeat.trim();
  if (play.voBeat && typeof play.voBeat === "object") {
    return ["setup", "freezePhrase", "analysis", "payoff"]
      .map((key) => play.voBeat[key])
      .filter(Boolean)
      .join("\n\n")
      .trim();
  }
  return [
    `Look at this ${play.label ?? `play ${play.playNumber}`}.`,
    play.freezeFrames?.[0]?.triggerPhrase,
    play.clarkRead || play.playerRead,
    play.takeaway
  ].filter(Boolean).join("\n\n");
}

function normalizeOverlay(text) {
  return String(text ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function init() {
  const slug = required("slug");
  const title = required("title");
  const player = arg("player", "Caitlin Clark");
  const yellowWord = arg("yellow-word", "SPECTACULAR");
  const workflowDir = `${WORKFLOW_ROOT}/examples/${slug}`;
  const videoDir = `${VIDEOS_ROOT}/clip-first-${slug}`;

  mkdirp(`${workflowDir}/sources`);
  mkdirp(`${workflowDir}/clips`);
  mkdirp(`${workflowDir}/analysis`);
  mkdirp(`${videoDir}/render/sections`);

  const manifestPath = `${workflowDir}/selected-play-manifest-v1.json`;
  if (!fs.existsSync(manifestPath)) {
    writeJson(manifestPath, {
      slug,
      title,
      format: "Clip-first player celebration",
      player,
      yellowWord,
      game: {
        date: "YYYY-MM-DD",
        teams: "",
        wnbaGameId: "",
        officialContextPath: "",
        officialBox: ""
      },
      sourceClips: [],
      editorialRule: "Every VO beat is tied to a selected play row. If a row does not exist, the VO beat does not exist.",
      plays: [],
      closingCommentary: {
        enabled: true,
        durationTargetSeconds: 60,
        receipt: "",
        sourcePaths: [],
        vo: ""
      }
    });
  }

  const ledgerPath = `${workflowDir}/clip-by-clip-script-ledger-v1.json`;
  if (!fs.existsSync(ledgerPath)) {
    writeJson(ledgerPath, {
      title,
      gameSlug: slug,
      player,
      scriptFraming: {
        yellowWord,
        coreThesis: `${player} controls the game in ways that show up on every selected play.`
      },
      beats: []
    });
  }

  console.log(`Initialized clip-first formula workspace:
manifest: ${manifestPath}
ledger:   ${ledgerPath}
video:    ${videoDir}`);
}

function validate() {
  const manifestPath = required("manifest");
  const manifest = readJson(manifestPath);
  const errors = [];
  const warnings = [];

  if (!manifest.slug) errors.push("manifest.slug is required");
  if (!manifest.title) errors.push("manifest.title is required");
  if (!manifest.player) warnings.push("manifest.player is missing; default scripts should name the player explicitly");
  if (!Array.isArray(manifest.plays) || manifest.plays.length === 0) {
    errors.push("manifest.plays[] is empty; clip-first videos need selected plays before VO");
  }

  const seen = new Set();
  for (const play of manifest.plays ?? []) {
    const id = play.playNumber ?? play.label ?? "unknown";
    if (seen.has(play.playNumber)) errors.push(`duplicate playNumber: ${play.playNumber}`);
    seen.add(play.playNumber);
    if (!play.playNumber) errors.push(`play ${id}: playNumber is required`);
    if (!play.label) warnings.push(`play ${id}: label is missing`);
    if (!exists(play.sourcePath)) errors.push(`play ${id}: sourcePath missing on disk: ${play.sourcePath}`);
    if (!Number.isFinite(Number(play.sourceIn))) errors.push(`play ${id}: sourceIn must be a number`);
    if (!Number.isFinite(Number(play.sourceOut))) errors.push(`play ${id}: sourceOut must be a number`);
    if (Number(play.sourceOut) <= Number(play.sourceIn)) errors.push(`play ${id}: sourceOut must be greater than sourceIn`);
    if (!["verified-pbp", "verified-pbp-gemini-3.1-pro", "verified-stat", "social-only", "conceptual"].includes(play.matchStatus)) {
      warnings.push(`play ${id}: matchStatus should document verification, got ${play.matchStatus ?? "missing"}`);
    }
    if (!play.official?.eventText && play.matchStatus?.includes("pbp")) {
      warnings.push(`play ${id}: verified PBP beat has no official.eventText`);
    }
    if (!play.geminiVisualRead) warnings.push(`play ${id}: geminiVisualRead is missing`);
    if (!play.clarkRead && !play.playerRead) warnings.push(`play ${id}: player read is missing`);
    if (!play.takeaway) warnings.push(`play ${id}: takeaway is missing`);
    if (!playVo(play)) errors.push(`play ${id}: voBeat is missing`);
    for (const [i, freeze] of (play.freezeFrames ?? []).entries()) {
      if (!Number.isFinite(Number(freeze.sourceTime))) errors.push(`play ${id} freeze ${i + 1}: sourceTime is required`);
      if (!Number.isFinite(Number(freeze.duration))) errors.push(`play ${id} freeze ${i + 1}: duration is required`);
      if (!freeze.overlayText) warnings.push(`play ${id} freeze ${i + 1}: overlayText is missing`);
    }
  }

  const closing = manifest.closingCommentary;
  if (closing?.enabled) {
    if (!closing.vo) warnings.push("closingCommentary.enabled is true but closingCommentary.vo is empty");
    for (const p of closing.sourcePaths ?? []) {
      if (!exists(p)) errors.push(`closingCommentary source missing on disk: ${p}`);
    }
  }

  if (warnings.length) {
    console.log("Warnings:");
    for (const warning of warnings) console.log(`- ${warning}`);
  }
  if (errors.length) {
    console.error("Errors:");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`OK: ${manifest.plays?.length ?? 0} play beats validated from ${manifestPath}`);
}

function exportVo() {
  const manifestPath = required("manifest");
  const out = required("out");
  const manifest = readJson(manifestPath);
  const lines = [
    manifest.title,
    "",
    `Player: ${manifest.player ?? "Caitlin Clark"}`,
    "",
  ];

  for (const play of manifest.plays ?? []) {
    lines.push(`// Beat ${String(play.playNumber).padStart(2, "0")} - ${play.label ?? ""}`);
    lines.push(playVo(play));
    lines.push("");
  }

  if (manifest.closingCommentary?.enabled && manifest.closingCommentary.vo) {
    lines.push("// Closing commentary");
    lines.push(manifest.closingCommentary.vo.trim());
    lines.push("");
  }

  mkdirp(path.dirname(out));
  fs.writeFileSync(out, `${lines.join("\n").trim()}\n`);
  console.log(out);
}

function buildEdit() {
  const manifestPath = required("manifest");
  const videoSlug = required("video-slug");
  const voPath = arg("vo", `${VIDEOS_ROOT}/${videoSlug}/vo.mp3`);
  const manifest = readJson(manifestPath);
  const cues = [];
  const playTexts = (manifest.plays ?? []).map(playVo);
  const closingText = manifest.closingCommentary?.enabled ? String(manifest.closingCommentary.vo ?? "").trim() : "";
  const allTexts = closingText ? [...playTexts, closingText] : playTexts;
  const estimatedDurations = allTexts.map(estimateSpeechSeconds);
  const totalEstimate = estimatedDurations.reduce((sum, n) => sum + n, 0);
  const actualVoDuration = durationSeconds(voPath);
  const scale = actualVoDuration && totalEstimate > 0 ? actualVoDuration / totalEstimate : 1;

  let t = 0;
  for (const [index, play] of (manifest.plays ?? []).entries()) {
    const duration = Math.max(8, estimatedDurations[index] * scale);
    const start = t;
    const end = t + duration;
    const sourceSpan = Math.max(0.1, Number(play.sourceOut) - Number(play.sourceIn));
    const overlays = [
      normalizeOverlay(play.freezeFrames?.[0]?.overlayText || play.takeaway || play.label),
      play.official?.clock && play.official?.period ? `Q${play.official.period} ${play.official.clock}` : "",
    ].filter(Boolean);

    const freezeFrames = (play.freezeFrames ?? []).map((freeze, freezeIndex) => {
      const fallbackOffset = Math.min(duration - 1, Math.max(2, duration * (0.34 + freezeIndex * 0.22)));
      return {
        startOffset: Number(freeze.startOffset ?? fallbackOffset),
        duration: Number(freeze.duration ?? 3),
        sourceTime: Number(freeze.sourceTime),
        zoomFrom: Number(freeze.zoomFrom ?? 1.04),
        zoomTo: Number(freeze.zoomTo ?? 1.12),
        x: Number(freeze.x ?? 50),
        y: Number(freeze.y ?? 50),
        label: normalizeOverlay(freeze.overlayText)
      };
    }).filter((freeze) => Number.isFinite(freeze.sourceTime));

    cues.push({
      start: Number(start.toFixed(3)),
      end: Number(end.toFixed(3)),
      beat: `Beat ${String(play.playNumber).padStart(2, "0")} - ${play.label ?? ""}`,
      vo: playVo(play),
      asset: "edl-clip",
      assetPath: play.sourcePath,
      sourceIn: Number(play.sourceIn),
      sourceOut: Number(play.sourceIn) + Math.min(sourceSpan, Math.max(4, duration - 1)),
      treatment: "clip-first live play with freeze-frame analysis and big text callouts",
      overlays,
      graphics: [],
      freezeFrames,
      audioVolume: 0
    });
    t = end;
  }

  if (closingText) {
    const index = manifest.plays?.length ?? 0;
    const duration = Math.max(45, estimatedDurations[index] * scale);
    const sourcePaths = (manifest.closingCommentary.sourcePaths ?? []).filter(exists);
    const fallback = sourcePaths[0] ?? manifest.plays?.at(-1)?.sourcePath;
    cues.push({
      start: Number(t.toFixed(3)),
      end: Number((t + duration).toFixed(3)),
      beat: "Closing commentary",
      vo: closingText,
      asset: "edl-clip",
      assetPath: fallback,
      sourceIn: 0,
      sourceOut: Math.min(duration, durationSeconds(fallback) ?? duration),
      treatment: "general Caitlin Clark hype commentary with any strong Clark b-roll; no possession analysis claims",
      overlays: [
        normalizeOverlay(manifest.closingCommentary.receipt || `${manifest.player ?? "Caitlin Clark"} IS DIFFERENT`),
        "BIGGER THAN THE NUMBERS",
        "THE GAME ORBITS AROUND HER"
      ],
      graphics: [],
      freezeFrames: [],
      audioVolume: 0
    });
    t += duration;
  }

  const out = `${VIDEOS_ROOT}/${videoSlug}/edit-script-johnny.json`;
  writeJson(out, {
    title: manifest.title,
    slug: videoSlug,
    sourceManifest: manifestPath,
    voiceDuration: actualVoDuration ?? Number(t.toFixed(3)),
    formula: "clip-first player celebration",
    rules: [
      "No VO beat without a selected play row.",
      "Use Johnny VO for the full narration.",
      "Use Gemini 3.1 Pro and official play-by-play to verify each analyzed play.",
      "Use only text callouts and freeze-frame labels unless coordinates are manually verified."
    ],
    cues
  });
  console.log(out);
}

function checklist() {
  const slug = required("slug");
  const workflowDir = `${WORKFLOW_ROOT}/examples/${slug}`;
  const videoSlug = arg("video-slug", `clip-first-${slug}`);
  console.log(`Clip-first formula checklist for ${slug}

1. Source clips:
   - Save official/social source videos under ${workflowDir}/sources/
   - Use yt-dlp first for YouTube.

2. Create or update selected plays:
   - ${workflowDir}/selected-play-manifest-v1.json
   - Every play needs sourcePath, sourceIn/sourceOut, Gemini 3.1 Pro read, official PBP/stat context, VO beat, and freezeFrames.

3. Validate:
   node tools/ftl-clip-first-formula.mjs validate --manifest "${workflowDir}/selected-play-manifest-v1.json"

4. Export VO script:
   node tools/ftl-clip-first-formula.mjs export-vo --manifest "${workflowDir}/selected-play-manifest-v1.json" --out "${workflowDir}/vo-draft-v1.md"

5. Generate Johnny VO:
   ELEVENLABS_VOICE_ID=jyskLvwz58RBB27YwdcR node tools/generate-elevenlabs-vo-with-pauses.mjs "${workflowDir}/vo-draft-v1.md" "${VIDEOS_ROOT}/${videoSlug}/vo.mp3"

6. Build Hyperframes edit script:
   node tools/ftl-clip-first-formula.mjs build-edit --manifest "${workflowDir}/selected-play-manifest-v1.json" --video-slug "${videoSlug}"

7. Render with Hyperframes:
   cd /Users/abdul/code/fromthelogo/local/ftl-render
   bun run build.ts "${videoSlug}"
   npx hyperframes lint
   node ../../tools/render-hyperframes-clean.mjs --quality draft --workers 1 --output "${VIDEOS_ROOT}/${videoSlug}/render/${videoSlug}-draft.mp4"
`);
}

const command = process.argv[2];
if (!command || ["-h", "--help", "help"].includes(command)) {
  usage();
  process.exit(command ? 0 : 1);
}

if (command === "init") init();
else if (command === "validate") validate();
else if (command === "export-vo") exportVo();
else if (command === "build-edit") buildEdit();
else if (command === "checklist") checklist();
else {
  console.error(`Unknown command: ${command}`);
  usage();
  process.exit(1);
}
