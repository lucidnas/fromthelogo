#!/usr/bin/env node
import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const SSD = "/Volumes/SSK SSD";
const DEFAULT_MODE = "caitlin-selects";

function usage() {
  console.error(`Usage:
  node tools/ftl-game-clip-pipeline.mjs --slug SLUG --query QUERY [options]

Options:
  --mode caitlin-selects      Pipeline mode. Default: caitlin-selects
  --source URL                Add an explicit YouTube URL. Can be repeated.
  --search-count N            Number of ytsearch results to inspect. Default: 10
  --primary-index N           Search result index to use as primary. Default: 1
  --backup-indexes 2,3        Search result indexes to use as backups. Default: 2,3
  --primary-url URL           Explicit primary source URL, bypassing primary-index
  --no-gemini                 Skip Gemini timestamp selection
  --selects-json PATH         Use an existing Gemini selects JSON
  --serve PORT                Start a review server from the clips folder
  --dry-run                   Search/probe only; do not download/cut clips

Example:
  node tools/ftl-game-clip-pipeline.mjs \\
    --slug fever-mystics-2026-05-15 \\
    --query "Indiana Fever Washington Mystics Caitlin Clark highlights May 15 2026" \\
    --primary-index 3 \\
    --backup-indexes 1,2 \\
    --serve 5056`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = {
    mode: DEFAULT_MODE,
    searchCount: 10,
    primaryIndex: 1,
    backupIndexes: [2, 3],
    sources: [],
    dryRun: false,
    gemini: true,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (!value) usage();
      return value;
    };
    if (arg === "--slug") out.slug = next();
    else if (arg === "--query") out.query = next();
    else if (arg === "--mode") out.mode = next();
    else if (arg === "--source") out.sources.push(next());
    else if (arg === "--search-count") out.searchCount = Number(next());
    else if (arg === "--primary-index") out.primaryIndex = Number(next());
    else if (arg === "--backup-indexes") out.backupIndexes = next().split(",").filter(Boolean).map(Number);
    else if (arg === "--primary-url") out.primaryUrl = next();
    else if (arg === "--selects-json") out.selectsJson = next();
    else if (arg === "--serve") out.servePort = Number(next());
    else if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--no-gemini") out.gemini = false;
    else usage();
  }
  if (!out.slug || (!out.query && !out.sources.length && !out.primaryUrl)) usage();
  return out;
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

function run(cmd, args, options = {}) {
  const proc = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
    cwd: options.cwd ?? process.cwd(),
  });
  if (proc.status !== 0) {
    const rendered = `${cmd} ${args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(" ")}`;
    throw new Error(`${rendered}\n${proc.stderr || proc.stdout}`);
  }
  return proc.stdout;
}

function findYtDlp() {
  if (fs.existsSync("/opt/homebrew/bin/yt-dlp")) return "/opt/homebrew/bin/yt-dlp";
  return "yt-dlp";
}

function ytDlpBaseArgs() {
  return [
    "--cookies-from-browser",
    "chrome",
    "--extractor-args",
    "youtube:player_client=default,-tv",
  ];
}

function searchYouTube(query, count) {
  const ytDlp = findYtDlp();
  const output = run(ytDlp, [
    "--flat-playlist",
    "--print",
    "%(title)s\t%(id)s\t%(duration_string)s\t%(uploader)s\t%(webpage_url)s",
    `ytsearch${count}:${query}`,
  ]);
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      const [title, id, duration, uploader, url] = line.split("\t");
      return { index: index + 1, title, id, duration, uploader, url: url || `https://www.youtube.com/watch?v=${id}` };
    });
}

function listFormats(url) {
  const ytDlp = findYtDlp();
  try {
    return run(ytDlp, [...ytDlpBaseArgs(), "-F", url]);
  } catch (err) {
    return String(err.message || err);
  }
}

function chooseFormat(formatText, preferred = "best") {
  if (/\n96(?:-\d+)?\s+mp4\s+1920x1080/.test(formatText)) return "96/137+140/399+140/248+140/95/136+140/best";
  if (/\n300(?:-\d+)?\s+mp4\s+1280x720\s+60/.test(formatText)) return "300-21/300/298+140/302+140/398+140/best";
  if (/\n95(?:-\d+)?\s+mp4\s+1280x720/.test(formatText)) return "95/136+140/398+140/247+140/best";
  if (preferred === "primary") return "300-21/300/298+140/95/136+140/best";
  return "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best";
}

function downloadSource(url, outDir, role) {
  const ytDlp = findYtDlp();
  const formats = listFormats(url);
  const format = chooseFormat(formats, role);
  const suffix = role === "primary" ? "primary" : "backup";
  const template = `${outDir}/%(uploader).30s-%(id)s-${suffix}.%(ext)s`;
  run(ytDlp, [
    ...ytDlpBaseArgs(),
    "-f",
    format,
    "--merge-output-format",
    "mp4",
    "-o",
    template,
    url,
  ], { stdio: "inherit" });
  const files = fs.readdirSync(outDir)
    .filter((file) => file.endsWith(".mp4") && file.includes(`-${suffix}.`))
    .map((file) => path.join(outDir, file))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  if (!files[0]) throw new Error(`Download finished but no ${suffix} mp4 found in ${outDir}`);
  return { path: files[0], url, format, formats };
}

