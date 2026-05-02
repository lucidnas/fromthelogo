import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { text, voiceId } = await req.json();
  if (!text || !voiceId) return NextResponse.json({ error: "text and voiceId required" }, { status: 400 });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ELEVENLABS_API_KEY not set" }, { status: 500 });

  const cleanText = text
    .replace(/\[.*?\]/g, "")
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
    return NextResponse.json({ error: `ElevenLabs: ${err}` }, { status: res.status });
  }

  const buf = Buffer.from(await res.arrayBuffer());
  return NextResponse.json({ audio: buf.toString("base64") });
}
