#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function usage() {
  console.error(`Usage:
  node tools/ftl-source-game-clips.mjs --slug SLUG --match-any TERMS [options]

Discovers official account video posts through Nitter, appends them to:
  research/source-urls/{slug}.txt

Then downloads every URL in that file through:
  tools/ftl-social-clip-ingest.mjs

Options:
  --account ACCOUNT       Official X account to scan. Repeatable. Default: IndianaFever
  --match-any TERMS       Comma-separated terms for timeline filtering.
                          Example: "Caitlin Clark,Clark,CC,Washington,triple,three,dime,assist,OT"
  --url URL               Seed URL to include before discovery. Repeatable.
  --source TYPE|NAME|URL  Seed annotated URL line. Repeatable.
  --source-file FILE      Extra URL file to merge before discovery.
  --limit N               Max Nitter URLs per account. Default: 25
  --instance URL          Nitter instance. Default: https://nitter.tiekoetter.com
  --skip-ingest           Only discover/update source URLs; do not download.

Examples:
  node tools/ftl-source-game-clips.mjs \\
    --slug fever-mystics-2026-05-15 \\
    --match-any "Caitlin Clark,Clark,CC,Washington,triple,three,dime,assist,OT"

  node tools/ftl-source-game-clips.mjs \\
    --slug fever-storm-2026-05-17 \\
    --account IndianaFever \\
    --account WNBA \\
    --match-any "Caitlin Clark,Clark,CC,Seattle,Storm,three,dime,assist" \\
    --url "https://www.youtube.com/watch?v=..."`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {
    accounts: [],
    urls: [],
    sources: [],
    limit: "25",
    instance: "https://nitter.tiekoetter.com",
    skipIngest: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (!value) usage();
      return value;
    };
    if (arg === "--slug") args.slug = next();
    else if (arg === "--account") args.accounts.push(next());
    else if (arg === "--match-any") args.matchAny = next();
    else if (arg === "--url") args.urls.push(next());
    else if (arg === "--source") args.sources.push(next());
    else if (arg === "--source-file") args.sourceFile = next();
    else if (arg === "--limit") args.limit = next();
    else if (arg === "--instance") args.instance = next();
    else if (arg === "--skip-ingest") args.skipIngest = true;
    else usage();
  }

  if (!args.slug || !args.matchAny) usage();
  if (!args.accounts.length) args.accounts.push("IndianaFever");
  return args;
}

function run(command, args, options = {}) {
  const proc = spawnSync(command, args, {
    cwd: options.cwd || process.cwd(),
    encoding: "utf8",
    stdio: options.stdio || "inherit",
  });
  if (proc.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit ${proc.status}`);
  }
  return proc.stdout;
}

function normalizeSourceLine(line, fallbackType = "seed", fallbackAccount = "manual") {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return "";
  if (trimmed.includes("|")) return trimmed;
  return `${fallbackType} | ${fallbackAccount} | ${trimmed}`;
}

function appendUniqueLines(filePath, lines, header) {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const existingUrls = new Set(
    existing
      .split(/\r?\n/)
      .map((line) => line.split("|").pop()?.trim())
      .filter(Boolean)
  );
  const fresh = lines.filter((line) => {
    const url = line.split("|").pop()?.trim();
    return url && !existingUrls.has(url);
  });
  if (!fresh.length) return 0;
  fs.appendFileSync(filePath, `${existing.endsWith("\n") || !existing ? "" : "\n"}\n${header}\n${fresh.join("\n")}\n`);
  return fresh.length;
}

const args = parseArgs(process.argv.slice(2));
const repoRoot = process.cwd();
const sourceDir = path.join(repoRoot, "research/source-urls");
const sourcePath = path.join(sourceDir, `${args.slug}.txt`);

fs.mkdirSync(sourceDir, { recursive: true });

if (!fs.existsSync(sourcePath)) {
  fs.writeFileSync(
    sourcePath,
    [
      `# ${args.slug}`,
      "# Game/source clip list.",
      "# Format: type | account | URL",
      "",
    ].join("\n")
  );
}

const seedLines = [
  ...args.urls.map((url) => normalizeSourceLine(url)),
  ...args.sources.map((line) => normalizeSourceLine(line)),
];

if (args.sourceFile) {
  const extra = fs.readFileSync(args.sourceFile, "utf8")
    .split(/\r?\n/)
    .map((line) => normalizeSourceLine(line))
    .filter(Boolean);
  seedLines.push(...extra);
}

const seeded = appendUniqueLines(
  sourcePath,
  seedLines,
  `# Manual seed URLs, ${new Date().toISOString()}`
);
if (seeded) console.log(`Seeded ${seeded} URL(s) into ${sourcePath}`);

for (const account of args.accounts) {
  console.log(`Discovering official videos from @${account} via Nitter timeline...`);
  run("node", [
    "tools/ftl-nitter-video-discover.mjs",
    "--account", account,
    "--mode", "timeline",
    "--match-any", args.matchAny,
    "--out", sourcePath,
    "--append",
    "--source-type", "official",
    "--limit", args.limit,
    "--instance", args.instance,
  ]);
}

if (!args.skipIngest) {
  console.log(`Downloading/ledgering sources for ${args.slug}...`);
  run("node", [
    "tools/ftl-social-clip-ingest.mjs",
    "--slug", args.slug,
    "--urls-file", sourcePath,
  ]);
}

console.log(`Done.
sourceFile=${sourcePath}
mediaDir=/Volumes/SSK SSD/broll/social/${args.slug}
ledger=/Volumes/SSK SSD/ftl/videos/${args.slug}/sources/social-source-ledger.md`);
