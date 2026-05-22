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

const clipsManifestPath = args.get("clips");
const outPath = args.get("out");
const title = args.get("title") || "Untitled FTL Clark Breakdown";
const scoreContextPath = args.get("score-context");
const maxClips = Number(args.get("max-clips") || "0");
const model = args.get("model") || process.env.GEMINI_POSSESSION_MODEL || process.env.GEMINI_MODEL || "gemini-3.1-pro-preview";

if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required");
if (!clipsManifestPath) throw new Error("Missing --clips /path/to/caitlin-selects-manifest.json");
if (!outPath) throw new Error("Missing --out /path/to/possession-breakdown.json");

const manifest = JSON.parse(fs.readFileSync(clipsManifestPath, "utf8"));
const allClips = Array.isArray(manifest) ? manifest : manifest.clips;
if (!Array.isArray(allClips) || !allClips.length) throw new Error(`No clips found in ${clipsManifestPath}`);

const clips = allClips
  .filter(clip => clip.clipPath && fs.existsSync(clip.clipPath))
  .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
  .slice(0, maxClips > 0 ? maxClips : allClips.length);

if (!clips.length) throw new Error("No existing clipPath files found");

const scoreContext = scoreContextPath && fs.existsSync(scoreContextPath)
  ? fs.readFileSync(scoreContextPath, "utf8")
  : "";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function uploadClip(clip, index) {
  const bytes = fs.readFileSync(clip.clipPath);
  const upload = await ai.files.upload({
    file: new Blob([bytes], { type: "video/mp4" }),
    config: {
      mimeType: "video/mp4",
      displayName: `${String(index + 1).padStart(2, "0")}-${path.basename(clip.clipPath)}`,
    },
  });

  let file = upload;
  while (file.state === "PROCESSING") {
    await new Promise(resolve => setTimeout(resolve, 2500));
    file = await ai.files.get({ name: file.name });
  }
  if (file.state !== "ACTIVE") throw new Error(`Gemini upload failed for ${clip.clipPath}: ${file.state}`);
  return file;
}

console.log(`Uploading ${clips.length} Clark clip(s) to Gemini with ${model}...`);
const uploads = [];
for (let i = 0; i < clips.length; i += 1) {
  console.log(`Uploading ${i + 1}/${clips.length}: ${clips[i].label || path.basename(clips[i].clipPath)}`);
  uploads.push(await uploadClip(clips[i], i));
}

const clipContext = clips.map((clip, index) => ({
  index,
  label: clip.label,
  type: clip.type,
  priority: clip.priority,
  clipPath: clip.clipPath,
  sourcePath: clip.sourcePath,
  sourceIn: clip.start || clip.startSecs,
  sourceOut: clip.end || clip.endSecs,
  why: clip.why,
  suggestedTreatment: clip.suggestedTreatment,
}));

const prompt = `
You are Gemini acting as the senior possession analyst and senior video editor for From The Logo.

FTL's job is to positively explain Caitlin Clark's value on every usable possession. The final score does not control the framing. Even if the shot misses or Indiana loses, identify what Clark created: gravity, pace, manipulation, defensive collapse, passing window, advantage creation, shot quality, or pressure.

Analyze the uploaded highlight clips one by one. Do not summarize the game. Produce a detailed possession-level breakdown we can turn directly into an Awful Coaching-style FTL video.

For every clip, identify:
- visible quarter/game clock/shot clock/score if readable
- Clark's location and role to start the possession
- offensive alignment and spacing
- defender positions, including jersey numbers if readable
- the specific move or read Clark makes
- the defensive mistake or impossible choice she creates
- the positive Clark value, even if the play is not a made basket
- whether the official play-by-play/box score should verify a made FG, assist, turnover, foul, rebound, or clock/score
- exact freeze-frame moments and overlay instructions
- an FTL-style VO beat that is positive, causal, and screen-directed
- a timestamped edit plan for that clip

Language target:
- Clear film-room direction: "Freeze it here", "Watch the weak side", "That half step is already late"
- Positive Clark framing: gravity, collapse, manipulation, read, pressure, pace, punishment
- Avoid generic recap phrasing
- Avoid saying the team failed as the emotional frame
- Do not copy Awful Coaching's exact verbal fingerprints too heavily

Return strict JSON only:
{
  "title": ${JSON.stringify(title)},
  "overallAngle": "one paragraph explaining the positive Clark narrative",
  "officialFactCheckNeeds": [
    {"clipIndex": 0, "needs": ["box score stat", "play-by-play clock/score", "assist attribution"], "reason": "..."}
  ],
  "positiveStatIdeas": [
    {"stat": "32 points", "sourceNeeded": "official box score", "howToUseInVO": "..."}
  ],
  "possessions": [
    {
      "clipIndex": 0,
      "label": "from manifest",
      "confidence": "high|medium|low",
      "readableClockScore": {"quarter": "", "gameClock": "", "shotClock": "", "score": ""},
      "officialVerification": {
        "eventType": "made three|assist|miss|foul|turnover|unknown",
        "playersToVerify": [],
        "playByPlayQuery": "plain English description to match in official PBP"
      },
      "floorMap": {
        "clarkStart": "",
        "ballLocation": "",
        "teammateSpacing": "",
        "defenderPositions": "",
        "jerseyNumbersVisible": []
      },
      "moveName": "",
      "defensiveMistake": "",
      "clarkRead": "",
      "positiveValue": "",
      "payoff": "",
      "ftlVoiceoverBeat": "",
      "editPlan": [
        {
          "relativeStart": 0,
          "relativeEnd": 4,
          "visual": "live|replay|freeze|slowmo",
          "overlay": "none|circle|arrow|distance|clock/score",
          "overlayTarget": "",
          "voPurpose": "",
          "screenDirection": ""
        }
      ],
      "textOverlay": "",
      "riskNotes": "what may be misread or needs fact-check"
    }
  ],
  "recommendedVideoOrder": [
    {"clipIndex": 0, "reason": "why this should appear here"}
  ],
  "scriptSkeleton": [
    {"section": "hook|proof|close", "clipIndex": 0, "vo": "draft VO paragraph", "editNotes": "exact visual plan"}
  ]
}

Clip manifest context:
${JSON.stringify(clipContext, null, 2)}

Official score / play-by-play context if provided:
${scoreContext || "Not provided. Flag every clock, score, stat, and attribution that must be verified later."}
`;

const parts = [
  ...uploads.map(file => ({ fileData: { fileUri: file.uri, mimeType: file.mimeType || "video/mp4" } })),
  { text: prompt },
];

console.log("Requesting possession breakdown...");
const response = await ai.models.generateContent({
  model,
  contents: [{ role: "user", parts }],
  config: {
    temperature: 0.1,
    maxOutputTokens: 32768,
    responseMimeType: "application/json",
  },
});

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${response.text.trim()}\n`);
console.log(outPath);
