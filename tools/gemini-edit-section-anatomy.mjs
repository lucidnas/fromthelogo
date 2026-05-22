#!/usr/bin/env node
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

loadEnvFile(path.resolve(".env"));
loadEnvFile(path.resolve(".env.local"));

const [videoPath, startSecsRaw, outputPath] = process.argv.slice(2);
const startSecs = Number(startSecsRaw || 0);

if (!videoPath || !outputPath || !Number.isFinite(startSecs)) {
  console.error("Usage: node tools/gemini-edit-section-anatomy.mjs <segment.mp4> <absoluteStartSecs> <output.json>");
  process.exit(1);
}

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is required");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const videoBytes = fs.readFileSync(videoPath);

const upload = await ai.files.upload({
  file: new Blob([videoBytes], { type: "video/mp4" }),
  config: { mimeType: "video/mp4", displayName: path.basename(videoPath) },
});

let file = upload;
while (file.state === "PROCESSING") {
  await new Promise(resolve => setTimeout(resolve, 3000));
  file = await ai.files.get({ name: file.name });
}

if (file.state !== "ACTIVE") {
  throw new Error(`Gemini upload failed with state ${file.state}`);
}

const prompt = `
You are a senior YouTube editor reverse-engineering this Awful Coaching section.

Important:
- Analyze ONLY what is visibly present in this uploaded segment.
- Do NOT assume arrows, circles, freeze frames, zooms, or overlays. If there are none, write "none visible".
- This is not a content summary. It is an edit-timing report.
- Use absolute timestamps. This segment starts at ${startSecs} seconds in the full video.
- Create dense rows every 2-6 seconds, and every time the visual state changes.

Return strict JSON:
{
  "segmentStartSecs": ${startSecs},
  "segmentSummary": "one sentence edit structure summary",
  "events": [
    {
      "startSecs": number,
      "endSecs": number,
      "visualState": "live broadcast|replay|freeze/hold|zoom/crop|graphic|other",
      "cameraOrCrop": "what the viewer sees: full court, tight ballhandler crop, replay angle, scoreboard visible, etc.",
      "visibleOverlays": "none visible OR exact overlay/text/arrow/circle if present",
      "voFunction": "hook|points at defender|explains mistake|explains Clark read|payoff|transition",
      "editMove": "cut|hold|replay|slowdown|freeze|zoom|none visible",
      "retentionPurpose": "why this moment keeps attention",
      "ftlReplication": "exact instruction we can reuse for FTL"
    }
  ],
  "observedPattern": "the repeatable edit pattern in this segment",
  "notesForAutomation": ["concrete field or rule to add to our clip-led edit JSON"]
}
`;

const response = await ai.models.generateContent({
  model: process.env.GEMINI_VIDEO_QC_MODEL || process.env.GEMINI_MODEL || "gemini-3.1-pro-preview",
  contents: [
    {
      role: "user",
      parts: [
        { fileData: { fileUri: file.uri, mimeType: file.mimeType || "video/mp4" } },
        { text: prompt },
      ],
    },
  ],
  config: {
    temperature: 0,
    maxOutputTokens: 16384,
    responseMimeType: "application/json",
  },
});

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${response.text.trim()}\n`);
console.log(outputPath);
