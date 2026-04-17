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
- Quick turnaround content that capitalizes on what's happening NOW
- Use dramatic verbs: DEMOLISHED, SILENCED, EXPOSED, HUMBLED, DESTROYED, REVEALS, JUST
- ALL CAPS for 2-3 emphasis words in titles
- Mark pitchType as "trending"

=== EVERGREEN STORY PITCHES (2 pitches) ===
Style: DKM Sports — timeless narrative stories that work regardless of when published.
- Deep storytelling, character-driven narratives
- Apply to Caitlin Clark's career, specific games, rivalries, achievements

DKM's best performing title patterns (USE THESE):
- "When You're The Best [X] But The [League] Doesn't Care" — avg 500K+ views
- "They Said [doubt about player] But [result]" — avg 300K+ views
- "How [unlikely person] Became [achievement]" — avg 250K+ views
- "He/She Was [impressive thing] But [contrast]" — avg 200K+ views

These are timeless stories about perseverance, overcoming doubt, unexpected journeys.
- Mark pitchType as "evergreen"

Respond in this exact JSON format:
{
  "pitches": [
    {
      "title": "Video title here",
      "format": "trending or evergreen",
      "pitchType": "trending or evergreen",
      "angle": "2-3 sentence explanation of the angle and why this video would perform well",
      "hookLine": "The opening hook line that grabs attention",
      "talkingPoints": ["Point 1", "Point 2", "Point 3", "Point 4"],
      "performanceScore": 85
    }
  ]
}

Each performanceScore should be 1-100 based on how likely the video is to perform well. Be realistic — not everything is a 90+.`;

export async function POST() {
  try {
    const prompt = `Generate 5 new video pitch ideas for today's content slate.

Generate exactly:
- 3 TRENDING NEWS pitches (BasketballTopStories style) — timely, dramatic, capitalizing on current Caitlin Clark / WNBA / Indiana Fever news. Use dramatic title framing. Set pitchType to "trending".
- 2 EVERGREEN STORY pitches (DKM Sports style) — timeless narrative stories using DKM title patterns like "When You're The Best..." or "They Said... But...". Set pitchType to "evergreen".

Make the trending ideas feel urgent and current. Make the evergreen ideas feel like deep, compelling stories.

Return ONLY the JSON object, no other text.`;

    const result = await generateText(prompt, SYSTEM_PROMPT);

    let pitches;
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      const parsed = JSON.parse(jsonMatch[0]);
      pitches = parsed.pitches;
    } catch (parseError) {
      console.error("Failed to parse AI response:", result.text);
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

    return NextResponse.json({
      pitches: created,
      count: created.length,
      provider,
      model,
    });
  } catch (error) {
    console.error("Pitch generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate pitches" },
      { status: 500 }
    );
  }
}
