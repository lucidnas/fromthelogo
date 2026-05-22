#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const SSD = "/Volumes/SSK SSD";

function usage() {
  console.error(`Usage:
  node tools/ftl-social-clip-ingest.mjs --slug SLUG [--url URL ...] [--urls-file urls.txt] [--label LABEL]

Downloads social/game highlight clips from explicit URLs into:
  /Volumes/SSK SSD/broll/social/{slug}/

Supported by yt-dlp when available:
  x.com, twitter.com, pic.twitter.com, youtube.com, youtu.be, instagram/reels where yt-dlp supports the URL

Examples:
  node tools/ftl-social-clip-ingest.mjs \\
    --slug fever-mystics-2026-05-15 \\
    --urls-file research/source-urls/fever-mystics-2026-05-15.txt

URL file format:
  # comments allowed
  https://x.com/IndianaFever/status/...
  https://pic.twitter.com/...
  official | Indiana Fever | https://x.com/IndianaFever/status/...
  fan | Clark Report | https://x.com/CClarkReport/status/...`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { urls: [], label: "social" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (!value) usage();
      return value;
    };
    if (arg === "--slug") out.slug = next();
    else if (arg === "--url") out.urls.push({ url: next() });
    else if (arg === "--urls-file") out.urlsFile = next();
    else if (arg === "--label") out.label = next();
    else usage();
  }
  if (!out.slug || (!out.urls.length && !out.urlsFile)) usage();
  return out;
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

function parseUrlFile(filePath) {
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const parts = line.split("|").map((part) => part.trim());
      if (parts.length >= 3) {
        return { sourceType: parts[0], account: parts[1], url: parts.slice(2).join("|").trim() };
      }
      return { url: line };
    });
}

function classifyUrl(url) {
  if (/pic\.twitter\.com/i.test(url)) return "pic-twitter";
  if (/(^|\/\/)(x|twitter)\.com/i.test(url)) return "x";
  if (/youtu\.?be/i.test(url)) return "youtube";
  if (/instagram\.com/i.test(url)) return "instagram";
  if (/tiktok\.com/i.test(url)) return "tiktok";
  return "web";
}

function sanitize(value) {
  return String(value || "")
    .replace(/^https?:\/\//, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "source";
}

function metadataFor(url) {
  const ytDlp = findYtDlp();
  try {
    const json = run(ytDlp, [
      "--cookies-from-browser", "chrome",
      "--dump-single-json",
      "--skip-download",
      url,
    ]);
    return JSON.parse(json);
  } catch (err) {
    return { error: String(err.message || err) };
  }
}

function downloadUrl(entry, outDir, index) {
  const ytDlp = findYtDlp();
  const platform = classifyUrl(entry.url);
  const prefix = `${String(index + 1).padStart(2, "0")}-${platform}-${sanitize(entry.account || entry.sourceType || entry.url)}`;
  const template = path.join(outDir, `${prefix}-%(id)s.%(ext)s`);
  const archive = path.join(outDir, "download-archive.txt");

  const args = [
    "--cookies-from-browser", "chrome",
    "--download-archive", archive,
    "--write-info-json",
    "--write-thumbnail",
    "--no-playlist",
    "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
    "--merge-output-format", "mp4",
    "-o", template,
    entry.url,
  ];

  const before = new Set(fs.existsSync(outDir) ? fs.readdirSync(outDir) : []);
  try {
    run(ytDlp, args, { stdio: "inherit" });
  } catch (err) {
    return { ...entry, platform, status: "failed", error: String(err.message || err) };
  }

  const after = fs.readdirSync(outDir);
  const newFiles = after
    .filter((file) => !before.has(file))
    .map((file) => path.join(outDir, file))
    .filter((file) => !path.basename(file).startsWith("._") && !file.endsWith(".part") && !file.endsWith(".ytdl"));

  const mediaFiles = newFiles.filter((file) => /\.(mp4|mov|m4v|webm|mkv)$/i.test(file));
  const infoFiles = newFiles.filter((file) => /\.info\.json$/i.test(file));
  const thumbFiles = newFiles.filter((file) => /\.(jpg|jpeg|png|webp)$/i.test(file));
  if (!mediaFiles.length) {
    mediaFiles.push(
      ...fs.readdirSync(outDir)
        .filter((file) => file.startsWith(prefix) && !file.startsWith("._") && /\.(mp4|mov|m4v|webm|mkv)$/i.test(file))
        .map((file) => path.join(outDir, file))
    );
  }

  return {
    ...entry,
    platform,
    status: mediaFiles.length ? "downloaded" : "no-new-media",
    mediaFiles,
    infoFiles,
    thumbFiles,
  };
}

function ffprobe(filePath) {
  try {
    return JSON.parse(run("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width,height,avg_frame_rate,bit_rate",
      "-show_entries", "format=duration,size,bit_rate",
      "-of", "json",
      filePath,
    ]));
  } catch (err) {
    return { error: String(err.message || err) };
  }
}

