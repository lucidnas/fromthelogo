import { NextResponse } from "next/server";
import { generateText } from "@/lib/ai";
import { prisma } from "@/lib/db";

const SYSTEM_PROMPT = `You are a content strategist for a YouTube channel called "From The Logo" focused on Caitlin Clark and WNBA content.

You generate TWO types of pitches:

=== TRENDING NEWS PITCHES (3 pitches) ===
Style: BasketballTopStories — fast-turnaround content capitalizing on what's happening NOW.
- Based on current/recent Caitlin Clark news, WNBA developments, Team USA, Indiana Fever moves
- Dramatic framing titles: "[Person] REVEALS...", "BREAKING: Caitlin Clark...", "The WNBA Just..."
- Frame everything from a pro-Caitlin Clark angle
- ALL CAPS for 2-3 emphasis words in titles
- Mark pitchType as "trending"

=== EVERGREEN STORY PITCHES (2 pitches) ===
Style: DKM Sports — timeless narrative stories that work regardless of when published.
- DKM title patterns: "When You're The Best [X] But [contrast]", "They Said [doubt] But [result]", "How [person] Became [achievement]", "She Was [impressive thing] But [contrast]"
- Deep storytelling, character-driven narratives about Caitlin Clark
- Mark pitchType as "evergreen"

Respond in this exact JSON format:
{
  "pitches": [
    {
      "title": "Video title here",
      "format": "trending or evergreen",
      "pitchType": "trending or evergreen",
      "angle": "2-3 sentence explanation of the angle",
      "hookLine": "The opening hook line",
      "talkingPoints": ["Point 1", "Point 2", "Point 3", "Point 4"],
      "performanceScore": 85
    }
  ]
}`;

export async function POST() {
  try {
    const prompt = `Generate 5 new video pitch ideas for today. Consider current WNBA storylines and trending topics around Caitlin Clark.

Generate exactly:
- 3 TRENDING NEWS pitches (timely, dramatic, current events). Set pitchType to "trending".
- 2 EVERGREEN STORY pitches (timeless narratives using DKM title patterns). Set pitchType to "evergreen".

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

    const provider = process.env.AI_PROVIDER || "anthropic";
    const model = process.env.AI_MODEL || "claude-sonnet-4-6";

    const created = await Promise.all(
      pitches.map(
        (p: {
          title: string;
          format: string;
          pitchType?: string;
          angle: string;
          hookLine: string;
          talkingPoints: string[];
          performanceScore: number;
        }) =>
          prisma.pitch.create({
            data: {
              title: p.title,
              format: p.format || p.pitchType || "trending",
              pitchType: p.pitchType || p.format || "trending",
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
