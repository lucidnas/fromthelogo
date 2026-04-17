import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ElevenLabs API key not configured" }, { status: 500 });
  }

  const { text, voiceId, voiceName, videoId, isTest } = await req.json();

  if (!text || !voiceId) {
    return NextResponse.json({ error: "text and voiceId are required" }, { status: 400 });
  }

  // Strip script markers like [HOOK], [INTRO], etc for cleaner audio
  const cleanText = text.replace(/\[.*?\]/g, "").replace(/\n{3,}/g, "\n\n").trim();

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: cleanText,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.5,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return NextResponse.json({ error: `ElevenLabs error: ${errText}` }, { status: res.status });
  }

  const audioBuffer = await res.arrayBuffer();
  const base64Audio = Buffer.from(audioBuffer).toString("base64");

  return NextResponse.json({
    audio: base64Audio,
    voiceId,
    voiceName: voiceName || "Unknown",
    videoId: videoId || null,
    isTest: isTest || false,
    generatedAt: new Date().toISOString(),
  });
}
