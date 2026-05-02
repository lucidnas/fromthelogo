import { NextRequest, NextResponse } from "next/server";
import { readFile, VIDEOS_DIR, writeVideoMeta } from "@/lib/studio";
import fs from "fs";
import path from "path";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const { slug, voiceId = "DTLT09E2cxHF0DqjKVbc", voiceName = "Australian Neutral - Calm / Professional" } = await req.json();
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const script = readFile(slug, "script.txt");
  if (!script) return NextResponse.json({ error: "No script.txt found" }, { status: 400 });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ELEVENLABS_API_KEY not set in .env.local" }, { status: 500 });

  const cleanText = script
    .replace(/\[.*?\]/g, "")          // strip stage directions
    .replace(/(\D),(\s)/g, "$1...$2") // commas → ellipsis for pause, but not in numbers (1,200)
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: cleanText,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.5, use_speaker_boost: true },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: `ElevenLabs: ${err}` }, { status: 500 });
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const outDir = path.join(VIDEOS_DIR, slug);
  fs.mkdirSync(outDir, { recursive: true });

  // Save with timestamp so multiple takes are preserved
  const timestamp = Date.now();
  const takePath = path.join(outDir, `vo-${voiceName.replace(/\s+/g, "-").toLowerCase()}-${timestamp}.mp3`);
  fs.writeFileSync(takePath, buf);

  // Also write as the canonical vo.mp3
  fs.writeFileSync(path.join(outDir, "vo.mp3"), buf);

  writeVideoMeta(slug, { status: "vo" });

  return NextResponse.json({
    log: `✓ VO saved (${(buf.length / 1024 / 1024).toFixed(1)} MB)\nVoice: ${voiceName}\nFile: ${takePath}`,
    takePath: takePath.replace(VIDEOS_DIR, ""),
  });
}
