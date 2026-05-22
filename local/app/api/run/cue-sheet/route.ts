import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { VIDEOS_DIR, BROLL_DIR } from "@/lib/studio";
import path from "path";
import fs from "fs";

const execFileAsync = promisify(execFile);

export async function POST(req: NextRequest) {
  const { slug, broll = "broll-1" } = await req.json();
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const scriptPath = path.join(VIDEOS_DIR, slug, "script.txt");
  if (!fs.existsSync(scriptPath)) {
    return NextResponse.json({ error: "No script.txt found" }, { status: 400 });
  }

  const outPath = path.join(VIDEOS_DIR, slug, "cue-sheet.txt");

  try {
    const { stdout, stderr } = await execFileAsync(
      "python3",
      [
        path.join(process.env.HOME!, ".claude/skills/broll/cue-sheet.py"),
        scriptPath,
        "--broll", broll,
        "--out", outPath,
      ],
      { timeout: 300_000, env: { ...process.env } }
    );
    return NextResponse.json({ log: stdout || stderr || "Done." });
  } catch (err: unknown) {
    const e = err as { message: string; stderr?: string };
    return NextResponse.json({ error: e.stderr ?? e.message }, { status: 500 });
  }
}
