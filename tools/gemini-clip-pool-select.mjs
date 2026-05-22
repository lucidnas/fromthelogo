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
  node tools/gemini-clip-pool-select.mjs --slug SLUG --title TITLE [options]

Reads a social source ledger, uploads downloaded candidate clips to Gemini, and asks Gemini
to choose/rank the best Caitlin Clark possessions. Writes both a detailed selection report
and a manifest compatible with tools/gemini-possession-breakdown.mjs.

Options:
  --ledger FILE          Ledger JSON. Default: /Volumes/SSK SSD/ftl/videos/{slug}/sources/social-source-ledger.json
  --out FILE             Selection report JSON. Default: /Volumes/SSK SSD/ftl/videos/{slug}/analysis/gemini-clip-selection.json
  --manifest-out FILE    Selected manifest JSON. Default: /Volumes/SSK SSD/ftl/videos/{slug}/analysis/gemini-selected-clips-manifest.json
  --score-context FILE   Optional official box/play-by-play context text.
  --model MODEL          Default: gemini-3.1-pro-preview
  --max-candidates N     Max uploaded videos after mechanical filtering. Default: 18
  --max-duration SECS    Exclude clips longer than this unless --include-long. Default: 180
  --min-height PX        Exclude media lower than this height. Default: 700
  --include-long         Allow long highlight packages/full-game files.

Example:
  node tools/gemini-clip-pool-select.mjs \\
    --slug fever-mystics-2026-05-15 \\
    --title "This Caitlin Clark Fourth Quarter Was UNREAL"`);
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

const slug = args.get("slug");
const title = args.get("title");
if (!slug || !title) usage();
if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required");

const model = args.get("model") || process.env.GEMINI_CLIP_SELECT_MODEL || process.env.GEMINI_MODEL || "gemini-3.1-pro-preview";
const ledgerPath = args.get("ledger") || `/Volumes/SSK SSD/ftl/videos/${slug}/sources/social-source-ledger.json`;
const outPath = args.get("out") || `/Volumes/SSK SSD/ftl/videos/${slug}/analysis/gemini-clip-selection.json`;
const manifestOut = args.get("manifest-out") || `/Volumes/SSK SSD/ftl/videos/${slug}/analysis/gemini-selected-clips-manifest.json`;
const scoreContextPath = args.get("score-context");
const maxCandidates = Number(args.get("max-candidates") || "18");
const maxDuration = Number(args.get("max-duration") || "180");
const minHeight = Number(args.get("min-height") || "700");
const includeLong = args.has("include-long");

if (!fs.existsSync(ledgerPath)) throw new Error(`Ledger not found: ${ledgerPath}`);

const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
const scoreContext = scoreContextPath && fs.existsSync(scoreContextPath)
  ? fs.readFileSync(scoreContextPath, "utf8")
  : "";

function sourceWeight(source) {
  const type = String(source.sourceType || "").toLowerCase();
  const account = String(source.account || "").toLowerCase();
  const platform = String(source.platform || "").toLowerCase();
  let score = 0;
  if (type === "official") score += 100;
  if (account.includes("indianafever") || account.includes("indiana fever")) score += 50;
  if (account === "wnba") score += 35;
  if (type === "media") score += 20;
  if (platform === "x") score += 15;
  if (platform === "youtube") score += 5;
  if (type === "archive") score -= 80;
  return score;
}

const candidates = [];
for (let sourceIndex = 0; sourceIndex < (ledger.sources || []).length; sourceIndex += 1) {
  const source = ledger.sources[sourceIndex];
  if (source.status !== "downloaded") continue;
  for (const media of source.media || []) {
    const q = media.quality || {};
    const clipPath = media.path;
    if (!clipPath || !fs.existsSync(clipPath)) continue;
    const duration = Number(q.duration || 0);
    const height = Number(q.height || 0);
    if (!includeLong && duration > maxDuration) continue;
    if (height > 0 && height < minHeight) continue;
    candidates.push({
      sourceIndex,
      sourceType: source.sourceType || "",
      account: source.account || "",
      platform: source.platform || "",
      url: source.url || "",
      clipPath,
      quality: q,
      metadataTitle: source.metadata?.title || "",
      mechanicalScore: sourceWeight(source) + Math.min(30, height / 60) - Math.max(0, (duration - 120) / 30),
    });
  }
}

candidates.sort((a, b) => b.mechanicalScore - a.mechanicalScore);
const uploadCandidates = candidates.slice(0, maxCandidates);
if (!uploadCandidates.length) throw new Error("No candidate videos survived mechanical filtering");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function uploadClip(candidate, index) {
  const bytes = fs.readFileSync(candidate.clipPath);
  const upload = await ai.files.upload({
    file: new Blob([bytes], { type: "video/mp4" }),
    config: {
      mimeType: "video/mp4",
      displayName: `${String(index + 1).padStart(2, "0")}-${path.basename(candidate.clipPath)}`,
    },
  });

  let file = upload;
  while (file.state === "PROCESSING") {
    await new Promise(resolve => setTimeout(resolve, 2500));
    file = await ai.files.get({ name: file.name });
  }
  if (file.state !== "ACTIVE") throw new Error(`Gemini upload failed for ${candidate.clipPath}: ${file.state}`);
  return file;
}

console.log(`Uploading ${uploadCandidates.length} clip-pool candidate(s) to Gemini with ${model}...`);
const uploads = [];
for (let i = 0; i < uploadCandidates.length; i += 1) {
  const c = uploadCandidates[i];
  console.log(`Uploading ${i + 1}/${uploadCandidates.length}: ${path.basename(c.clipPath)} (${c.account}, ${c.quality?.label || "unknown"}, ${Number(c.quality?.duration || 0).toFixed(1)}s)`);
  uploads.push(await uploadClip(c, i));
}

const candidateContext = uploadCandidates.map((candidate, index) => ({
  candidateIndex: index,
  sourceIndex: candidate.sourceIndex,
  sourceType: candidate.sourceType,
  account: candidate.account,
  platform: candidate.platform,
  url: candidate.url,
  clipPath: candidate.clipPath,
  quality: candidate.quality,
  metadataTitle: candidate.metadataTitle,
}));

const prompt = `
You are Gemini acting as the senior clip producer, senior possession analyst, and senior video editor for From The Logo.

