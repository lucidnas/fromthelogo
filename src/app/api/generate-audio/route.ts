import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import fs from "fs";
import path from "path";

// Full scripts can take 2–4 min with ElevenLabs
export const maxDuration = 300;

// ── Background processor ────────────────────────────────────────────────────

async function processAudioJob(jobId: number, text: string, voiceId: string, voiceName: string, videoId: number) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    await prisma.audioJob.update({ where: { id: jobId }, data: { status: "failed", error: "ElevenLabs API key not configured" } });
    return;
  }

  try {
    await prisma.audioJob.update({ where: { id: jobId }, data: { status: "processing" } });

    const cleanText = text.replace(/\[.*?\]/g, "").replace(/\n{3,}/g, "\n\n").trim();

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
      const errText = await res.text();
      await prisma.audioJob.update({ where: { id: jobId }, data: { status: "failed", error: `ElevenLabs error: ${errText}` } });
      return;
    }

    const audioBuffer = await res.arrayBuffer();
    const audioBytes = Buffer.from(audioBuffer);
    const dataUrl = `data:audio/mpeg;base64,${audioBytes.toString("base64")}`;

    // Best-effort filesystem save (ephemeral — only useful for current pod lifetime)
    try {
      const dir = path.join(process.cwd(), "public", "audio", String(videoId));
      fs.mkdirSync(dir, { recursive: true });
      const filename = `${Date.now()}.mp3`;
      fs.writeFileSync(path.join(dir, filename), audioBytes);
    } catch {
      // Ignore — filesystem is ephemeral on Railway, DB is the source of truth
    }

    // Always store the data URL in DB so audio survives redeploys
    const audio = await prisma.audio.create({
      data: {
        videoId,
        voiceId,
        voiceName,
        audioUrl: dataUrl,
        isTest: false,
      },
    });

    await prisma.audioJob.update({
      where: { id: jobId },
      data: { status: "done", audioId: audio.id },
    });
  } catch (err) {
    await prisma.audioJob.update({
      where: { id: jobId },
      data: { status: "failed", error: err instanceof Error ? err.message : "Unknown error" },
    });
  }
}

// ── POST — start background job ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ElevenLabs API key not configured" }, { status: 500 });
  }

  const { text, voiceId, voiceName, videoId } = await req.json();

  if (!text || !voiceId) {
    return NextResponse.json({ error: "text and voiceId are required" }, { status: 400 });
  }

  // Snippet test (no videoId) — run inline and return base64
  if (!videoId) {
    const cleanText = text.replace(/\[.*?\]/g, "").replace(/\n{3,}/g, "\n\n").trim();
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
      const errText = await res.text();
      return NextResponse.json({ error: `ElevenLabs error: ${errText}` }, { status: res.status });
    }
    const audioBuffer = await res.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString("base64");
    return NextResponse.json({ audio: base64Audio, audioUrl: `data:audio/mpeg;base64,${base64Audio}` });
  }

  // Full VO — create a job and fire-and-forget
  const job = await prisma.audioJob.create({
    data: { videoId: Number(videoId), voiceId, voiceName: voiceName || "Unknown", status: "pending" },
  });

  // Fire and forget — Railway is a persistent server (not serverless), so this continues
  processAudioJob(job.id, text, voiceId, voiceName || "Unknown", Number(videoId)).catch(() => {});

  return NextResponse.json({ jobId: job.id });
}

// ── GET — list audios for a video ───────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get("videoId");
  if (!videoId) {
    return NextResponse.json({ error: "videoId is required" }, { status: 400 });
  }
  const audios = await prisma.audio.findMany({
    where: { videoId: Number(videoId) },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ audios });
}