function ffprobeJson(filePath) {
  const output = run("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height,avg_frame_rate,bit_rate",
    "-show_entries",
    "format=duration,size,bit_rate",
    "-of",
    "json",
    filePath,
  ]);
  return JSON.parse(output);
}

function qualityLabel(probe) {
  const stream = probe.streams?.[0] ?? {};
  const width = Number(stream.width ?? 0);
  const height = Number(stream.height ?? 0);
  const bitrate = Number(probe.format?.bit_rate ?? stream.bit_rate ?? 0);
  const mbps = bitrate ? `${(bitrate / 1_000_000).toFixed(2)} Mbps` : "unknown bitrate";
  if (height >= 1080) return `approved-1080p (${width}x${height}, ${mbps})`;
  if (height >= 720) return `approved-720p (${width}x${height}, ${mbps})`;
  return `low-res (${width}x${height}, ${mbps})`;
}

function parseTimecode(value) {
  if (typeof value === "number") return value;
  const parts = String(value).split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  const num = Number(value);
  if (Number.isFinite(num)) return num;
  throw new Error(`Invalid timecode: ${value}`);
}

async function geminiSelectClips(videoPath, outputPath) {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required for Gemini clip selection");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  console.log(`Uploading primary source to Gemini: ${videoPath}`);
  let file = await ai.files.upload({
    file: new Blob([fs.readFileSync(videoPath)], { type: "video/mp4" }),
    config: { mimeType: "video/mp4", displayName: path.basename(videoPath) },
  });
  while (file.state === "PROCESSING") {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    file = await ai.files.get({ name: file.name });
    console.log(`Gemini file state: ${file.state}`);
  }
  if (file.state !== "ACTIVE") throw new Error(`Gemini upload failed: ${file.state}`);

  const prompt = `You are selecting Caitlin Clark-focused clips for From The Logo.

Watch the full highlight video and return strict JSON only.

Find the best edit-ready Caitlin Clark moments. Include scoring plays, assists/creation, defensive moments, late-game possessions, overtime possessions, reactions, and scoreboard/stat receipts. Avoid generic non-Clark plays unless they directly set up Clark's response.

Return this exact shape:
{
  "source": "${path.basename(videoPath)}",
  "summary": "one sentence",
  "clips": [
    {"label":"short filename-safe label","start":"MM:SS.s","end":"MM:SS.s","type":"score|assist|gravity|defense|reaction|receipt|late_game|overtime","priority":1,"why":"why FTL should use it","suggestedTreatment":"live angle / replay / freeze / overlay note"}
  ]
}

Rules:
- clips should usually be 5-14 seconds
- only use a 15-22 second clip when it is the defining late-game moment
- never include a YouTube end screen
- each clip must center Caitlin Clark or her direct impact`;

  const result = await ai.models.generateContent({
    model: process.env.GEMINI_VIDEO_QC_MODEL || "gemini-3.1-pro-preview",
    contents: [{ role: "user", parts: [{ text: prompt }, { fileData: { fileUri: file.uri, mimeType: "video/mp4" } }] }],
    config: { responseMimeType: "application/json" },
  });
  fs.writeFileSync(outputPath, `${result.text}\n`);
  return outputPath;
}

function cutSelects(selectsPath, sourcePath, outDir) {
  const data = JSON.parse(fs.readFileSync(selectsPath, "utf8"));
  fs.mkdirSync(outDir, { recursive: true });
  const exported = [];
  for (let i = 0; i < data.clips.length; i++) {
    const clip = data.clips[i];
    const start = parseTimecode(clip.start);
    const end = parseTimecode(clip.end);
    const duration = Math.max(0.1, end - start);
    const safeLabel = clip.label.replace(/[^A-Za-z0-9_-]+/g, "_");
    const output = path.join(outDir, `${String(i + 1).padStart(2, "0")}-${safeLabel}.mp4`);
    run("ffmpeg", [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-ss",
      start.toFixed(3),
      "-i",
      sourcePath,
      "-t",
      duration.toFixed(3),
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",
      "-vf",
      "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "160k",
      "-movflags",
      "+faststart",
      output,
    ]);
    exported.push({ ...clip, sourcePath, clipPath: output, startSecs: start, endSecs: end, durationSecs: duration });
    console.log(`cut ${String(i + 1).padStart(2, "0")} ${clip.label} ${duration.toFixed(1)}s`);
  }
  return exported;
}

function makeConcat(files, concatPath) {
  const lines = files.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join("\n");
  fs.writeFileSync(concatPath, `${lines}\n`);
}