You are not being given a hand-picked list. You must watch the uploaded clip pool and decide which clips belong in a Caitlin Clark-positive film-room video.

FTL's editorial rule:
- Caitlin Clark is the product.
- A loss does not control the framing.
- Choose clips that let us positively explain Clark's value: range, gravity, pace, manipulation, passing windows, defensive collapse, advantage creation, clutch pressure, and decision-making.
- Clips can be made shots, assists, hockey-assists, gravity possessions, stat/video graphics, or replay packages.
- Avoid dead clips, pure opponent highlights, low-value crowd/social posts, and clips where Clark is not central.

Your tasks:
1. Watch every uploaded candidate.
2. Rank every candidate for FTL usefulness.
3. Select the best 8-12 Clark-focused clips or packages for the video.
4. Identify duplicate coverage of the same play/package.
5. Decide which clip should open the video.
6. Decide which clips should feed detailed possession analysis next.

Return strict JSON only:
{
  "slug": ${JSON.stringify(slug)},
  "title": ${JSON.stringify(title)},
  "overallClipPoolAssessment": "short paragraph",
  "selectedClips": [
    {
      "candidateIndex": 0,
      "rank": 1,
      "label": "clear human label",
      "selectionRole": "hook|proof|replay-package|assist-package|stat-receipt|alternate-angle|support",
      "priority": 1,
      "clarkValue": "what this proves about Clark",
      "whySelected": "why this belongs in the video",
      "bestUse": "how the editor should use it",
      "estimatedUsefulSections": [{"start": 0, "end": 12, "reason": "what is visible"}],
      "needsDetailedPossessionBreakdown": true,
      "duplicateOfCandidateIndex": null,
      "factCheckNeeds": ["clock/score", "assist attribution", "stat claim"]
    }
  ],
  "rejectedClips": [
    {
      "candidateIndex": 2,
      "reason": "not Clark-centered|duplicate|not video-action|too broad|low-value"
    }
  ],
  "recommendedVideoOrder": [
    {
      "candidateIndex": 0,
      "role": "hook",
      "reason": "why it goes here"
    }
  ],
  "nextGeminiBreakdownManifestNotes": "what to send into the detailed possession script"
}

Candidate context:
${JSON.stringify(candidateContext, null, 2)}

Official score / play-by-play context if provided:
${scoreContext || "Not provided. Flag every clock, score, stat, and attribution that must be verified later."}
`;

const parts = [
  ...uploads.map(file => ({ fileData: { fileUri: file.uri, mimeType: file.mimeType || "video/mp4" } })),
  { text: prompt },
];

console.log("Requesting Gemini clip-pool selection...");
const response = await ai.models.generateContent({
  model,
  contents: [{ role: "user", parts }],
  config: {
    temperature: 0.1,
    maxOutputTokens: 32768,
    responseMimeType: "application/json",
  },
});

const parsed = JSON.parse(response.text);
const manifestClips = (parsed.selectedClips || [])
  .filter(item => item.needsDetailedPossessionBreakdown !== false)
  .map((item) => {
    const candidate = uploadCandidates[item.candidateIndex];
    if (!candidate) return null;
    return {
      label: item.label,
      type: item.selectionRole || "gemini-selected",
      priority: item.priority ?? item.rank ?? 99,
      clipPath: candidate.clipPath,
      sourcePath: candidate.clipPath,
      sourceUrl: candidate.url,
      account: candidate.account,
      quality: candidate.quality,
      why: item.whySelected,
      clarkValue: item.clarkValue,
      suggestedTreatment: item.bestUse,
      estimatedUsefulSections: item.estimatedUsefulSections || [],
      factCheckNeeds: item.factCheckNeeds || [],
    };
  })
  .filter(Boolean)
  .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));

const report = {
  ...parsed,
  generatedAt: new Date().toISOString(),
  ledgerPath,
  uploadedCandidateCount: uploadCandidates.length,
  candidateContext,
  manifestOut,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.mkdirSync(path.dirname(manifestOut), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(manifestOut, `${JSON.stringify({ slug, title, generatedAt: report.generatedAt, clips: manifestClips }, null, 2)}\n`);

console.log(`selection=${outPath}`);
console.log(`manifest=${manifestOut}`);
