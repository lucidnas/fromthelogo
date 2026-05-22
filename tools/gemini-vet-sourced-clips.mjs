#!/usr/bin/env node
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";

function usage() {
  console.error(`Usage:
  node tools/gemini-vet-sourced-clips.mjs --slug SLUG [options]

Options:
  --ledger PATH          Source ledger JSON. Default:
                         /Volumes/SSK SSD/ftl/videos/{slug}/sources/social-source-ledger.json
  --out PATH             Output JSON. Default:
                         /Volumes/SSK SSD/ftl/videos/{slug}/analysis/gemini-clip-vetting.json
  --title TITLE          Working video title/context.
  --game-context TEXT    Game context to give Gemini.
  --model MODEL          Gemini model. Default: GEMINI_CLIP_VET_MODEL, GEMINI_MODEL, then gemini-3.1-pro-preview
  --max-clips N          Max clips uploaded. Default: 18
  --max-duration N       Skip clips longer than N seconds unless --include-long. Default: 180
  --include-long         Include clips longer than --max-duration.
  --include-archive      Include archive/full-game sources.
  --lanes LIST           Comma-separated lanes to include. Default: official,media,fan
  --dry-run              Build and print selected clip metadata without uploading to Gemini.

Example:
  node tools/gemini-vet-sourced-clips.mjs \\
    --slug fever-mystics-2026-05-15 \\
    --title "This Caitlin Clark Fourth Quarter Was UNREAL" \\
    --game-context "Indiana Fever vs Washington Mystics, May 15 2026. Clark had 32 points, 8 assists, 7 made threes."`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (!value) usage();
      return value;
    };
    if (arg === "--slug") args.slug = next();
    else if (arg === "--ledger") args.ledger = next();
    else if (arg === "--out") args.out = next();
    else if (arg === "--title") args.title = next();
    else if (arg === "--game-context") args.gameContext = next();
    else if (arg === "--model") args.model = next();
    else if (arg === "--max-clips") args.maxClips = Number(next());
    else if (arg === "--max-duration") args.maxDuration = Number(next());
    else if (arg === "--include-long") args.includeLong = true;
    else if (arg === "--include-archive") args.includeArchive = true;
    else if (arg === "--lanes") args.lanes = next();
    else if (arg === "--dry-run") args.dryRun = true;
    else usage();
  }
  if (!args.slug && !args.ledger) usage();
  return args;
}

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

function sourceLane(source) {
  const type = String(source.sourceType || "").toLowerCase();
  const account = String(source.account || "").toLowerCase();
  const platform = String(source.platform || "").toLowerCase();

  if (type.includes("archive") || account.includes("highlight moment")) return "archive";
  if (type.includes("official")) return "official";
  if (["wnba", "indianafever", "indiana fever", "espn", "sportscenter", "wnba on nbc"].includes(account)) return "official";
  if (type.includes("media") || type.includes("analyst")) return "media";
  if (type.includes("fan")) return "fan";
  if (platform === "youtube") return "media";
  return "other";
}

function laneRank(lane) {
  return {
    official: 0,
    media: 1,
    fan: 2,
    other: 3,
    archive: 4,
  }[lane] ?? 9;
}

function qualityRank(quality) {
  const height = Number(quality?.height || 0);
  const width = Number(quality?.width || 0);
  return Math.max(width, height);
}

function compactSource(source, clipPath, lane, index) {
  const media = source.media?.find((item) => item.path === clipPath) || source.media?.[0] || {};
  const quality = media.quality || {};
  return {
    clipIndex: index,
    lane,
    sourceType: source.sourceType || "",
    account: source.account || "",
    platform: source.platform || "",
    status: source.status || "",
    url: source.url || "",
    localPath: clipPath,
    fileName: path.basename(clipPath),
    quality: {
      label: quality.label || "",
      width: quality.width || null,
      height: quality.height || null,
      duration: quality.duration || null,
      bitrate: quality.bitrate || null,
    },
    title: source.metadata?.title || source.metadata?.full_text || source.metadata?.description || "",
    uploadDate: source.metadata?.upload_date || "",
  };
}