function buildReviewAssets(clipsDir, clipsRoot) {
  const files = fs.readdirSync(clipsDir)
    .filter((file) => file.endsWith(".mp4") && !file.startsWith("._"))
    .sort()
    .map((file) => path.join(clipsDir, file));
  const concatPath = path.join(clipsRoot, "caitlin-selects-concat.txt");
  const reelPath = path.join(clipsRoot, "caitlin-selects-review-reel.mp4");
  const contactPath = path.join(clipsRoot, "caitlin-selects-contact.jpg");
  makeConcat(files, concatPath);
  run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", concatPath, "-c", "copy", reelPath]);
  run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", reelPath, "-vf", "fps=1/4,scale=320:-1,tile=6x6", "-frames:v", "1", contactPath]);
  return { reelPath, contactPath, concatPath };
}

function startServer(port, cwd) {
  const proc = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" });
  if (proc.stdout.trim()) {
    console.log(`Review server already listening on ${port}`);
    return;
  }
  const child = spawnSync("bash", ["-lc", `cd ${JSON.stringify(cwd)} && nohup python3 -m http.server ${port} --bind 0.0.0.0 >/tmp/ftl-${port}.log 2>&1 &`], { encoding: "utf8" });
  if (child.status !== 0) throw new Error(child.stderr || child.stdout);
}

async function main() {
  loadEnvFile(path.resolve(".env"));
  loadEnvFile(path.resolve(".env.local"));

  const args = parseArgs(process.argv.slice(2));
  const videoDir = path.join(SSD, "ftl/videos", args.slug);
  const clipsRoot = path.join(videoDir, "clips");
  const clipsDir = path.join(clipsRoot, "caitlin-selects");
  const brollDir = path.join(SSD, "broll/aroll", args.slug);
  fs.mkdirSync(clipsRoot, { recursive: true });
  fs.mkdirSync(brollDir, { recursive: true });

  const searchResults = args.query ? searchYouTube(args.query, args.searchCount) : [];
  if (searchResults.length) {
    fs.writeFileSync(path.join(clipsRoot, "youtube-search-results.json"), JSON.stringify(searchResults, null, 2) + "\n");
    console.log("Search results:");
    for (const item of searchResults) console.log(`${item.index}. ${item.title} | ${item.duration} | ${item.uploader} | ${item.url}`);
  }

  const primaryUrl = args.primaryUrl || args.sources[0] || searchResults.find((item) => item.index === args.primaryIndex)?.url;
  const backupUrls = [
    ...args.sources.slice(args.primaryUrl || args.sources.length ? 0 : 1),
    ...args.backupIndexes.map((index) => searchResults.find((item) => item.index === index)?.url).filter(Boolean),
  ].filter((url, index, arr) => url && url !== primaryUrl && arr.indexOf(url) === index);

  if (!primaryUrl) throw new Error("No primary source URL found. Use --primary-url or --primary-index.");
  console.log(`Primary source: ${primaryUrl}`);
  if (backupUrls.length) console.log(`Backup sources: ${backupUrls.join(", ")}`);
  if (args.dryRun) return;

  const primary = downloadSource(primaryUrl, brollDir, "primary");
  const backups = backupUrls.map((url) => downloadSource(url, brollDir, "backup"));
  const sources = [primary, ...backups].map((source) => {
    const probe = ffprobeJson(source.path);
    return { ...source, probe, quality: qualityLabel(probe) };
  });

  const lowRes = sources.filter((source) => Number(source.probe.streams?.[0]?.height ?? 0) < 720);
  if (lowRes.length) {
    console.warn("WARNING: low-res source(s) downloaded:");
    for (const source of lowRes) console.warn(`- ${source.path}: ${source.quality}`);
  }

  const selectsPath = args.selectsJson || path.join(clipsRoot, "gemini-caitlin-selects.json");
  if (args.gemini && !args.selectsJson) await geminiSelectClips(primary.path, selectsPath);
  if (!fs.existsSync(selectsPath)) throw new Error(`Missing selects JSON: ${selectsPath}`);

  const exported = cutSelects(selectsPath, primary.path, clipsDir);
  const manifestPath = path.join(clipsRoot, "caitlin-selects-manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify({ source: primary.path, clips: exported }, null, 2) + "\n");
  const review = buildReviewAssets(clipsDir, clipsRoot);

  const qualityManifest = {
    slug: args.slug,
    mode: args.mode,
    searchResultsPath: searchResults.length ? path.join(clipsRoot, "youtube-search-results.json") : null,
    approvedMasters: sources,
    selectsJson: selectsPath,
    selectsManifest: manifestPath,
    review,
  };
  const qualityManifestPath = path.join(clipsRoot, "source-quality-manifest.json");
  fs.writeFileSync(qualityManifestPath, JSON.stringify(qualityManifest, null, 2) + "\n");

  if (args.servePort) {
    startServer(args.servePort, clipsRoot);
    let tailscale = "";
    try { tailscale = run("tailscale", ["ip", "-4"]).trim(); } catch {}
    console.log(`Review: http://localhost:${args.servePort}/${path.basename(review.reelPath)}`);
    if (tailscale) console.log(`Tailscale: http://${tailscale}:${args.servePort}/${path.basename(review.reelPath)}`);
  }

  console.log(`Done.
clips=${clipsDir}
manifest=${manifestPath}
quality=${qualityManifestPath}
review=${review.reelPath}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
