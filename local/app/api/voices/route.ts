import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ELEVENLABS_API_KEY not set in .env.local" }, { status: 500 });

  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": apiKey },
  });

  if (!res.ok) return NextResponse.json({ error: "Failed to fetch voices" }, { status: res.status });

  const data = await res.json();
  const voices = (data.voices as Array<{
    voice_id: string; name: string; category: string; preview_url: string | null; labels: Record<string, string>;
  }>).map((v) => ({
    id: v.voice_id,
    name: v.name,
    category: v.category,
    previewUrl: v.preview_url,
    labels: v.labels,
  }));

  return NextResponse.json({ voices });
}