async function uploadClip(ai, clip) {
  const bytes = fs.readFileSync(clip.localPath);
  const upload = await ai.files.upload({
    file: new Blob([bytes], { type: "video/mp4" }),
    config: {
      mimeType: "video/mp4",
      displayName: `${String(clip.clipIndex + 1).padStart(2, "0")}-${clip.lane}-${clip.fileName}`,
    },
  });

  let file = upload;
  while (file.state === "PROCESSING") {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    file = await ai.files.get({ name: file.name });
  }
  if (file.state !== "ACTIVE") throw new Error(`Gemini upload failed for ${clip.localPath}: ${file.state}`);
  return file;
}

const args = parseArgs(process.argv.slice(2));
loadEnvFile(path.resolve(".env"));
loadEnvFile(path.resolve(".env.local"));

const slug = args.slug;
const ledgerPath = args.ledger || `/Volumes/SSK SSD/ftl/videos/${slug}/sources/social-source-ledger.json`;
const outPath = args.out || `/Volumes/SSK SSD/ftl/videos/${slug}/analysis/gemini-clip-vetting.json`;
const title = args.title || `FTL sourced clip vetting for ${slug || path.basename(ledgerPath)}`;
const gameContext = args.gameContext || "No official context provided. Flag every stat, clock, score, and attribution that needs verification.";
const model = args.model || process.env.GEMINI_CLIP_VET_MODEL || process.env.GEMINI_MODEL || "gemini-3.1-pro-preview";
const maxClips = Number(args.maxClips || 18);
const maxDuration = Number(args.maxDuration || 180);
const allowedLanes = new Set(String(args.lanes || "official,media,fan").split(",").map((item) => item.trim()).filter(Boolean));

if (!fs.existsSync(ledgerPath)) throw new Error(`Ledger not found: ${ledgerPath}`);
console.log(`Reading ledger: ${ledgerPath}`);
const ledgerRaw = fs.readFileSync(ledgerPath, "utf8");
console.log(`Parsing ledger JSON (${ledgerRaw.length} chars)...`);
const ledger = JSON.parse(ledgerRaw);
console.log(`Ledger parsed: ${(ledger.sources || []).length} source row(s)`);
const candidates = [];

for (const [sourceIndex, source] of (ledger.sources || []).entries()) {
  if (source.status !== "downloaded") continue;
  const lane = sourceLane(source);
  if (!allowedLanes.has(lane)) continue;
  if (lane === "archive" && !args.includeArchive) continue;

  for (const media of source.media || []) {
    const clipPath = media.path;
    if (!clipPath || path.basename(clipPath).startsWith("._")) continue;
    if (args.dryRun) console.log(`Checking source ${sourceIndex + 1}: [${lane}] ${clipPath}`);
    if (!fs.existsSync(clipPath)) continue;
    const duration = Number(media.quality?.duration || 0);
    if (!args.includeLong && duration > maxDuration) continue;
    candidates.push({
      source,
      clipPath,
      lane,
      qualityScore: qualityRank(media.quality),
      duration,
    });
  }
}

candidates.sort((a, b) => {
  const laneDelta = laneRank(a.lane) - laneRank(b.lane);
  if (laneDelta) return laneDelta;
  return b.qualityScore - a.qualityScore;
});

const selected = candidates.slice(0, maxClips).map((item, index) => compactSource(item.source, item.clipPath, item.lane, index));
if (!selected.length) throw new Error(`No downloaded clips matched lanes=${[...allowedLanes].join(",")} from ${ledgerPath}`);
console.log(`Selected ${selected.length}/${candidates.length} clip(s) from lanes=${[...allowedLanes].join(",")}`);

if (args.dryRun) {
  console.log(JSON.stringify({ ledgerPath, outPath, model, maxClips, maxDuration, allowedLanes: [...allowedLanes], selected }, null, 2));
  process.exit(0);
}

if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required");

console.log(`Uploading ${selected.length}/${candidates.length} candidate clip(s) to Gemini with ${model}...`);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const uploads = [];
for (let i = 0; i < selected.length; i += 1) {
  console.log(`Uploading ${i + 1}/${selected.length}: [${selected[i].lane}] ${selected[i].fileName}`);
  uploads.push(await uploadClip(ai, selected[i]));
}

