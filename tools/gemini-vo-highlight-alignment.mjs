#!/usr/bin/env node
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function usage() {
  console.error(`Usage:
  node tools/gemini-vo-highlight-alignment.mjs --slug SLUG --highlight PATH [--vo PATH] [--edit PATH] [--out PATH] [--model MODEL]

Creates a Gemini alignment map from the final VO audio to an official highlight video.
The output is strict JSON designed to become the source of truth for rebuilding edit-script-johnny.json.`);
}

function parseArgs(argv) {
  const out = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      out.set("help", "1");
      continue;
    }
    if (!arg.startsWith("--")) throw new Error(`Unexpected arg: ${arg}`);
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
    out.set(key, value);
    i += 1;
  }
  return out;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

function mustExist(label, filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${label}: ${filePath}`);
  }
}

function durationSecs(filePath) {
  const result = spawnSync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ], { encoding: "utf8" });
  if (result.status !== 0) return null;
  const value = Number(result.stdout.trim());
  return Number.isFinite(value) ? value : null;
}

async function uploadFile(ai, filePath, mimeType, displayName) {
  const bytes = fs.readFileSync(filePath);
  const upload = await ai.files.upload({
    file: new Blob([bytes], { type: mimeType }),
    config: { mimeType, displayName },
  });

  let file = upload;
  while (file.state === "PROCESSING") {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    file = await ai.files.get({ name: file.name });
  }

  if (file.state !== "ACTIVE") {
    throw new Error(`Gemini upload failed for ${displayName}: ${file.state}`);
  }
  return file;
}

const args = parseArgs(process.argv.slice(2));
if (args.has("help")) {
  usage();
  process.exit(0);
}

loadEnvFile(path.resolve(".env"));
loadEnvFile(path.resolve(".env.local"));

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is required in .env, .env.local, or environment");
  process.exit(1);
}

const SSD = "/Volumes/SSK SSD";
const slug = args.get("slug");
if (!slug) {
  usage();
  process.exit(1);
}

const videoDir = `${SSD}/ftl/videos/${slug}`;
const voPath = args.get("vo") || `${videoDir}/vo.mp3`;
const highlightPath = args.get("highlight");
const editPath = args.get("edit") || `${videoDir}/edit-script-johnny.json`;
const outPath = args.get("out") || `${videoDir}/analysis/gemini-vo-official-highlight-alignment.json`;
const model = args.get("model") || process.env.GEMINI_ALIGNMENT_MODEL || process.env.GEMINI_MODEL || "gemini-3.1-pro-preview";

if (!highlightPath) {
  usage();
  process.exit(1);
}

mustExist("VO", voPath);
mustExist("official highlight", highlightPath);
mustExist("current edit script", editPath);

const edit = JSON.parse(fs.readFileSync(editPath, "utf8"));
const currentCueContext = (edit.cues || []).map((cue, index) => ({
  index,
  timelineStart: cue.start,
  timelineEnd: cue.end,
  currentVo: cue.vo || "",
  currentLabel: Array.isArray(cue.overlays) ? cue.overlays.join(" / ") : "",
  currentAsset: cue.asset || path.basename(cue.assetPath || ""),
  currentSourceIn: cue.sourceIn ?? null,
  currentSourceOut: cue.sourceOut ?? null,
  currentTreatment: cue.treatment || "",
}));

const voDuration = durationSecs(voPath) ?? edit.voiceDuration ?? null;
const highlightDuration = durationSecs(highlightPath) ?? null;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

console.log(`Uploading VO: ${voPath}`);
const voFile = await uploadFile(ai, voPath, "audio/mpeg", `${slug}-vo.mp3`);
console.log(`Uploading official highlight: ${highlightPath}`);
const highlightFile = await uploadFile(ai, highlightPath, "video/mp4", `${slug}-${path.basename(highlightPath)}`);

const prompt = `
You are Gemini acting as the senior video editor and clip alignment specialist for From The Logo.

Task:
Listen to the attached final VO audio and watch the attached official highlight video. Build a precise alignment map that tells us what exact official-highlight source moment should be shown for each VO statement and what label should be on screen.

This is not a generic review. The current rendered edit has major mismatch problems:
- what the VO says,
- what the on-screen label says,
- and what the actual clip shows
are often not aligned.

Use the VO as the master timeline. Use the official highlight as the source timeline.

Inputs:
- VO audio duration: ${voDuration == null ? "unknown" : voDuration.toFixed(3)} seconds.
- Official highlight duration: ${highlightDuration == null ? "unknown" : highlightDuration.toFixed(3)} seconds.
- Official highlight absolute path: ${highlightPath}
- Current rough edit JSON context is included below only so you can identify and correct mismatch patterns.

Channel/editorial rules:
- FTL is Caitlin Clark / Indiana Fever first.
- The visual must prove the sentence being spoken at that exact moment.
- On-screen labels must describe the specific thing the viewer can see, not a vague hype phrase.
- Do not invent player names. If unsure, use neutral labels like "CUTTER", "HELP", "PULL-UP", "PASS WINDOW", "SECOND DEFENDER".
- Defenders are WNBA players. Do not use male pronouns for defenders.
- Prefer exact Clark plays from the official highlight. If the VO line cannot be matched to the official highlight, mark matchStatus as "missing_from_official_highlight" and describe the type of social/media clip needed.
- If the VO discusses a stat, lead, quarter, clock, or score, pick a source moment that visibly supports the receipt.
- If a cue needs a freeze frame, the freeze frame sourceTime must show Caitlin Clark clearly in action or making the read.
- No arrows/circles in this pass. Text labels only, unless you recommend "freezeOnly" as a treatment.

Required output:
Return strict JSON only with this exact shape:
{
  "slug": "${slug}",
  "model": "${model}",
  "voDuration": number,
  "officialHighlight": {
    "asset": "${path.basename(highlightPath)}",
    "assetPath": "${highlightPath}",
    "duration": number
  },
  "alignmentSummary": {
    "overallDiagnosis": "short blunt diagnosis of current alignment problem",
    "officialHighlightCoverage": "how much of the VO can be matched from the official highlight",
    "needsSocialClips": number,
    "repairPrinciple": "one sentence rule for rebuilding the edit"
  },
  "alignmentCues": [
    {
      "voStart": number,
      "voEnd": number,
      "voLine": "exact or close transcript of the VO statement in this range",
      "requiredVisual": "plain English description of what must be shown",
      "matchStatus": "exact|partial|missing_from_official_highlight|non_play_context",
      "confidence": "high|medium|low",
      "asset": "${path.basename(highlightPath)}",
      "assetPath": "${highlightPath}",
      "sourceIn": number,
      "sourceOut": number,
      "freezeFrames": [
        {
          "voStartOffset": number,
          "duration": number,
          "sourceTime": number,
          "purpose": "why this freeze belongs here",
          "label": "SHORT LABEL"
        }
      ],
      "overlayLabel": "SHORT, SPECIFIC, ALL CAPS LABEL",
      "labelStart": number,
      "labelEnd": number,
      "treatment": "live|replay|slowmo|freezeOnly|statReceipt|socialClipNeeded",
      "whyThisMatches": "specific proof that this source moment matches the VO",
      "ifMissingNeededClip": "empty string unless matchStatus is missing_from_official_highlight"
    }
  ],
  "currentCueMismatchAudit": [
    {
      "currentCueIndex": number,
      "timeline": "start-end",
      "currentLabel": "label from current edit",
      "currentSource": "sourceIn-sourceOut",
      "verdict": "keep|retime|replace|delete",
      "reason": "specific mismatch or reason it works",
      "recommendedAlignmentCueIndex": number
    }
  ],
  "implementationNotes": [
    "specific instruction for converting this into edit-script-johnny.json"
  ]
}

Cue requirements:
- alignmentCues must cover the full VO duration from 0.000 to the end. No gaps. No overlaps.
- Use short ranges: normally 3-9 seconds. Longer only for non-play context.
- Round all times to 3 decimals.
- Use the official highlight source time when there is a matching play.
- For missing social clip beats, still include voStart/voEnd, overlayLabel, treatment "socialClipNeeded", and set sourceIn/sourceOut to null.
- Include at least one cue for every distinct VO sentence or thought.
- The result should be directly usable to rebuild a new edit script with the correct timeline/source alignment.

Current rough edit context:
${JSON.stringify(currentCueContext, null, 2)}
`;

console.log(`Requesting Gemini alignment with ${model}...`);
const response = await ai.models.generateContent({
  model,
  contents: [
    {
      role: "user",
      parts: [
        { fileData: { fileUri: voFile.uri, mimeType: voFile.mimeType || "audio/mpeg" } },
        { fileData: { fileUri: highlightFile.uri, mimeType: highlightFile.mimeType || "video/mp4" } },
        { text: prompt },
      ],
    },
  ],
  config: {
    temperature: 0.05,
    maxOutputTokens: 65536,
    responseMimeType: "application/json",
  },
});

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, response.text);
console.log(`Wrote ${outPath}`);
