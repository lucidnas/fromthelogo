import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import path from "path";
import fs from "fs";
import crypto from "crypto";

// Allow up to 5 minutes for image generation APIs
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

// ─── Format prompts ────────────────────────────────────────────────────────────

const ATHLETE_DESC =
  "A young female point guard for the Indiana Fever WNBA team, wearing jersey #22, " +
  "athletic build, light skin, often wears her hair in a ponytail or down, " +
  "royal blue and gold Indiana Fever uniform. Photorealistic portrait.";

function extractKeyWord(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("afraid")) return "AFRAID";
  if (lower.includes("problem")) return "PROBLEM";
  if (lower.includes("scariest") || lower.includes("scary")) return "SCARIEST";
  if (lower.includes("nightmare")) return "NIGHTMARE";
  if (lower.includes("changed") || lower.includes("not the same")) return "EVOLVED";
  if (lower.includes("everything")) return "EVERYTHING";
  if (lower.includes("ready")) return "NOT READY";
  if (lower.includes("obsessed")) return "OBSESSED";
  if (lower.includes("illegal")) return "ILLEGAL";
  if (lower.includes("message")) return "MESSAGE";
  return "DANGEROUS";
}

function extractVillain(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("swoopes")) return "Sheryl Swoopes";
  if (lower.includes("taurasi")) return "Diana Taurasi";
  if (lower.includes("wnba")) return "the WNBA";
  if (lower.includes("usa basketball")) return "USA Basketball";
  if (lower.includes("refs") || lower.includes("referee")) return "the refs";
  if (lower.includes("liberty")) return "the Liberty";
  return "the WNBA";
}

function buildPrompt(format: string, title: string): string {
  const keyWord = extractKeyWord(title);
  const villain = extractVillain(title);
  const base = `Subject: ${ATHLETE_DESC}\n\nVideo title: "${title}"\n\n`;

  if (format === "a") {
    return (
      base +
      `FORMAT: Pure Close-Up YouTube Thumbnail (16:9, 1536x1024)

Design spec:
- The athlete's face fills 70–80% of the frame, eyes clearly visible
- Shot from slightly below eye level
- Expression: intense, locked in, slight knowing smirk — she knows something you don't
- Background: dark arena blur, deep black to near-black (#0a0a0a to #111118)
- Warm court lighting illuminating her face from the front/below
- Indiana Fever #22 jersey visible at the shoulders
- NO text overlay of any kind
- Maximum visual impact — face is the ONLY focal point

ESPN/Sports Illustrated broadcast quality. Photorealistic. No watermarks or borders.`
    );
  }

  if (format === "b") {
    return (
      base +
      `FORMAT: Face Through Type YouTube Thumbnail (16:9, 1536x1024)

LAYER ORDER (critical — follow exactly):
1. BOTTOM layer: solid colour or gradient background
2. MIDDLE layer: the giant word "${keyWord}" — this is BEHIND the athlete
3. TOP layer: the athlete's full body/face — she is IN FRONT of the text, completely unobstructed

The text is a BACKGROUND element. The athlete is the FOREGROUND element.
NO text should touch, overlap, or cover any part of the athlete's face, hair, or body.
The text is only visible in the negative space to the left and right of the athlete's silhouette.
Think of it like the athlete is standing in front of a billboard — the billboard text peeks out around her edges.

Design spec:
- ONE massive word: "${keyWord}" — text height 40–60% of total image height, spanning full width
- Font: heavy condensed sans-serif (Anton / Black Han Sans style), ALL CAPS, white fill with thick black stroke
- The word is centred horizontally BEHIND the athlete — visible only where her body is NOT
- The athlete stands centre-frame, full body visible from waist up, face fully unobstructed
- Background: deep navy to electric blue gradient (#0a0f2e → #1a3aff) OR charcoal to gold (#1a1a1a → #c9a84c)
- Warm light on the athlete's face (from below or front)
- NO speech bubbles, NO bottom strips, NO villain, NO text over the face

The power of this format: the viewer sees the athlete first (foreground), then notices the giant word behind her (background). Her face is never hidden.`
    );
  }

  if (format === "c") {
    return (
      base +
      `FORMAT: Split Screen YouTube Thumbnail (16:9, 1536x1024)

Design spec:
- LEFT half: ${villain} — angry, pointing, shouting, or intensely confrontational expression; slightly darker/desaturated
- RIGHT half: the Indiana Fever #22 athlete — smiling, confident, unbothered or triumphant; brighter treatment
- CENTRE divider: torn paper / jagged ripped edge, white rough edge (NOT a straight line)
- White rounded speech bubble on the LEFT side, tail pointing to the villain
  - Villain's implied quote in 3–5 words, one key word in RED, rest in black
  - Example: "SHE DOESN'T DESERVE IT" with DESERVE in red
- Background: dark arena or blurred crowd (no solid colour backgrounds)
- High contrast between the two halves

The image tells the whole story in 0.3 seconds: villain attacks, athlete wins.`
    );
  }

  return base;
}

// ─── OpenAI generation ─────────────────────────────────────────────────────────

