import { NextResponse } from "next/server";
import { generateText } from "@/lib/ai";

const SYSTEM_PROMPT = `You are a content strategist for a YouTube channel called "From The Logo" focused on Caitlin Clark and WNBA content.

You know the channel's top-performing title patterns and their average views:
- "The Day [Subject] [DRAMATIC VERB] [Object]" format — avg 800K views (best performer)
- "[Subject].. but they get increasingly [ADJECTIVE]" format — avg 500K views
- "[Entity] [Action]... But It Backfired SPECTACULARLY" format — avg 200K views

Content pillars: Caitlin Clark game breakdowns, WNBA controversies, player rivalries, skill highlights, career stories.

Title patterns that work:
- ALL CAPS for 2-3 emphasis words
- Dramatic verbs: DEMOLISHED, SILENCED, EXPOSED, HUMBLED, DESTROYED
- Curiosity gaps and bold claims

Generate exactly 3 pitch ideas, each in a DIFFERENT format (one the-day, one increasingly, one backfired).

Respond in this exact JSON format:
{
  "pitches": [
    {
      "title": "Video title here",
      "format": "the-day",
      "angle": "2-3 sentence explanation of the angle and why this video would perform well",
      "hookLine": "The opening hook line that grabs attention",
      "talkingPoints": ["Point 1", "Point 2", "Point 3", "Point 4"],
      "performanceScore": 85
    }
  ]
}

Each performanceScore should be 1-100 based on how likely the video is to perform well given the channel's history. Be realistic — not everything is a 90+.`;

export async function POST() {
  try {
    const prompt = `Generate 3 new video pitch ideas for today. Consider current WNBA storylines, trending topics around Caitlin Clark, and what formats have performed best historically.

Each pitch should be for a different format:
1. One "The Day..." format (historically avg 800K views)
2. One "...but they get increasingly..." format (historically avg 500K views)
3. One "...But It Backfired" format (historically avg 200K views)

Make the ideas timely, specific, and compelling. Include real-sounding scenarios that could be current WNBA storylines.

Return ONLY the JSON object, no other text.`;

    const result = await generateText(prompt, SYSTEM_PROMPT);

    // Parse the JSON from the AI response
    let pitches;
    try {
      // Try to extract JSON from the response (AI might wrap it in markdown)
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

    return NextResponse.json({
      pitches,
      provider: process.env.AI_PROVIDER || "anthropic",
      model: process.env.AI_MODEL || "claude-sonnet-4-20250514",
    });
  } catch (error) {
    console.error("Pitch generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate pitches" },
      { status: 500 }
    );
  }
}
