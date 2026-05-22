#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`Usage:
  node tools/render-hyperframes-clean.mjs [hyperframes render args...]

Runs:
  npx hyperframes render [args...]

Then cleans up any Puppeteer/Chrome renderer processes started by that render.
`);
  process.exit(0);
}

function listPuppeteerChromeProcesses() {
  const output = execFileSync("ps", ["-Ao", "pid=,args="], { encoding: "utf8" });
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(.+)$/);
      if (!match) return null;
      const [, pid, command] = match;
      if (!command.includes("puppeteer_dev_chrome_profile-")) return null;
      if (!command.includes("Google Chrome")) return null;
      const profileMatch = command.match(/--user-data-dir=("[^"]+"|'[^']+'|\S+)/);
      const profilePath = profileMatch?.[1]?.replace(/^["']|["']$/g, "");
      return { pid: Number(pid), command, profilePath };
    })
    .filter(Boolean);
}

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killPid(pid, signal) {
  try {
    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cleanupRenderers(beforePids) {
  const after = listPuppeteerChromeProcesses();
  const startedByRender = after.filter((proc) => !beforePids.has(proc.pid));

  if (startedByRender.length === 0) {
    console.log("[render-cleanup] no new Puppeteer Chrome renderers found");
    return;
  }

  console.log(`[render-cleanup] stopping ${startedByRender.length} Puppeteer Chrome renderer process(es)`);
  for (const proc of startedByRender) killPid(proc.pid, "SIGTERM");

  await sleep(1500);

  const stubborn = startedByRender.filter((proc) => processExists(proc.pid));
  if (stubborn.length > 0) {
    console.log(`[render-cleanup] force-stopping ${stubborn.length} remaining renderer process(es)`);
    for (const proc of stubborn) killPid(proc.pid, "SIGKILL");
  }

  const profilePaths = new Set(startedByRender.map((proc) => proc.profilePath).filter(Boolean));
  for (const profilePath of profilePaths) {
    try {
      rmSync(profilePath, { recursive: true, force: true });
    } catch {
      // Best effort. The important cleanup is terminating the renderer process.
    }
  }
}

const beforePids = new Set(listPuppeteerChromeProcesses().map((proc) => proc.pid));
let child;
let cleaningUp = false;

async function finish(exitCode) {
  if (cleaningUp) return;
  cleaningUp = true;
  await cleanupRenderers(beforePids);
  process.exit(exitCode);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    if (child && !child.killed) child.kill(signal);
    await finish(130);
  });
}

child = spawn("npx", ["hyperframes", "render", ...args], {
  stdio: "inherit",
  env: process.env,
});

child.on("error", async (error) => {
  console.error(`[render-cleanup] failed to start hyperframes render: ${error.message}`);
  await finish(1);
});

child.on("close", async (code, signal) => {
  if (signal) {
    console.error(`[render-cleanup] hyperframes render exited by signal ${signal}`);
    await finish(1);
  }
  await finish(code ?? 0);
});