const REF_IMAGE_PATHS = [
  "clark-2025-portrait-cropped.jpg",
  "clark-fever-game-cropped.jpg",
  "clark-vs-minnesota-cropped.jpg",
];

function buildMultipart(
  fields: Record<string, string>,
  files: Array<{ field: string; filename: string; data: Buffer; mime: string }>
): { body: Buffer; contentType: string } {
  const boundary = crypto.randomBytes(16).toString("hex");
  const parts: Buffer[] = [];

  for (const [name, value] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  for (const { field, filename, data, mime } of files) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`));
    parts.push(data);
    parts.push(Buffer.from("\r\n"));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

async function generateOpenAI(prompt: string): Promise<{ buffer: Buffer; mime: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const refDir = path.join(process.cwd(), "public", "clark-reference");
  const refFiles: Array<{ field: string; filename: string; data: Buffer; mime: string }> = [];
  for (const name of REF_IMAGE_PATHS) {
    const p = path.join(refDir, name);
    if (fs.existsSync(p)) {
      refFiles.push({ field: "image[]", filename: name, data: fs.readFileSync(p), mime: "image/jpeg" });
    }
  }

  if (refFiles.length > 0) {
    const { body, contentType } = buildMultipart(
      { model: "gpt-image-2", prompt, n: "1", size: "1536x1024", quality: "high" },
      refFiles
    );
    const res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": contentType },
      body: new Uint8Array(body),
    });
    if (res.ok) {
      const data = await res.json();
      const b64 = data.data?.[0]?.b64_json;
      if (b64) return { buffer: Buffer.from(b64, "base64"), mime: "image/png" };
    } else {
      console.warn(`OpenAI edits failed (${res.status}), falling back to generations`);
    }
  }

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-image-2", prompt, n: 1, size: "1536x1024" }),
  });
  if (!res.ok) throw new Error(`OpenAI error (${res.status}): ${await res.text()}`);
  const data = await res.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image returned from OpenAI");
  return { buffer: Buffer.from(b64, "base64"), mime: "image/png" };
}

// ─── Gemini generation ─────────────────────────────────────────────────────────

async function generateGemini(prompt: string): Promise<{ buffer: Buffer; mime: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const refDir = path.join(process.cwd(), "public", "clark-reference");
  const parts: unknown[] = [];
  for (const name of REF_IMAGE_PATHS) {
    const p = path.join(refDir, name);
    if (fs.existsSync(p)) {
      parts.push({ inline_data: { mime_type: "image/jpeg", data: fs.readFileSync(p).toString("base64") } });
    }
  }
  parts.push({ text: prompt });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"], temperature: 1.0 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini error (${res.status}): ${await res.text()}`);

  const data = await res.json();
  const responseParts = data?.candidates?.[0]?.content?.parts ?? [];
  for (const part of responseParts) {
    const imgData = part.inlineData || part.inline_data;
    if (imgData && (imgData.mimeType || imgData.mime_type || "").startsWith("image/")) {
      const mime = imgData.mimeType || imgData.mime_type;
      return { buffer: Buffer.from(imgData.data, "base64"), mime };
    }
  }
  throw new Error("No image returned from Gemini");
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, title, format, model, imageData } = body;

    if (!slug || !title || !format || !model) {
      return NextResponse.json({ error: "slug, title, format, and model are required" }, { status: 400 });
    }
    if (!["a", "b", "c"].includes(format)) {
      return NextResponse.json({ error: "format must be a, b, or c" }, { status: 400 });
    }
    if (!["openai", "gemini"].includes(model)) {
      return NextResponse.json({ error: "model must be openai or gemini" }, { status: 400 });
    }

    // imageData: if provided (local push), skip generation
    // Must be base64 string (raw bytes, no data URL prefix) with mime type
    let dataUrl: string;

    if (imageData) {
      // Local push mode — verify secret
      const secret = request.headers.get("x-cron-secret");
      if (!CRON_SECRET || secret !== CRON_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      // imageData can be a full data URL or raw base64
      if (imageData.startsWith("data:")) {
        dataUrl = imageData;
      } else {
        const mime = model === "gemini" ? "image/jpeg" : "image/png";
        dataUrl = `data:${mime};base64,${imageData}`;
      }
    } else {
      // Server generation mode
      const prompt = buildPrompt(format, title);
      let result: { buffer: Buffer; mime: string };
      if (model === "openai") {
        result = await generateOpenAI(prompt);
      } else {
        result = await generateGemini(prompt);
      }
      dataUrl = `data:${result.mime};base64,${result.buffer.toString("base64")}`;
    }

    // Version number
    const existing = await prisma.generatedThumbnail.findMany({
      where: { slug, format, model },
      orderBy: { version: "desc" },
      take: 1,
    });
    const version = existing.length > 0 ? existing[0].version + 1 : 1;

    // Save to DB — imageUrl holds the data URL for persistence
    const record = await prisma.generatedThumbnail.create({
      data: { slug, title, format, model, imageUrl: dataUrl, version },
    });

    return NextResponse.json({ thumbnail: record });
  } catch (error) {
    console.error("Thumbnail generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
