#!/usr/bin/env node
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";

const [, , slugArg, outputArg] = process.argv;

if (!slugArg) {
  console.error("Usage: node tools/gemini-senior-editor-edl.mjs <slug> [output.json]");
  process.exit(1);
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    value = value.replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

loadEnvFile(path.resolve(".env"));
loadEnvFile(path.resolve(".env.local"));

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is required in env or .env");
  process.exit(1);
}

const SSD = "/Volumes/SSK SSD";
const slug = slugArg;
const videoDir = `${SSD}/ftl/videos/${slug}`;
const brollDir = `${SSD}/broll/aroll/${slug}`;
const voPath = `${videoDir}/vo.mp3`;
const scriptPath = `/Users/abdul/transcripts/script-fever-sparks-2026-05-13-spectacular.txt`;
const researchPath = "research/celebration-ideas/2026-05-15-fever-sparks-clark-game-review.md";
const currentEditPath = `${videoDir}/edit-script-johnny-v2.json`;
const outputPath = outputArg || `${videoDir}/edit-script-gemini-senior-v1.json`;

const sources = [
  {
    label: "WNBA official highlight",
    asset: "wnba-official-K_rW6X9FP8M.mp4",
    path: `${brollDir}/wnba-official-K_rW6X9FP8M.mp4`,
    mimeType: "video/mp4",
  },
  {
    label: "Indiana Fever official highlight",
    asset: "fever-official-HYen3giL5Jc.mp4",
    path: `${brollDir}/fever-official-HYen3giL5Jc.mp4`,
    mimeType: "video/mp4",
  },
  {
    label: "Final VO",
    asset: "vo.mp3",
    path: voPath,
    mimeType: "audio/mpeg",
  },
];

for (const source of sources) {
  if (!fs.existsSync(source.path)) {
    console.error(`Missing ${source.label}: ${source.path}`);
    process.exit(1);
  }
}

const scriptText = fs.existsSync(scriptPath) ? fs.readFileSync(scriptPath, "utf8") : "";
const researchText = fs.existsSync(researchPath) ? fs.readFileSync(researchPath, "utf8") : "";
const currentEdit = fs.existsSync(currentEditPath)
  ? JSON.parse(fs.readFileSync(currentEditPath, "utf8"))
  : null;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function uploadSource(source) {
  const bytes = fs.readFileSync(source.path);
  const upload = await ai.files.upload({
    file: new Blob([bytes], { type: source.mimeType }),
    config: { mimeType: source.mimeType, displayName: `${slug}-${source.asset}` },
  });

  let file = upload;
  while (file.state === "PROCESSING") {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    file = await ai.files.get({ name: file.name });
  }
  if (file.state !== "ACTIVE") {
    throw new Error(`${source.label} upload failed with state ${file.state}`);
  }
  return { source, file };
}

console.log(`Uploading ${sources.length} source file(s) to Gemini...`);
const uploads = [];
for (const source of sources) {
  console.log(`- ${source.label}: ${source.path}`);
  uploads.push(await uploadSource(source));
}

const currentCueContext = currentEdit
  ? currentEdit.cues.map((cue, index) => ({
      index,
      start: cue.start,
      end: cue.end,
      beat: cue.beat,
      vo: cue.vo,
      asset: cue.asset,
      assetPath: cue.assetPath,
      sourceIn: cue.sourceIn,
      sourceOut: cue.sourceOut,
      treatment: cue.treatment,
      overlays: cue.overlays,
      graphics: cue.graphics,
      freezeFrames: cue.freezeFrames,
    }))
  : [];

