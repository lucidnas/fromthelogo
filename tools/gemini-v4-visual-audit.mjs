#!/usr/bin/env node
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && !process.env[key]) process.env[key] = value;
  }
}

function requiredArg(name) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || !process.argv[i + 1]) throw new Error(`Missing --${name}`);
  return process.argv[i + 1];
}

loadEnv(path.resolve(".env"));
loadEnv(path.resolve("local/.env.local"));

const slug = requiredArg("slug");
const model = process.env.GEMINI_MODEL_OVERRIDE || "gemini-3.1-pro-preview";
if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");

const root = `/Volumes/SSK SSD/ftl/videos/${slug}`;
const auditDir = `${root}/analysis/gemini-v4-visual-audit`;
const editPath = `${root}/edit-script-johnny.json`;
const officialPath = `${root}/analysis/official-game-context.md`;
const outPath = `${auditDir}/gemini-v4-visual-audit.json`;

const edit = JSON.parse(fs.readFileSync(editPath, "utf8"));
const official = fs.existsSync(officialPath) ? fs.readFileSync(officialPath, "utf8") : "";
const cueBrief = edit.cues.map((cue, cueIndex) => ({
  cueIndex,
  start: cue.start,
  end: cue.end,
  beat: cue.beat,
  vo: cue.vo,
  asset: path.basename(cue.assetPath || ""),
  sourceIn: cue.sourceIn,
  sourceOut: cue.sourceOut,
  overlays: cue.overlays,
  freezeFrames: cue.freezeFrames,
}));

const imageFiles = [
  "render-v4-10sec-sheet.jpg",
  "source-hq-0to120-4sec.jpg",
  "source-hq-120to240-4sec.jpg",
  "source-hq-240to360-4sec.jpg",
  "source-hq-360to480-4sec.jpg",
  "source-hq-480to600-4sec.jpg",
].map((file) => `${auditDir}/${file}`);

const parts = [{
  text: `You are Gemini 3.1 Pro acting as senior basketball video editor and visual QC for From The Logo.

Task: audit whether the rendered v4 video visuals match the VO beats. The user says the script/VO is good, but visuals have duplicate labels and wrong clips after section 1. We already know duplicate labels are a render design issue; focus your visual audit on exact clip alignment.

Images attached:
1. render-v4-10sec-sheet.jpg: current rendered video sampled every 10 seconds, timestamps in yellow are render-relative.
2-6. source-hq sheets from the full WNBA highlight master. Each source sheet file name gives the absolute source range; yellow timestamps inside the sheet are relative to that 120 second range and sampled every 4 seconds. Convert source times to absolute by adding the file range start. Example: source-hq-360to480 with yellow 00:01:12 means absolute source time 432s.

Official game context / PBP receipts:
${official.slice(0, 12000)}

Current edit cues:
${JSON.stringify(cueBrief, null, 2)}

Return STRICT JSON only. For every cue, especially cues 4-12, say if the source window matches the VO and official play. If not, provide a corrected absolute source window from the source sheets when visible. We need exact enough seconds to cut an 8-13 second clip.

Schema:
{
  "overallAssessment": "short blunt QC summary",
  "duplicateLabelFix": "what to do in render",
  "cueAudits": [
    {
      "cueIndex": 4,
      "beat": "...",
      "voClaim": "what VO says should be shown",
      "currentSourceWindow": {"start": 145, "end": 155},
      "currentVisualMatch": "correct|wrong|partial|unclear_from_sheets",
      "whatCurrentWindowShows": "visible description with clock/score if readable",
      "correctedSourceWindow": {"start": 145, "end": 155},
      "confidence": "high|medium|low",
      "reason": "why this is the right clip, citing visible game clock/score/player action from sheets",
      "freezeFrameSecond": 149,
      "overlayText": "short callout"
    }
  ],
  "mustRepairCueIndexes": [4,5],
  "safeCueIndexes": [0,1]
}`
}];

for (const file of imageFiles) {
  const data = fs.readFileSync(file).toString("base64");
  parts.push({ text: `Attached image: ${path.basename(file)}` });
  parts.push({ inlineData: { mimeType: "image/jpeg", data } });
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const res = await ai.models.generateContent({
  model,
  contents: [{ role: "user", parts }],
  config: { maxOutputTokens: 20000, responseMimeType: "application/json" },
});

fs.mkdirSync(auditDir, { recursive: true });
fs.writeFileSync(outPath, `${(res.text || "").trim()}\n`);
console.log(outPath);
