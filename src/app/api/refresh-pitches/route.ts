import { NextResponse } from "next/server";
import { generateText } from "@/lib/ai";
import { prisma } from "@/lib/db";

const SYSTEM_PROMPT = `You are a content strategist for a YouTube channel called "From The Logo" focused on Caitlin Clark and WNBA content.

You know the channel's top-performing title patterns and their average views:
- "The Day [Subject] [DRAMATIC VERB] [Object]" format — avg 800K views (best performer)
- "[Subject].. but they get increasingly [ADJECTIVE]" format — avg 500K views
- "[Entity] [Action]... But It Backfired SPECTACULARLY" format — avg 200K views

Content pillars: Caitlin Clark game breakdowns, WNBA controversies, player rivalries, skill highlights, career stories.

Generate exactly 3 pitch ideas, each in a DIFFERENT format (one the-day, one increasingly, one backfired).

Respond in this exact JSON format:
{
  "pitches": [
    {
      "title": "Video title here",
      "format": "the-day",
      "angle": "2-3 sentence explanation of the angle",
      "hookLine": "The opening hook line",
      "talkingPoints": ["Point 1", "Point 2", "Point 3", "Point 4"],
      "performanceScore": 85
    }
  ]
}`;

export async function POST() {
  try {
    const prompt = `Generate 3 new video pitch ideas for today. Consider current WNBA storylines and trending topics around Caitlin Clark.

Each pitch should be for a different format:
1. One "The Day..." format
2. One "...but they get increasingly..." format
3. One "...But It Backfired" format

Make the ideas timely, specific, and compelling. Return ONLY the JSON object.`;

    const result = await generateText(prompt, SYSTEM_PROMPT);

    let pitches;
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      const parsed = JSON.parse(jsonMatch[0]);
      pitches = parsed.pitches;
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      );
    }

    // Store pitches in database
    const provider = process.env.AI_PROVIDER || "anthropic";
    const model = process.env.AI_MODEL || "claude-sonnet-4-20250514";

    const created = await Promise.all(
      pitches.map(
        (p: {
          title: string;
          format: string;
          angle: string;
          hookLine: string;
          talkingPoints: string[];
          performanceScore: number;
        }) =>
          prisma.pitch.create({
            data: {
              title: p.title,
              format: p.format,
              angle: p.angle,
              hookLine: p.hookLine,
              talkingPoints: p.talkingPoints,
              performanceScore: p.performanceScore || 0,
              status: "pending",
              aiProvider: provider,
              aiModel: model,
            },
          })
      )
    );

    return NextResponse.json({ pitches: created, count: created.length });
  } catch (error) {
    console.error("Refresh pitches error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to refresh pitches" },
      { status: 500 }
    );
  }
}