const prompt = `
You are Gemini acting as the senior video editor for From The Logo.

Your job is not to critique. Your job is to DIRECT THE COMPLETE VIDEO EDIT.

Inputs attached:
1. Final VO audio for the video.
2. WNBA official Caitlin Clark / Fever-Sparks game highlight video.
3. Indiana Fever official highlight video.

The output must be an executable timestamped edit script for a Hyperframes-based FTL video. Every second from 0.000 through the VO duration must be accounted for by contiguous cues. No gaps. No overlaps. Do not return general advice.

Channel target:
- From The Logo is a faceless Caitlin Clark / Indiana Fever channel.
- This video title is "This Caitlin Clark Game Was SPECTACULAR".
- FTL voice is positive, fan-first, direct, and Clark-centered.
- Borrow the film-room mechanics of Awful Coaching: pause, replay, freeze, circle, arrow, label, show the read, then move.
- Do NOT borrow Awful Coaching's insult-heavy tone. This is celebration, not a takedown.
- The viewer should feel Caitlin Clark is controlling the game before everyone else understands the possession.

Editorial priorities:
- The visuals must match the VO exactly.
- Use the VO audio as the master timeline. Build the edit around what is being said at each moment.
- Use short moving clips, usually 3-8 seconds.
- Use freeze frames and telestration at decision points: before the steal, before the pass, before the help defender commits, before the cutter becomes open, before the closing inbounds read.
- Add rings around Caitlin, help defenders, cutters, and the ball-handler when relevant.
- Add arrows for pass paths, driving lanes, and defensive pull.
- Add labels only when they teach: short, uppercase, 1-4 words.
- Use clock/score receipts when the VO talks about timing, lead, fourth quarter, halftime, or closing.
- Mute broadcast/game audio unless you explicitly set a low audioVolume for a tiny moment; default audioVolume is 0.
- Strengthen fair-use posture by transforming footage with analysis overlays, freezes, zooms, replays, and commentary-specific cuts.
- Repeating a play is allowed only when each repeat has a different purpose: live view, freeze on decision, arrow/ring explanation, then payoff.

Available source assets and absolute paths:
${sources.map((source) => `- ${source.asset}: ${source.path}`).join("\n")}

Use only these assetPath values in the returned cues:
- ${sources[0].path}
- ${sources[1].path}

Required cue schema:
{
  "voiceDuration": number,
  "editorialPhilosophy": "short string",
  "sourceAssets": [
    {"asset":"filename.mp4","assetPath":"absolute path","role":"..."}
  ],
  "cues": [
    {
      "start": number,
      "end": number,
      "beat": "short descriptive beat",
      "vo": "exact or summarized VO line covered by this cue",
      "asset": "filename.mp4",
      "assetPath": "absolute path",
      "sourceIn": number,
      "sourceOut": number,
      "audioVolume": 0,
      "treatment": "precise visual instruction",
      "overlays": ["SHORT LABEL", "SECOND SHORT LABEL"],
      "overlayPosition": "default or scorebug-cover",
      "graphics": [
        {
          "type": "ring|arrow|line|label",
          "startOffset": number,
          "duration": number,
          "x": number,
          "y": number,
          "w": number,
          "h": number,
          "x1": number,
          "y1": number,
          "x2": number,
          "y2": number,
          "text": "short label",
          "color": "#FFE84D"
        }
      ],
      "freezeFrames": [
        {
          "startOffset": number,
          "duration": number,
          "sourceTime": number,
          "zoomFrom": number,
          "zoomTo": number,
          "x": number,
          "y": number,
          "label": "SHORT LABEL"
        }
      ],
      "editorNote": "why this exact screen choice belongs here"
    }
  ],
  "sectionBreaks": [
    {"name":"S01","start":0,"end":60,"purpose":"..."}
  ],
  "validationChecklist": [
    "specific thing to verify before render"
  ]
}

Coordinates:
- Use percentage coordinates from 0 to 100.
- For rings: x/y are center, w/h are percent size.
- For arrows/lines: x1/y1 to x2/y2 are percent endpoints.
- For labels: x/y are position.

Hard output rules:
- Return strict JSON only.
- cues must be sorted by start.
- cues must cover the whole VO duration contiguously.
- Round cue start/end/source times to 3 decimals.
- No cue longer than 9 seconds unless it contains an intentional freeze frame or multiple graphics.
- Put at least 18 freezeFrames across the full video.
- Put at least 30 graphics across the full video.
- Account for every second. If a VO beat is not about a specific play, use the strongest related Clark control receipt, but say why in editorNote.
- If uncertain about exact player identity, use neutral labels like "HELP", "CUTTER", "SECOND DEFENDER", "WINDOW" instead of inventing names.

Known facts and verified moment map:
${researchText}

Full script text:
${scriptText}

Existing rough EDL context. You may improve it heavily, but use it as a starting source-time map:
${JSON.stringify(currentCueContext, null, 2)}
`;

const response = await ai.models.generateContent({
  model: process.env.GEMINI_SENIOR_EDITOR_MODEL || process.env.GEMINI_MODEL || "gemini-3.1-pro-preview",
  contents: [
    {
      role: "user",
      parts: [
        ...uploads.map(({ source, file }) => ({
          fileData: { fileUri: file.uri, mimeType: file.mimeType || source.mimeType },
        })),
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

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, response.text);
console.log(`Wrote ${outputPath}`);
