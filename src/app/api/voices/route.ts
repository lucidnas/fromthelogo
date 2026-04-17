import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ElevenLabs API key not configured" }, { status: 500 });
  }

  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": apiKey },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch voices" }, { status: res.status });
  }

  const data = await res.json();
  const voices = data.voices.map((v: any) => ({
    id: v.voice_id,
    name: v.name,
    category: v.category,
    previewUrl: v.preview_url,
    labels: v.labels,
  }));

  return NextResponse.json({ voices });
}
