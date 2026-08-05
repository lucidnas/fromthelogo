#!/usr/bin/env node
/**
 * Render an existing FTL HyperFrames project on Modal only.
 *
 * This command intentionally has no local-render path. It bundles the authored
 * project, uploads it to the shared Modal volume, invokes the cloud renderer,
 * retrieves the finished MP4, and removes the remote job.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const REPO = "/Users/abdul/code/fromthelogo";
const APP = path.join(REPO, "tools/modal/hyperframes_render_modal_app.py");
const VOLUME = "video-render-io";

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function parse(argv) {
  const args = { quality: "high" };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = () => argv[++i] ?? fail(`${token} requires a value`);
    if (token === "--project") args.project = path.resolve(next());
    else if (token === "--out") args.out = path.resolve(next());
    else if (token === "--quality") args.quality = next();
    else if (token === "--job-id") args.jobId = next();
    else if (token === "--help" || token === "-h") {
      console.log("Usage: node tools/ftl-render-hyperframes-modal.mjs --project DIR --out FILE [--quality draft|standard|high] [--job-id ID]");
      process.exit(0);
    } else fail(`unknown argument ${token}`);
  }
  if (!args.project) fail("--project is required");
  if (!args.out) fail("--out is required");
  if (!fs.existsSync(path.join(args.project, "index.html"))) fail("project is missing index.html");
  if (!fs.existsSync(path.join(args.project, "hyperframes.json"))) fail("project is missing hyperframes.json");
  if (!new Set(["draft", "standard", "high"]).has(args.quality)) fail("invalid --quality");
  return args;
}

function run(command, args, options = {}) {
  console.log(`$ ${command} ${args.map((x) => JSON.stringify(String(x))).join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0 && !options.allowFail) fail(`${command} exited ${result.status}`);
}

function resolveModal() {
  const candidates = [
    process.env.MODAL_BIN,
    path.join(os.homedir(), ".pyenv/versions/3.11.0/envs/modal-env/bin/modal"),
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? "modal";
}

const args = parse(process.argv.slice(2));
const modal = resolveModal();
const safeBase = path.basename(args.project).replace(/[^a-zA-Z0-9_-]+/g, "-");
const jobId = args.jobId ?? `ftl-${safeBase}-${Date.now()}`;
const packageRoot = "/Volumes/SSK SSD/fromthelogo-cache/modal-packages";
fs.mkdirSync(packageRoot, { recursive: true });
const stage = fs.mkdtempSync(path.join(packageRoot, "ftl-modal-package-"));
const bundle = path.join(stage, "project.tar.gz");

try {
  const members = ["index.html", "hyperframes.json", "assets"];
  for (const optional of ["package.json", "meta.json", "DESIGN.md", "BRIEF.md", "STORYBOARD.md"]) {
    if (fs.existsSync(path.join(args.project, optional))) members.push(optional);
  }
  run("tar", ["czf", bundle, "-C", args.project, ...members]);
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  run(modal, ["volume", "create", VOLUME], { allowFail: true });
  run(modal, ["volume", "put", VOLUME, bundle, `/hfjobs/${jobId}/project.tar.gz`]);
  run(modal, ["run", APP, "--job-id", jobId, "--quality", args.quality]);
  run(modal, ["volume", "get", "--force", VOLUME, `/hfjobs/${jobId}/ep.mp4`, args.out]);
  console.log(JSON.stringify({ mode: "modal", jobId, project: args.project, output: args.out, quality: args.quality }, null, 2));
} finally {
  run(modal, ["volume", "rm", VOLUME, `/hfjobs/${jobId}`, "-r"], { allowFail: true });
  fs.rmSync(stage, { recursive: true, force: true });
}
