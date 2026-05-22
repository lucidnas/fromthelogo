#!/usr/bin/env node
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

function usage() {
  console.error(`Usage:
  node tools/gemini-awful-section-edit-plan.mjs \\
    --slug SLUG \\
    --section S01 \\
    --section-video /path/section.mp4 \\
    --section-start 0 \\
    --section-end 85 \\
    --out /path/plan.json

Options:
  --section-edit FILE       Default: /Volumes/SSK SSD/ftl/videos/{slug}-section-{section}/edit-script-johnny-v2.json
  --awful-template FILE     Default: research/awful-coaching-20260518-timestamped-edit-template-gemini.md
  --source-dir DIR          Default: /Volumes/SSK SSD/broll/social/{slug}
  --max-source-clips N      Default: 10, excluding assets already used by the section
  --model MODEL             Default: gemini-3.1-pro-preview
`);
  process.exit(1);
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const raw of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) usage();
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) args.set(key, "true");
    else {
      args.set(key, next);
      i += 1;
    }
  }
  return args;
}

function durationOf(filePath) {
  try {
    const out = execFileSync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=nk=1:nw=1",
      filePath,
    ], { encoding: "utf8" }).trim();
    const n = Number(out);
    return Number.isFinite(n) ? +n.toFixed(3) : null;
  } catch {
    return null;
  }
}

