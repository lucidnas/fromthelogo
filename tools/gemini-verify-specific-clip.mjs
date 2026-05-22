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

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}

const clipPath = arg("clip");
const outPath = arg("out");
const claim = arg("claim");
const model = arg("model", process.env.GEMINI_MODEL || "gemini-3.1-pro-preview");

if (!clipPath || !outPath || !claim) {
  console.error("Usage: node tools/gemini-verify-specific-clip.mjs --clip FILE --claim TEXT --out FILE [--model MODEL]");
  process.exit(1);
}

loadEnvFile(path.resolve(".env"));
loadEnvFile(path.resolve(".env.local"));
if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required");
if (!fs.existsSync(clipPath)) throw new Error(`Clip not found: ${clipPath}`);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const bytes = fs.readFileSync(clipPath);
const upload = await ai.files.upload({
  file: new Blob([bytes], { type: "video/mp4" }),
  config: { mimeType: "video/mp4", displayName: path.basename(clipPath) },
});

let file = upload;
while (file.state === "PROCESSING") {
  await new Promise((resolve) => setTimeout(resolve, 2500));
  file = await ai.files.get({ name: file.name });
}
if (file.state !== "ACTIVE") throw new Error(`Gemini upload failed: ${file.state}`);

const prompt = `
You are verifying a basketball video clip for From The Logo before editing.

Claim to verify:
${claim}

Watch the uploaded clip carefully. Return strict JSON only:
{
  "claimMatchesClip": true,
  "confidence": "high|medium|low",
  "visibleGameClock": "",
  "visibleQuarter": "",
  "visibleScore": "",
  "visibleShotClock": "",
  "whatActuallyHappens": "",
  "caitlinClarkRole": "",
  "recipientOrScorer": "",
  "isBillingsLayup": true,
  "isClarkAssist": true,
  "evidence": [
    "visible screen evidence only"
  ],
  "mismatchReasons": [
    "if claimMatchesClip is false, list exact reasons"
  ],
  "bestUsableTimestampRangeInThisClip": {
    "start": 0,
    "end": 0,
    "reason": ""
  },
  "recommendedAction": "use clip|trim differently|do not use|needs wider source search"
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
  config: {
    temperature: 0,
    responseMimeType: "application/json",
    maxOutputTokens: 4096,
  },
});

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${response.text.trim()}\n`);
console.log(outPath);
