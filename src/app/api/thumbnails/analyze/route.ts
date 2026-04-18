import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const SYSTEM_PROMPT = `You are a YouTube thumbnail expert deeply familiar with what drives viral clicks on sports and personality-driven channels, especially on WNBA and Caitlin Clark coverage.

You are about to examine the top-performing thumbnails from a channel called "From The Logo" that covers Caitlin Clark and the WNBA. Your job is to identify concrete, replicable patterns — not generic advice.

Return your analysis as well-formatted Markdown with the following sections. Be specific (name colors, reference the actual thumbnails, quote the text you see). Avoid filler.

## Visual Composition Patterns
Where faces are placed (rule of thirds, center, split screens). How subjects are framed (close crops, zoom level). Layering and depth.

## Text Treatment
Casing (ALL CAPS vs mixed), font weight, stroke/outline, highlight/accent colors on specific words, word count, typical phrasing hooks.

## Emotional Expressions
List the specific emotions captured (anger, shock, celebration, disbelief, smugness, fear). Which emotions appear most often in the top performers?

## Color Palette
Dominant colors, contrast pairings (e.g. red vs teal), use of saturation, backgrounds.

## Props & Graphic Elements
Arrows, circles, brackets, emojis, stats overlays, team logos, score graphics, split-screen versus panels.

## The "Click-Worthy" Energy
What specifically creates tension or intrigue? Is it confrontation, vindication, narrative promise? What story does the image tell in half a second?

## Actionable Recommendations
A numbered list of 6-10 concrete, copy-paste-ready tactics for replicating these patterns on new thumbnails. Each should be a single short sentence starting with a verb.`;

async function callClaudeVision(imageUrls: string[]): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const content: Array<Record<string, unknown>> = [];
  imageUrls.forEach((url, idx) => {
    content.push({
      type: "image",
      source: { type: "url", url },
    });
    content.push({
      type: "text",
      text: `Thumbnail #${idx + 1}`,
    });
  });
  content.push({
    type: "text",
    text: "Analyze the 10 thumbnails above (all from a Caitlin Clark / WNBA YouTube channel). Return the markdown analysis per your instructions.",
  });

  const body = {
    model: process.env.AI_MODEL || "claude-opus-4-7",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const text = data.content
    ?.filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("");
  return text || "";
}

export async function GET() {
  try {
    const latest = await prisma.thumbnailAnalysis.findFirst({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ analysis: latest });
  } catch (error) {
    console.error("Get thumbnail analysis error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load analysis" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { force } = await request.json().catch(() => ({ force: false }));

    const latest = await prisma.thumbnailAnalysis.findFirst({
      orderBy: { createdAt: "desc" },
    });

    const isFresh =
      latest && Date.now() - new Date(latest.createdAt).getTime() < SEVEN_DAYS_MS;

    if (!force && isFresh) {
      return NextResponse.json({ analysis: latest, cached: true });
    }

    const topVideos = await prisma.channelStat.findMany({
      orderBy: { views: "desc" },
      take: 10,
    });

    if (topVideos.length === 0) {
      return NextResponse.json(
        { error: "No videos found to analyze" },
        { status: 400 }
      );
    }

    const imageUrls = topVideos.map(
      (v) => `https://img.youtube.com/vi/${v.youtubeId}/hqdefault.jpg`
    );

    const analysisText = await callClaudeVision(imageUrls);

    const saved = await prisma.thumbnailAnalysis.create({
      data: {
        analysis: analysisText,
        videoIds: topVideos.map((v) => v.youtubeId),
      },
    });

    return NextResponse.json({ analysis: saved, cached: false });
  } catch (error) {
    console.error("Thumbnail analysis error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze thumbnails" },
      { status: 500 }
    );
  }
}
