#!/usr/bin/env node
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

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
  node tools/gemini-assist-credit-audit.mjs --clip FILE --official FILE --out FILE [options]

Audits a Caitlin Clark assist compilation against official play-by-play and identifies
credited assists, possible uncredited assist-like plays, duplicates, and clip timestamps.

Options:
  --title TITLE       Default: Caitlin Clark assist credit audit
  --model MODEL       Default: gemini-3.1-pro-preview

Example:
  node tools/gemini-assist-credit-audit.mjs \\
    --clip "/Volumes/SSK SSD/broll/social/fever-mystics-2026-05-15/26-x-IndianaFever-2056111874911969281.mp4" \\
    --official "/Volumes/SSK SSD/ftl/videos/fever-mystics-2026-05-15/analysis/official-game-context.json" \\
    --out "/Volumes/SSK SSD/ftl/videos/fever-mystics-2026-05-15/analysis/assist-credit-audit.json"`);
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

const clipPath = args.get("clip");
const officialPath = args.get("official");
const outPath = args.get("out");
const title = args.get("title") || "Caitlin Clark assist credit audit";
const model = args.get("model") || process.env.GEMINI_ASSIST_AUDIT_MODEL || process.env.GEMINI_MODEL || "gemini-3.1-pro-preview";

if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required");
if (!clipPath || !fs.existsSync(clipPath)) throw new Error(`Missing --clip file: ${clipPath}`);
if (!officialPath || !fs.existsSync(officialPath)) throw new Error(`Missing --official file: ${officialPath}`);
if (!outPath) usage();

const official = JSON.parse(fs.readFileSync(officialPath, "utf8"));
const officialContext = {
  sourceName: official.sourceName,
  sources: official.sources,
  clarkBox: official.clark?.game,
  officialClarkAssists: official.clarkAssists,
  clarkEvents: official.clarkEvents,
};

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function clipDuration(filePath) {
  try {
    const out = execFileSync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      filePath,
    ], { encoding: "utf8" });
    return Number(out.trim());
  } catch {
    return null;
  }
}

const duration = clipDuration(clipPath);

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
  if (file.state !== "ACTIVE") throw new Error(`Gemini upload failed: ${file.state}`);
  return file;
}

console.log(`Uploading assist compilation to Gemini with ${model}...`);
const file = await uploadClip(clipPath);

const prompt = `
You are Gemini acting as a senior WNBA clip auditor and FTL producer.

The uploaded video is an Indiana Fever social clip advertised as Caitlin Clark's assist package. WNBA official liveData currently credits Clark with 8 assists in this game, while the Fever social packaging appears to present 10 assist-like plays.

Your job is not to blindly trust either source. Watch the full uploaded video and audit every distinct play shown.

The uploaded video duration is ${duration ? `${duration.toFixed(3)} seconds` : "unknown"}. Every clipStart and clipEnd you return must be within the actual video duration. If you are uncertain about a timestamp, estimate conservatively but never return a time outside the video.

For each distinct pass/play:
- Give clip-relative start and end seconds.
- Describe what Clark does.
- Identify the shot taker/finisher by visible jersey/name if possible.
- Identify whether the shot is made.
- Match it to an official credited Clark assist if it appears in the official context.
- If it is not in the official Clark assist list, decide whether it is a plausible uncredited assist candidate, a hockey assist, a pass that should not be an assist, a replay/duplicate, or unclear.
- Explain why.

Return strict JSON only:
{
  "title": ${JSON.stringify(title)},
  "overallFinding": "short paragraph",
  "officialAssistCount": 8,
  "clipPlayCount": 0,
  "creditedMatches": [
    {
      "clipPlayNumber": 1,
      "clipStart": 0,
      "clipEnd": 8,
      "officialEvent": "Q1 8:16 | 3-7 | A. Boston Layup ...",
      "confidence": "high|medium|low"
    }
  ],
  "uncreditedCandidates": [
    {
      "clipPlayNumber": 0,
      "clipStart": 0,
      "clipEnd": 8,
      "quarterClockScoreVisible": "",
      "finisher": "",
      "description": "",
      "whyItLooksLikeAnAssist": "",
      "whyOfficialMayNotHaveCreditedIt": "",
      "confidence": "high|medium|low",
      "shortVideoUse": "exact way to present this as a receipt without overstating"
    }
  ],
  "duplicatesOrNonAssists": [
    {
      "clipPlayNumber": 0,
      "clipStart": 0,
      "clipEnd": 8,
      "reason": ""
    }
  ],
  "shortVideoAngle": {
    "safeTitle": "title that frames this as a credit discrepancy",
    "hook": "first sentence",
    "beats": [
      {"time": "0-3s", "visual": "", "textOverlay": "", "vo": ""}
    ],
    "factCaveat": "one sentence caveat for VO"
  }
}

Official WNBA liveData context:
${JSON.stringify(officialContext, null, 2)}
`;

console.log("Requesting assist-credit audit...");
const response = await ai.models.generateContent({
  model,
  contents: [{ role: "user", parts: [
    { fileData: { fileUri: file.uri, mimeType: file.mimeType || "video/mp4" } },
    { text: prompt },
  ] }],
  config: {
    temperature: 0.05,
    maxOutputTokens: 32768,
    responseMimeType: "application/json",
  },
});

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${response.text.trim()}\n`);
console.log(outPath);
