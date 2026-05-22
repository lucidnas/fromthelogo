import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { readFile, VIDEOS_DIR } from "@/lib/studio";
import path from "path";

const execFileAsync = promisify(execFile);

export async function POST(req: NextRequest) {
  const { slug } = await req.json();
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const brief = readFile(slug, "brief.txt");
  if (!brief) return NextResponse.json({ error: "No brief.txt found" }, { status: 400 });

  const briefPath = path.join(VIDEOS_DIR, slug, "brief.txt");
  const outPath = path.join(VIDEOS_DIR, slug, "thumbnail.png");

  try {
    const { stdout, stderr } = await execFileAsync(
      "python3",
      [
        path.join(process.env.HOME!, ".claude/skills/ftl-thumbnail/generate.py"),
        briefPath,
        "--out", outPath,
      ],
      { timeout: 120_000 }
    );
    return NextResponse.json({ log: stdout || stderr || "Done." });
  } catch (err: unknown) {
    const e = err as { message: string; stderr?: string };
    return NextResponse.json({ error: e.stderr ?? e.message }, { status: 500 });
  }
}
