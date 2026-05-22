#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

function usage() {
  console.error(`Usage:
  node tools/ftl-assist-discrepancy-package.mjs --slug SLUG --source-clip FILE --official FILE [options]

Creates a deterministic Caitlin Clark assist-credit discrepancy package:
1. Cuts the disputed assist-like possessions.
2. Generates contact sheets.
3. Runs Gemini verification on the cutdowns unless --skip-gemini is set.

Options:
  --out-dir DIR       Default: /Volumes/SSK SSD/ftl/videos/{slug}/clips/assist-discrepancy
  --analysis-dir DIR  Default: /Volumes/SSK SSD/ftl/videos/{slug}/analysis
  --model MODEL       Default: gemini-3.1-pro-preview
  --skip-gemini      Only cut clips and write the segment ledger.

Default segments are for Fever vs Mystics 2026-05-15:
  00:33-00:45 Q2 Billings hockey assist
  01:17-01:29 Q4 Mitchell direct assist candidate`);
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

function run(command, commandArgs) {
  console.log(`$ ${[command, ...commandArgs].map((part) => /\s/.test(part) ? JSON.stringify(part) : part).join(" ")}`);
  execFileSync(command, commandArgs, { stdio: "inherit" });
}

const slug = args.get("slug");
const sourceClip = args.get("source-clip");
const official = args.get("official");
const outDir = args.get("out-dir") || (slug ? `/Volumes/SSK SSD/ftl/videos/${slug}/clips/assist-discrepancy` : null);
const analysisDir = args.get("analysis-dir") || (slug ? `/Volumes/SSK SSD/ftl/videos/${slug}/analysis` : null);
const model = args.get("model") || "gemini-3.1-pro-preview";
const skipGemini = args.has("skip-gemini");

if (!slug || !sourceClip || !official || !outDir || !analysisDir) usage();
if (!fs.existsSync(sourceClip)) throw new Error(`Missing --source-clip: ${sourceClip}`);
if (!fs.existsSync(official)) throw new Error(`Missing --official: ${official}`);

const repoRoot = path.resolve(import.meta.dirname, "..");
const cutScript = path.join(repoRoot, "tools", "ftl-cut-video-segments.mjs");
const verifyScript = path.join(repoRoot, "tools", "gemini-verify-assist-cuts.mjs");
const ledgerPath = path.join(outDir, "segments-ledger.json");
const verificationPath = path.join(analysisDir, "assist-discrepancy-cut-verification.json");

run("node", [
  cutScript,
  "--input", sourceClip,
  "--out-dir", outDir,
  "--segment", "q2-billings-hockey-assist|0:33|0:45|01-q2-billings-hockey-assist.mp4|Clark drive and kick starts the Billings three; official WNBA play has no Clark assist",
  "--segment", "q4-mitchell-direct-candidate|1:17|1:29|02-q4-mitchell-direct-assist-candidate.mp4|Clark pass to Mitchell running three; official WNBA play has no Clark assist",
]);

if (!skipGemini) {
  run("node", [
    verifyScript,
    "--ledger", ledgerPath,
    "--official", official,
    "--out", verificationPath,
    "--model", model,
  ]);
}

console.log(JSON.stringify({
  slug,
  sourceClip,
  official,
  outDir,
  ledgerPath,
  verificationPath: skipGemini ? null : verificationPath,
}, null, 2));
