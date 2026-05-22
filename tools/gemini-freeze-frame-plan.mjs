#!/usr/bin/env node
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";

function usage() {
  console.error(`Usage:
  node tools/gemini-freeze-frame-plan.mjs --alignment FILE --highlight PATH --out FILE [--model MODEL]

Asks Gemini to pick deliberate freeze frames for each VO-aligned cue.`);
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
  if (file.state !== "ACTIVE") throw new Error(`${displayName} upload failed: ${file.state}`);
  return file;
}

const args = parseArgs(process.argv.slice(2));
if (args.has("help")) {
  usage();
  process.exit(0);
}

loadEnvFile(path.resolve(".env"));
loadEnvFile(path.resolve(".env.local"));

const alignmentPath = args.get("alignment");
const highlightPath = args.get("highlight");
const outPath = args.get("out");
const model = args.get("model") || process.env.GEMINI_FREEZE_FRAME_MODEL || process.env.GEMINI_MODEL || "gemini-3.1-pro-preview";

if (!alignmentPath || !highlightPath || !outPath) {
  usage();
  process.exit(1);
}
if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required");
if (!fs.existsSync(alignmentPath)) throw new Error(`Missing alignment: ${alignmentPath}`);
if (!fs.existsSync(highlightPath)) throw new Error(`Missing highlight: ${highlightPath}`);

const alignment = JSON.parse(fs.readFileSync(alignmentPath, "utf8"));
const cueContext = (alignment.alignmentCues || []).map((cue, index) => ({
  cueIndex: index + 1,
  voStart: cue.voStart,
  voEnd: cue.voEnd,
  voLine: cue.voLine,
  overlayLabel: cue.overlayLabel,
  matchStatus: cue.matchStatus,
  treatment: cue.treatment,
  sourceIn: cue.sourceIn,
  sourceOut: cue.sourceOut,
  requiredVisual: cue.requiredVisual,
  whyThisMatches: cue.whyThisMatches,
}));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
console.log(`Uploading highlight: ${highlightPath}`);
const highlightFile = await uploadFile(ai, highlightPath, "video/mp4", path.basename(highlightPath));

const prompt = `
You are Gemini acting as a senior sports video editor for From The Logo.

Watch the attached official highlight video and use the alignment cue list below.
Your job is to choose NON-RANDOM freeze frames for each source-backed cue.

The previous proof reel failed because freeze frames were heuristic and often did not show the exact teaching moment. Fix that.

Rules:
- Return strict JSON only.
- Do not choose freeze frames for missing_from_official_highlight cues.
- Each source-backed cue must have 1 or 2 freeze frames.
- Use 2 freeze frames when the VO cue is 14 seconds or longer.
- Freeze frames must clearly show Caitlin Clark in action, the ball, the defender/help, the passing lane, the shot pocket, or the scoreboard receipt.
- Do not pick random reaction closeups unless the VO is about the stat/receipt or payoff.
- Freeze sourceTime must be between sourceIn and sourceOut.
- The label should be big text that belongs ON THE FREEZE FRAME ONLY.
- Labels must be specific and short, usually 2-5 words. Examples: "HELP LEANS IN", "PASS WINDOW OPENS", "DEFENSE BACKPEDALS", "CLEAN LANE", "CUNNINGHAM READY".
- No arrows/circles for this pass. Text only.

Return this JSON:
{
  "freezeFramePlan": [
    {
      "cueIndex": number,
      "overlayLabel": "cue label",
      "freezeFrames": [
        {
          "sourceTime": number,
          "duration": number,
          "label": "BIG FREEZE TEXT",
          "visualReason": "what exact thing is visible at this frame",
          "voReason": "why this freeze supports the VO line"
        }
      ],
      "avoid": "what not to freeze on for this cue"
    }
  ],
  "notes": ["implementation notes"]
}

Alignment cues:
${JSON.stringify(cueContext, null, 2)}
`;

console.log(`Requesting freeze-frame plan with ${model}...`);
const response = await ai.models.generateContent({
  model,
  contents: [
    {
      role: "user",
      parts: [
        { fileData: { fileUri: highlightFile.uri, mimeType: highlightFile.mimeType || "video/mp4" } },
        { text: prompt },
      ],
    },
  ],
  config: {
    temperature: 0.05,
    maxOutputTokens: 32768,
    responseMimeType: "application/json",
  },
});

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, response.text);
console.log(`Wrote ${outPath}`);