function fmtTime(seconds) {
  const n = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(n / 60);
  const s = Math.floor(n % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

loadEnvFile(path.resolve(".env"));
loadEnvFile(path.resolve(".env.local"));

const args = parseArgs(process.argv.slice(2));
const slug = args.get("slug");
const section = args.get("section");
const sectionVideo = args.get("section-video");
const sectionStart = Number(args.get("section-start"));
const sectionEnd = Number(args.get("section-end"));
const outPath = args.get("out");

if (!slug || !section || !sectionVideo || !Number.isFinite(sectionStart) || !Number.isFinite(sectionEnd) || !outPath) {
  usage();
}
if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required");

const SSD = "/Volumes/SSK SSD";
const sectionEditPath = args.get("section-edit") || `${SSD}/ftl/videos/${slug}-section-${section}/edit-script-johnny-v2.json`;
const awfulTemplatePath = args.get("awful-template") || "research/awful-coaching-20260518-timestamped-edit-template-gemini.md";
const sourceDir = args.get("source-dir") || `${SSD}/broll/social/${slug}`;
const maxSourceClips = Number(args.get("max-source-clips") || 10);
const model = args.get("model") || "gemini-3.1-pro-preview";

for (const filePath of [sectionVideo, sectionEditPath, awfulTemplatePath]) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing required file: ${filePath}`);
}

const sectionEdit = JSON.parse(fs.readFileSync(sectionEditPath, "utf8"));
const awfulTemplate = fs.readFileSync(awfulTemplatePath, "utf8");
const cues = (sectionEdit.cues || []).map((cue, index) => ({
  index,
  sectionStart: cue.start,
  sectionEnd: cue.end,
  absoluteStart: +(sectionStart + Number(cue.start || 0)).toFixed(3),
  absoluteEnd: +(sectionStart + Number(cue.end || 0)).toFixed(3),
  beat: cue.beat,
  vo: cue.vo,
  asset: cue.asset,
  assetPath: cue.assetPath,
  sourceIn: cue.sourceIn,
  sourceOut: cue.sourceOut,
  treatment: cue.treatment,
}));

const socialFiles = fs.existsSync(sourceDir)
  ? fs.readdirSync(sourceDir)
    .filter((f) => /\.(mp4|mov|m4v)$/i.test(f) && !f.startsWith("._"))
    .sort()
    .map((f) => path.join(sourceDir, f))
  : [];

const usedAssets = new Set(
  cues
    .map((cue) => cue.assetPath || (cue.asset ? path.join(sourceDir, cue.asset) : null))
    .filter(Boolean)
    .filter((p) => fs.existsSync(p))
);

const primaryAssets = [...usedAssets];
const extraAssets = socialFiles
  .filter((filePath) => !usedAssets.has(filePath))
  .slice(0, Math.max(0, maxSourceClips));
const candidateAssets = [...primaryAssets, ...extraAssets];

const assetInventory = candidateAssets.map((filePath, index) => ({
  uploadLabel: `asset_${index + 1}`,
  filename: path.basename(filePath),
  path: filePath,
  duration: durationOf(filePath),
  usedInCurrentSection: usedAssets.has(filePath),
}));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function uploadVideo(filePath, label) {
  console.error(`Uploading ${label}: ${filePath}`);
  let file = await ai.files.upload({
    file: filePath,
    config: { mimeType: "video/mp4", displayName: `${label}-${path.basename(filePath)}` },
  });
  while (file.state === "PROCESSING") {
    console.error(`${label} Gemini state: ${file.state}`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    file = await ai.files.get({ name: file.name });
  }
  console.error(`${label} Gemini state: ${file.state}`);
  if (file.state !== "ACTIVE") throw new Error(`Gemini upload failed for ${filePath}: ${file.state}`);
  return file;
}

const sectionFile = await uploadVideo(sectionVideo, `${section}-current-render`);
const uploadedAssets = [];
for (const [index, asset] of assetInventory.entries()) {
  uploadedAssets.push({
    ...asset,
    file: await uploadVideo(asset.path, asset.uploadLabel),
    index,
  });
}

const prompt = `
You are Gemini acting as the senior editor for From The Logo.

You are reviewing ONE section of an existing Caitlin Clark video. Your job is to design a complete replacement edit plan for this section in the style of the Awful Coaching editing template.

Inputs:
- The first uploaded video is the CURRENT rendered section that needs repair.
- The following uploaded videos are candidate source clips/B-roll. Use these exact uploaded assets when possible.
- The section VO and current cue context are below.
- The Awful Coaching edit-template analysis is below.

Output goal:
Return an executable second-by-second edit plan for this section. Every second must be accounted for until the section ends.

What the plan must include:
- Exact timestamp ranges inside this section and absolute video timestamps.
- Exact clip/source asset to use at each timestamp.
- Source in/out values must be original timecodes inside the named source asset, not section-relative timecodes.
- Use current cue sourceIn/sourceOut values as anchors when the source asset is already in the current section.
- If you cannot verify an original source timecode, write "unknown - inspect uploaded asset" instead of inventing 00:00.
- How many seconds to play live video before freezing or cutting.
- Exact moment to freeze, how long to hold the freeze, and what the freeze should show.
- Whether to use slow motion, punch-in, zoom, scoreboard hold, distance marker, circle, arrow, label, split-screen, replay, reaction, social B-roll, or natural audio.
- What kind of clip should come next and for how many seconds.
- Why each edit supports fair-use-oriented commentary, the way Awful Coaching does.
- No timeline row may be longer than 8 seconds.
- Any play/idea that needs more than 8 seconds must be split into live setup, freeze/read, slow replay, payoff, and reaction rows.
- Do not leave long raw highlight runs. A 20+ second stretch of "live setup" is a failure.
- The section plan must cover the whole section with many small rows, not one large catch-all row.

Important creative rules:
- Match the Awful Coaching pattern: live setup -> freeze/read frame -> optional second read/slow replay -> live payoff -> transition/social reaction.
- Caitlin Clark is the emotional center.
- Do not allow lazy loops of the same broadcast source window.
- Do not replace loops with one long unedited broadcast run.
- Repeats are only allowed if the treatment changes: freeze/read, slow replay, zoom/crop, alternate angle, reaction, or graphic.
- Use social clips to replace repeated broadcast filler, add reaction/emotion, or bridge between analysis beats.
- Effects/graphics are encouraged when they make the edit more analytical and transformative: circles, arrows, distance markers, clock/score receipts, labels, zooms, freeze frames, slow motion, or comparison boards.
- Do not add random effects. Every effect must point to a concrete VO phrase or basketball read.

Return strict JSON only:
{
  "section": "${section}",
  "sectionStartAbsolute": ${sectionStart},
  "sectionEndAbsolute": ${sectionEnd},
  "overallPlan": "short description",
  "timeline": [
    {
      "sectionTime": "MM:SS-MM:SS",
      "absoluteTime": "MM:SS-MM:SS",
      "durationSecs": 0,
      "voBeat": "VO line/idea this supports",
      "visualType": "live setup|freeze/read frame|slow replay|social broll|reaction|live payoff|transition|graphic board|split screen",
      "sourceAsset": "exact uploaded filename or SOURCE_NEEDED",
      "sourceInOut": "exact or approximate source in/out",
      "screenAction": "what appears on screen",
      "freezeInstruction": "exact frame/time to freeze, duration, and why; or none",
      "effectsGraphics": "circles/arrows/labels/scoreboard/distance/zoom/crop/split-screen; or none",
      "audioInstruction": "VO only, duck music, bring up natural audio for X seconds, silence/pause, etc.",
      "nextClipInstruction": "what kind of clip comes next and why",
      "fairUsePurpose": "how this edit adds commentary/analysis/transformation"
    }
  ],
  "sourceAssetPlan": [
    {
      "filename": "uploaded filename",
      "useOrSkip": "use|skip|maybe",
      "bestMoments": ["timestamp or description"],
      "reason": "why"
    }
  ],
  "implementationChecklist": [
    "ordered exact implementation step"
  ],
  "edlPatchGuidance": [
    {
      "replaceCurrentCueIndexes": [0],
      "newCueSummary": "what the patched cue(s) should become"
    }
  ]
}

Section time starts at 00:00. Absolute time starts at ${fmtTime(sectionStart)}.
The plan timeline must cover 00:00-${fmtTime(sectionEnd - sectionStart)} with no gaps larger than 0.5 seconds.
The plan timeline must also have no single row longer than 8 seconds. If you are tempted to create a longer row, split it into smaller Awful Coaching-style beats.

Candidate uploaded source assets:
${assetInventory.map((a) => `- ${a.uploadLabel}: ${a.filename}, duration=${a.duration}s, usedInCurrentSection=${a.usedInCurrentSection}`).join("\n")}

Source-time anchor rules:
- For existing broadcast/highlight clips, the current section cue context below gives the original sourceIn values.
- For example, if a cue uses sourceIn 35.5 from 20-youtube-manual-hFIojc86JBo.mp4, any replacement using that same moment should stay near 35.5 in that source file, not 00:00.
- Do not convert source asset timecodes to section-relative time.
- Do not start every source at 00:00 unless the uploaded source clip genuinely starts with the needed moment.

Current section cue context:
${JSON.stringify(cues, null, 2)}

Awful Coaching edit-template analysis:
${awfulTemplate}
`;

const parts = [
  { fileData: { fileUri: sectionFile.uri, mimeType: sectionFile.mimeType || "video/mp4" } },
  ...uploadedAssets.map((asset) => ({
    fileData: { fileUri: asset.file.uri, mimeType: asset.file.mimeType || "video/mp4" },
  })),
  { text: prompt },
];

let response;
for (let attempt = 1; attempt <= 4; attempt += 1) {
  try {
    response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: {
        temperature: 0.1,
        maxOutputTokens: 65536,
        responseMimeType: "application/json",
      },
    });
    break;
  } catch (error) {
    if (attempt === 4) throw error;
    const delayMs = attempt * 15000;
    console.error(`Gemini generateContent failed on attempt ${attempt}; retrying in ${delayMs / 1000}s`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, response.text);

const parsed = JSON.parse(response.text);
const mdPath = outPath.replace(/\.json$/i, ".md");
const md = [];
md.push(`# Gemini Awful-Style Section Plan ${section}`);
md.push("");
md.push(`Section: ${sectionStart}s-${sectionEnd}s`);
md.push("");
md.push(`Overall plan: ${parsed.overallPlan || ""}`);
md.push("");
md.push("## Timeline");
for (const [index, row] of (parsed.timeline || []).entries()) {
  md.push(`### ${index + 1}. ${row.sectionTime} / ${row.absoluteTime}`);
  md.push(`- Duration: ${row.durationSecs}s`);
  md.push(`- VO: ${row.voBeat}`);
  md.push(`- Visual: ${row.visualType}`);
  md.push(`- Source: ${row.sourceAsset} (${row.sourceInOut})`);
  md.push(`- Screen: ${row.screenAction}`);
  md.push(`- Freeze: ${row.freezeInstruction}`);
  md.push(`- Effects: ${row.effectsGraphics}`);
  md.push(`- Audio: ${row.audioInstruction}`);
  md.push(`- Next: ${row.nextClipInstruction}`);
  md.push(`- Fair use: ${row.fairUsePurpose}`);
  md.push("");
}
md.push("## Source Asset Plan");
for (const row of parsed.sourceAssetPlan || []) {
  md.push(`- ${row.filename}: ${row.useOrSkip} - ${row.reason}`);
  for (const moment of row.bestMoments || []) md.push(`  - ${moment}`);
}
md.push("");
md.push("## Implementation Checklist");
for (const item of parsed.implementationChecklist || []) md.push(`- ${item}`);
md.push("");
md.push("## EDL Patch Guidance");
for (const row of parsed.edlPatchGuidance || []) {
  md.push(`- Replace cues ${(row.replaceCurrentCueIndexes || []).join(", ")}: ${row.newCueSummary}`);
}
fs.writeFileSync(mdPath, md.join("\n"));

console.log(outPath);
console.log(mdPath);
