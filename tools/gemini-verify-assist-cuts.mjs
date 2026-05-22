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

function usage() {
  console.error(`Usage:
  node tools/gemini-verify-assist-cuts.mjs --ledger FILE --official FILE --out FILE [--model MODEL]

Uploads each cut from ftl-cut-video-segments.mjs and asks Gemini to classify whether
it is a direct assist candidate, hockey assist, non-assist, duplicate, or unclear.`);
  process.exit(1);
}

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

const ledgerPath = args.get("ledger");
const officialPath = args.get("official");
const outPath = args.get("out");
const model = args.get("model") || process.env.GEMINI_ASSIST_VERIFY_MODEL || process.env.GEMINI_MODEL || "gemini-3.1-pro-preview";

if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required");
if (!ledgerPath || !fs.existsSync(ledgerPath)) throw new Error(`Missing --ledger file: ${ledgerPath}`);
if (!officialPath || !fs.existsSync(officialPath)) throw new Error(`Missing --official file: ${officialPath}`);
if (!outPath) usage();

const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
const official = JSON.parse(fs.readFileSync(officialPath, "utf8"));
const officialContext = {
  sourceName: official.sourceName,
  sources: official.sources,
  clarkBox: official.clark?.game,
  officialClarkAssists: official.clarkAssists,
  relevantScoringEvents: (official.pbp || []).filter((event) => {
    const text = `${event.homePlay || ""} ${event.awayPlay || ""} ${event.eventText || ""}`;
    return /Billings|Mitchell|Cunningham|Hull|Boston|Hines-Allen|3PT|Jump Shot|Layup/i.test(text);
  }),
};

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function uploadClip(filePath) {
  const bytes = fs.readFileSync(filePath);
  const upload = await ai.files.upload({
    file: new Blob([bytes], { type: "video/mp4" }),
    config: {
      mimeType: "video/mp4",
      displayName: path.basename(filePath),
    },
  });
  let file = upload;
  while (file.state === "PROCESSING") {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    file = await ai.files.get({ name: file.name });
  }
  if (file.state !== "ACTIVE") throw new Error(`Gemini upload failed for ${filePath}: ${file.state}`);
  return file;
}

const uploadedParts = [];
for (const segment of ledger.segments || []) {
  if (!fs.existsSync(segment.outputPath)) throw new Error(`Missing segment video: ${segment.outputPath}`);
  console.log(`Uploading ${segment.label} with ${model}...`);
  const file = await uploadClip(segment.outputPath);
  uploadedParts.push({
    file,
    segment: {
      label: segment.label,
      sourceStart: segment.start,
      sourceEnd: segment.end,
      note: segment.note,
      outputPath: segment.outputPath,
    },
  });
}

const prompt = `
You are Gemini acting as a senior WNBA stat-credit auditor and From The Logo producer.

The uploaded videos are short cutdowns from an Indiana Fever social assist package for Caitlin Clark.
The official WNBA liveData box score credits Clark with 8 assists, but the Fever social packaging shows 10 assist-like plays.

For each uploaded cut:
- Watch the possession.
- Identify whether Clark makes the pass that directly leads to the made field goal.
- Count whether the receiver takes 0 dribbles, 1-2 rhythm dribbles, or multiple self-created dribbles after Clark's pass.
- Decide the most accurate category: direct-assist-candidate, hockey-assist, non-assist, duplicate, or unclear.
- Match it to the official play-by-play event if possible.
- Give FTL-safe wording for a Short. Be precise and do not overclaim.

Return strict JSON only:
{
  "overallFinding": "",
  "officialClarkAssistCount": 8,
  "cuts": [
    {
      "label": "",
      "sourceStart": 0,
      "sourceEnd": 0,
      "visibleClockScore": "",
      "finisher": "",
      "madeShot": true,
      "clarkPassType": "",
      "receiverDribblesAfterPass": "",
      "category": "direct-assist-candidate|hockey-assist|non-assist|duplicate|unclear",
      "officialMatch": "",
      "officiallyCreditedToClark": true,
      "confidence": "high|medium|low",
      "why": "",
      "ftlSafeVO": ""
    }
  ],
  "recommendedShortClaim": "",
  "claimRisk": "low|medium|high",
  "scriptBeats": [
    {"time": "0-3s", "visual": "", "overlay": "", "vo": ""}
  ]
}

Segment metadata:
${JSON.stringify(uploadedParts.map((item) => item.segment), null, 2)}

Official WNBA context:
${JSON.stringify(officialContext, null, 2)}
`;

console.log("Requesting assist cut verification...");
const response = await ai.models.generateContent({
  model,
  contents: [{
    role: "user",
    parts: [
      ...uploadedParts.map((item) => ({ fileData: { fileUri: item.file.uri, mimeType: item.file.mimeType || "video/mp4" } })),
      { text: prompt },
    ],
  }],
  config: {
    temperature: 0.05,
    maxOutputTokens: 32768,
    responseMimeType: "application/json",
  },
});

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${response.text.trim()}\n`);
console.log(outPath);