function quality(probe) {
  const stream = probe.streams?.[0] || {};
  const width = Number(stream.width || 0);
  const height = Number(stream.height || 0);
  const duration = Number(probe.format?.duration || 0);
  const bitrate = Number(probe.format?.bit_rate || stream.bit_rate || 0);
  return {
    width,
    height,
    duration,
    bitrate,
    label: height >= 1080 ? "1080p+" : height >= 720 ? "720p" : height > 0 ? "low-res" : "unknown",
  };
}

function writeMarkdown(ledger, mdPath) {
  const rows = [];
  rows.push(`# Social Clip Source Ledger - ${ledger.slug}`);
  rows.push("");
  rows.push(`Generated: ${ledger.createdAt}`);
  rows.push("");
  rows.push(`Media folder: \`${ledger.outDir}\``);
  rows.push("");
  rows.push("| # | Platform | Type | Account | Status | Quality | URL | Local media |");
  rows.push("|---|---|---|---|---|---|---|---|");
  for (let i = 0; i < ledger.sources.length; i += 1) {
    const source = ledger.sources[i];
    const q = source.media?.[0]?.quality;
    const qText = q ? `${q.label} ${q.width}x${q.height} ${q.duration.toFixed(1)}s` : "";
    const media = source.media?.map((m) => `\`${m.path}\``).join("<br>") || "";
    rows.push(`| ${i + 1} | ${source.platform || ""} | ${source.sourceType || ""} | ${source.account || ""} | ${source.status} | ${qText} | ${source.url} | ${media} |`);
  }
  fs.writeFileSync(mdPath, `${rows.join("\n")}\n`);
}

const args = parseArgs(process.argv.slice(2));
const outDir = path.join(SSD, "broll/social", args.slug);
const ledgerDir = path.join(SSD, "ftl/videos", args.slug, "sources");
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(ledgerDir, { recursive: true });

const entries = [
  ...args.urls,
  ...(args.urlsFile ? parseUrlFile(args.urlsFile) : []),
].filter((entry, index, arr) => entry.url && arr.findIndex((other) => other.url === entry.url) === index);

const sources = [];
for (let i = 0; i < entries.length; i += 1) {
  const entry = entries[i];
  console.log(`Downloading ${i + 1}/${entries.length}: ${entry.url}`);
  const meta = metadataFor(entry.url);
  const result = downloadUrl(entry, outDir, i);
  const media = (result.mediaFiles || []).map((file) => {
    const probe = ffprobe(file);
    return { path: file, probe, quality: quality(probe) };
  });
  sources.push({ ...result, metadata: meta, media });
}

const ledger = {
  slug: args.slug,
  label: args.label,
  createdAt: new Date().toISOString(),
  outDir,
  urlCount: entries.length,
  sources,
};

const jsonPath = path.join(ledgerDir, "social-source-ledger.json");
const mdPath = path.join(ledgerDir, "social-source-ledger.md");
fs.writeFileSync(jsonPath, JSON.stringify(ledger, null, 2) + "\n");
writeMarkdown(ledger, mdPath);

console.log(`Done.
json=${jsonPath}
markdown=${mdPath}
media=${outDir}`);
