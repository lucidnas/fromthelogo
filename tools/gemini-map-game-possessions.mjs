#!/usr/bin/env node
// Have Gemini watch a full-game highlight and timestamp every Caitlin Clark
// possession (assists + makes), matched against an official play-by-play ledger.
// Built for the Daniel Li-style breakdowns: tells us which sourced possessions
// are actually visible in this footage and where to cut them.
//
// Usage:
//   node tools/gemini-map-game-possessions.mjs \
//     --clip "/Volumes/SSK SSD/broll/social/fever-tempo-2026-06-16/wnba-official-full-highlights.mp4" \
//     --out  "research/daniel-li-bank/idea-b-gemini-possession-map.json" \
//     --ledger "research/daniel-li-bank/idea-b-jun16-toronto-source-ledger.md"

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
function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : (process.argv[i + 1] ?? fallback);
}

const clipPath = arg("clip");
const outPath = arg("out");
const ledgerPath = arg("ledger");
const gameContext = arg("context", "an Indiana Fever game");
const model = arg("model", process.env.GEMINI_MODEL || "gemini-2.5-pro");
if (!clipPath || !outPath) {
  console.error("Usage: --clip FILE --out FILE [--ledger FILE] [--model MODEL]");
  process.exit(1);
}
loadEnvFile(path.resolve(".env"));
loadEnvFile(path.resolve(".env.local"));
if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required");
if (!fs.existsSync(clipPath)) throw new Error(`Clip not found: ${clipPath}`);

const ledger = ledgerPath && fs.existsSync(ledgerPath) ? fs.readFileSync(ledgerPath, "utf8") : "(no ledger provided)";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
console.error(`Uploading ${path.basename(clipPath)} ...`);
const bytes = fs.readFileSync(clipPath);
const upload = await ai.files.upload({
  file: new Blob([bytes], { type: "video/mp4" }),
  config: { mimeType: "video/mp4", displayName: path.basename(clipPath) },
});
let file = upload;
while (file.state === "PROCESSING") {
  await new Promise((r) => setTimeout(r, 2500));
  file = await ai.files.get({ name: file.name });
}
if (file.state !== "ACTIVE") throw new Error(`Gemini upload failed: ${file.state}`);
console.error("Uploaded. Analyzing...");

const prompt = `
You are a basketball film assistant for "From The Logo". You are watching footage for:
${gameContext}

Your job: find every CAITLIN CLARK possession that is visible in THIS video — both her
ASSISTS (she passes, a teammate scores) and her own MADE shots / drawn fouls — and report
the timestamp IN THIS VIDEO (mm:ss) where each one appears.

Here is the official play-by-play ledger of what Clark actually did in the real game
(use it to recognize and match plays; the video is a highlight reel so it will NOT contain
all 14 assists — only report what you can actually SEE):

${ledger}

Watch carefully. For each Clark possession you can see, capture the on-screen game clock,
quarter, and score when visible so it can be matched to the ledger. Be strict: only report
a possession if Clark is clearly involved. Do not invent timestamps.

Return strict JSON only:
{
  "videoDurationSeconds": 0,
  "clarkPossessionsFound": [
    {
      "videoTimestamp": "mm:ss",
      "type": "assist|made_shot|drawn_foul|other",
      "recipientOrScorer": "",
      "shotDescription": "",
      "visibleGameClock": "",
      "visibleQuarter": "",
      "visibleScore": "",
      "matchedLedgerRow": "e.g. Q3 4:30 Cunningham 27-ft three, or null if unmatched",
      "telestrationValue": "high|medium|low",
      "notes": ""
    }
  ],
  "ledgerRowsNotVisibleInThisVideo": ["list ledger assists/plays you could NOT find here"],
  "bestTakeoverRunCoverage": "which sustained Caitlin Clark run or connected sequence is best covered, with timestamps",
  "overallFootageQuality": "",
  "recommendation": "which beats are covered by this reel and which still need a wider source search"
}
`;

const response = await ai.models.generateContent({
  model,
  contents: [{
    role: "user",
    parts: [
      { fileData: { fileUri: file.uri, mimeType: file.mimeType || "video/mp4" } },
      { text: prompt },
    ],
  }],
  config: { temperature: 0, responseMimeType: "application/json", maxOutputTokens: 8192 },
});

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${response.text.trim()}\n`);
console.log(outPath);
