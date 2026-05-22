#!/usr/bin/env node
import fs from "node:fs";
import { execFileSync } from "node:child_process";

function usage() {
  console.error(`Usage:
  node tools/ftl-nitter-video-discover.mjs --account ACCOUNT --out urls.txt [options]

Options:
  --instance URL       Nitter instance. Default: https://nitter.tiekoetter.com
  --mode MODE          search or timeline. Default: search
  --query QUERY        Search query for search mode. Optional in timeline mode.
  --match-any TERMS    Comma-separated terms used to filter timeline posts by text/date/id.
  --source-type TYPE   Ledger type prefix. Default: official
  --append             Append to output file instead of overwriting
  --limit N            Max URLs. Default: 25

Example:
  node tools/ftl-nitter-video-discover.mjs \\
    --account IndianaFever \\
    --mode timeline \\
    --match-any "Caitlin Clark,Washington,triple,OT,dime" \\
    --out research/source-urls/fever-mystics-2026-05-15.txt \\
    --append

  node tools/ftl-nitter-video-discover.mjs \\
    --account IndianaFever \\
    --query "Caitlin Clark Mystics filter:videos" \\
    --out research/source-urls/fever-mystics-2026-05-15.txt \\
    --append`);
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

const account = args.get("account");
const mode = args.get("mode") || "search";
const query = args.get("query") || "";
const outPath = args.get("out");
const instance = (args.get("instance") || "https://nitter.tiekoetter.com").replace(/\/$/, "");
const sourceType = args.get("source-type") || "official";
const append = args.has("append");
const limit = Number(args.get("limit") || "25");
const matchAny = (args.get("match-any") || "")
  .split(",")
  .map((term) => term.trim().toLowerCase())
  .filter(Boolean);

if (!account || !outPath) usage();
if (mode !== "search" && mode !== "timeline") throw new Error(`Unsupported mode: ${mode}`);
if (mode === "search" && !query) usage();

function htmlDecode(value) {
  return String(value)
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x2F;", "/")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function stripTags(value) {
  return htmlDecode(String(value).replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

const discoveryUrl =
  mode === "timeline"
    ? `${instance}/${encodeURIComponent(account)}`
    : `${instance}/${encodeURIComponent(account)}/search?f=tweets&q=${encodeURIComponent(query)}`;
const html = execFileSync("curl", ["-L", "-s", "--max-time", "30", discoveryUrl], {
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
});
if (!html.includes("timeline-item")) throw new Error(`Nitter response did not include a timeline: ${discoveryUrl}`);

const items = html.split('<div class="timeline-item').slice(1);
const found = [];
const seen = new Set();

for (const raw of items) {
  if (!/gallery-video|video-container|card.*gallery-video|attachment/.test(raw)) continue;
  const linkMatch = raw.match(/class="tweet-link"\s+href="([^"]+\/status\/([0-9]+)[^"]*)"/);
  if (!linkMatch) continue;
  const statusId = linkMatch[2];
  if (seen.has(statusId)) continue;
  seen.add(statusId);

  const userMatch = raw.match(/data-username="([^"]+)"/);
  const username = userMatch?.[1] || account;
  const contentMatch = raw.match(/<div class="tweet-content media-body"[^>]*>([\s\S]*?)<\/div>/);
  const text = contentMatch ? stripTags(contentMatch[1]) : "";
  const dateMatch = raw.match(/class="tweet-date"><a[^>]+title="([^"]+)"/);
  const date = dateMatch ? htmlDecode(dateMatch[1]) : "";
  const haystack = `${text} ${date} ${statusId}`.toLowerCase();
  if (matchAny.length > 0 && !matchAny.some((term) => haystack.includes(term))) continue;
  const xUrl = `https://x.com/${username}/status/${statusId}/video/1`;
  found.push({ username, statusId, xUrl, text, date });
  if (found.length >= limit) break;
}

const label = mode === "timeline" ? `timeline${matchAny.length ? ` | match-any: ${matchAny.join(", ")}` : ""}` : query;
const header = `# Nitter discovery: ${account} | ${label} | ${new Date().toISOString()}`;
const lines = found.map((item) => `${sourceType} | ${item.username} | ${item.xUrl}`);
const body = [header, ...lines].join("\n") + "\n";

if (append && fs.existsSync(outPath)) {
  const existing = fs.readFileSync(outPath, "utf8");
  const newLines = lines.filter((line) => !existing.includes(line.split("|").pop().trim()));
  if (newLines.length) {
    fs.appendFileSync(outPath, `\n${header}\n${newLines.join("\n")}\n`);
  }
} else {
  fs.writeFileSync(outPath, body);
}

const jsonPath = `${outPath}.nitter-${account}-${Date.now()}.json`;
fs.writeFileSync(jsonPath, JSON.stringify({ account, mode, query, matchAny, discoveryUrl, found }, null, 2) + "\n");

console.log(`Found ${found.length} video tweet(s)`);
for (const item of found) console.log(`${item.xUrl} | ${item.date} | ${item.text.slice(0, 120)}`);
console.log(`wrote=${outPath}`);
console.log(`details=${jsonPath}`);
