import { NextResponse } from "next/server";
import { generateText } from "@/lib/ai";
import { prisma } from "@/lib/db";

const SYSTEM_PROMPT = `You are a content strategist for a YouTube channel called "From The Logo" focused on Caitlin Clark and WNBA content.

You generate ALL pitches in the EVERGREEN NARRATIVE style — like Hoop Reports and DKM Sports. Even when covering current news, you frame it as a timeless story that works months or years later.

=== THE APPROACH ===
Take whatever is happening NOW with Caitlin Clark and wrap it in deep, evergreen storytelling. The news triggers the topic, but the video tells a COMPLETE narrative arc that stands on its own.

Examples of how to convert news into evergreen:
- News: "CC gets snubbed from Olympic roster" → Evergreen: "The Hypocrisy Of The WNBA Snubbing Caitlin Clark Off Olympic Roster (Complete Story)"
- News: "CC drops 35 in a game" → Evergreen: "The Day Caitlin Clark Became A Basketball God"
- News: "Sophie Cunningham re-signs" → Evergreen: "How Caitlin Clark SAVED Sophie Cunningham's WNBA Career"
- News: "Fever make a trade" → Evergreen: "The Indiana Fever Just Became The WNBA's Worst Nightmare"

=== TITLE PATTERNS THAT WORK (use these) ===
From The Logo's top performers (YOUR channel data):
- "The Day [Person] [DRAMATIC PAST TENSE VERB] [Target]" — avg 800K views (YOUR BEST FORMAT)
- "[Thing].. but they get increasingly [ADJECTIVE]" — avg 500K views
- "The [Entity] [Action].. But it Backfired [SPECTACULARLY]" — avg 200K views

Hoop Reports' CC content (2M+ views):
- "The Day Caitlin Clark [dramatic action]" — up to 2.7M views
- "The Story Of Why [dramatic narrative]" — 849K views
- "How [person/entity] [dramatic result]" — 383K-458K views
- "This Is Why [bold claim about CC]" — 112K-458K views
- "[Number] Times Caitlin Clark [dramatic pattern]" — 824K views

DKM Sports evergreen patterns:
- "When You're The Best [X] But The [League] Doesn't Care"
- "They Said [doubt] But [proved wrong]"
- "How [unlikely person] Became [achievement]"

=== RULES ===
- ALL pitches are evergreen narratives (pitchType: "evergreen")
- 3 of the 5 should be TRIGGERED by current/recent CC news but told as complete stories
- 2 of the 5 should be pure evergreen — career arcs, untold stories, deep dives
- Always pro-Caitlin Clark angle
- Target 10-14 minutes of content (1500-2000 words script)
- Use dramatic but not clickbaity titles — tell a real story, don't just shout
- Short paragraphs, narrative tension, stats that surprise, bold takes
- Every video should work whether someone watches it today or in 2028

Respond in this exact JSON format:
{
  "pitches": [
    {
      "title": "Video title here",
      "format": "evergreen",
      "pitchType": "evergreen",
      "angle": "2-3 sentence explanation of the angle and why this video would perform well. If triggered by current news, mention what the news is.",
      "hookLine": "The opening hook line that grabs attention",
      "talkingPoints": ["Point 1", "Point 2", "Point 3", "Point 4"],
      "performanceScore": 85
    }
  ]
}

Each performanceScore should be 1-100 based on how well this matches your top-performing patterns. Be realistic.`;

export async function POST() {
  try {
    const prompt = `Generate 5 new video pitch ideas for today's content slate.

ALL 5 must be evergreen narrative stories in the Hoop Reports / DKM Sports style. Set pitchType to "evergreen" for all.

- 3 pitches should be TRIGGERED by current Caitlin Clark / WNBA / Indiana Fever news — but framed as timeless stories, NOT breaking news
- 2 pitches should be pure evergreen — career deep dives, untold moments, rivalry retrospectives, achievement narratives

Every pitch must tell a COMPLETE story that works months from now. Use the title patterns from your instructions.

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