const prompt = `
You are Gemini acting as the senior clip logger and assistant editor for From The Logo, a Caitlin Clark / Indiana Fever YouTube channel.

Your task is to watch every uploaded video clip and vet the footage. Do not write the final video script yet. We need a clean manifest of what each clip actually contains, which clips are useful, and which clips should be primary vs alternate angles.

FTL editorial priority:
- Caitlin Clark is the center of the story.
- Official clips are preferred when they show the same play clearly.
- Fan/media clips can be used as alternate angles, social proof, arena emotion, or missing possessions.
- A clip is useful if it shows Clark scoring, assisting, creating gravity, collapsing the defense, manipulating coverage, pushing pace, setting up a hockey assist, reacting, or showing a stat/score receipt.
- Even missed shots can be useful if the clip shows Clark creating a good read, advantage, or defensive panic.

For each uploaded clip:
- Identify what the clip shows.
- Say whether Caitlin Clark is visible and meaningfully involved.
- Classify the clip: made three, assist, pass/read, gravity possession, miss, turnover, defensive play, stat graphic, reaction, full/highlight montage, duplicate, discard, unknown.
- Read visible clock/score/quarter/shot clock if possible. If not readable, say so.
- Identify whether the clip appears official/broadcast/social/repost based on framing and source metadata.
- Score visual quality and editorial usefulness separately.
- Decide best use: primary A-roll, alternate angle, replay, freeze-frame/telestration, stat receipt, reaction, context B-roll, discard.
- Detect duplicates or near-duplicates against other uploaded clips.
- Recommend which official clip should be primary when the same moment appears in multiple clips.
- Provide a short reason using screen evidence, not guesses.

Return strict JSON only:
{
  "title": ${JSON.stringify(title)},
  "gameContext": ${JSON.stringify(gameContext)},
  "clipPoolSummary": {
    "totalUploaded": ${selected.length},
    "officialCount": 0,
    "mediaCount": 0,
    "fanCount": 0,
    "usableCount": 0,
    "discardCount": 0,
    "bestOverallClipIndexes": []
  },
  "vettedClips": [
    {
      "clipIndex": 0,
      "fileName": "",
      "localPath": "",
      "laneFromLedger": "official|media|fan|other|archive",
      "account": "",
      "url": "",
      "whatItShows": "",
      "clarkVisible": true,
      "clarkInvolved": true,
      "clipCategory": "made_three|assist|pass_read|gravity|miss|turnover|defense|stat_graphic|reaction|montage|duplicate|discard|unknown",
      "visibleClockScore": {"quarter": "", "gameClock": "", "shotClock": "", "score": "", "confidence": "high|medium|low|not_readable"},
      "qualityScore": 1,
      "usefulnessScore": 1,
      "bestUse": "primary_a_roll|alternate_angle|replay|freeze_telestration|stat_receipt|reaction|context_broll|discard",
      "primaryMoment": "short label, e.g. Clark 29-foot Q4 three",
      "duplicateOfClipIndex": null,
      "officialPrimaryClipIndex": null,
      "alternateAngleClipIndexes": [],
      "whyUseful": "",
      "risksOrVerificationNeeded": []
    }
  ],
  "officialFirstClipPool": [
    {
      "rank": 1,
      "clipIndex": 0,
      "primaryMoment": "",
      "bestUse": "",
      "reason": ""
    }
  ],
  "alternateAnglesAndSocialProof": [
    {
      "clipIndex": 0,
      "pairsWithClipIndex": 0,
      "reason": ""
    }
  ],
  "discardList": [
    {
      "clipIndex": 0,
      "reason": ""
    }
  ],
  "recommendedNextGeminiPossessionInput": {
    "clipIndexes": [],
    "reason": "These are the clips to send into possession-level breakdown next."
  }
}

Uploaded clip metadata:
${JSON.stringify(selected, null, 2)}
`;

console.log("Requesting Gemini clip vetting...");
const response = await ai.models.generateContent({
  model,
  contents: [
    {
      role: "user",
      parts: [
        ...uploads.map((file) => ({ fileData: { fileUri: file.uri, mimeType: file.mimeType || "video/mp4" } })),
        { text: prompt },
      ],
    },
  ],
  config: {
    temperature: 0.1,
    maxOutputTokens: 32768,
    responseMimeType: "application/json",
  },
});

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${response.text.trim()}\n`);
console.log(outPath);
