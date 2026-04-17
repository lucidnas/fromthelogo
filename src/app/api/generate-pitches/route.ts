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

DKM Sports evergreen patterns:
- "When You're The Best [X] But The [League] Doesn't Care"
- "They Said [doubt] But [proved wrong]"
- "How [unlikely person] Became [achievement]"

=== RULES ===
- ALL pitches are evergreen narratives (pitchType: "evergreen")
- 3 of the 5 should be based on the FRESH NEWS provided below — framed as timeless stories
- 2 of the 5 should be pure evergreen — career arcs, untold stories, deep dives
- Always pro-Caitlin Clark angle
- Target 7-8 minutes of content (1000-1200 words script)
- Use dramatic but not clickbaity titles — tell a real story
- NEVER suggest a topic that's already been covered (see the DO NOT REPEAT list below)

Respond in this exact JSON format:
{
  "pitches": [
    {
      "title": "Video title here",
      "format": "evergreen",
      "pitchType": "evergreen",
      "angle": "2-3 sentence explanation. If triggered by news, mention what the news is and link it to the narrative.",
      "hookLine": "The opening hook line that grabs attention",
      "talkingPoints": ["Point 1", "Point 2", "Point 3", "Point 4"],
      "performanceScore": 85
    }
  ]
}

Each performanceScore should be 1-100 based on how well this matches top-performing patterns. Be realistic.`;

async function fetchFreshNews(): Promise<string> {
  try {
    // Use Anthropic's web search capability via a quick AI call
    // Or fall back to a simple search
    const searchQueries = [
      "Caitlin Clark latest news today",
      "Indiana Fever WNBA news",
      "Caitlin Clark highlights recent",
    ];

    // Try fetching from Google News RSS
    const urls = [
      "https://news.google.com/rss/search?q=caitlin+clark+wnba&hl=en-US&gl=US&ceid=US:en",
      "https://news.google.com/rss/search?q=indiana+fever&hl=en-US&gl=US&ceid=US:en",
    ];

    const headlines: string[] = [];

    for (const url of urls) {
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(5000),
          headers: { "User-Agent": "Mozilla/5.0" }
        });
        if (res.ok) {
          const xml = await res.text();
          // Extract titles from RSS XML
          const titleMatches = xml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/g)
            || xml.match(/<title>(.*?)<\/title>/g)
            || [];
          for (const match of titleMatches.slice(0, 10)) {
            const title = match.replace(/<\/?title>/g, "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
            if (title && !title.includes("Google News") && title.length > 10) {
              headlines.push(title);
            }
          }
        }
      } catch {
        // RSS fetch failed, continue
      }
    }

    if (headlines.length > 0) {
      return headlines.slice(0, 15).join("\n");
    }

    return "No fresh news could be fetched. Generate pitches based on recent WNBA offseason storylines, upcoming season narratives, and Caitlin Clark career milestones.";
  } catch {
    return "No fresh news could be fetched. Generate pitches based on recent WNBA storylines.";
  }
}

async function getAlreadyCoveredTopics(): Promise<string> {
  // Get all existing channel videos
  const channelVideos = await prisma.channelStat.findMany({
    select: { title: true },
    orderBy: { views: "desc" },
  });

  // Get all previously generated pitches
  const pastPitches = await prisma.pitch.findMany({
    select: { title: true, status: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const coveredTitles = channelVideos.map(v => `- ${v.title} (PUBLISHED)`);
  const pitchTitles = pastPitches.map(p => `- ${p.title} (${p.status})`);

  return [...coveredTitles, ...pitchTitles].join("\n");
}

export async function POST() {
  try {
    // Fetch fresh news and already covered topics in parallel
    const [freshNews, coveredTopics] = await Promise.all([
      fetchFreshNews(),
      getAlreadyCoveredTopics(),
    ]);

    const prompt = `Generate 5 new video pitch ideas for today's content slate.

=== FRESH NEWS (use these as triggers for 3 of the 5 pitches) ===
${freshNews}

=== DO NOT REPEAT — ALREADY COVERED TOPICS ===
These videos have ALREADY been made or pitched. Do NOT suggest anything similar to these:
${coveredTopics}

=== INSTRUCTIONS ===
ALL 5 must be evergreen narrative stories in the Hoop Reports / DKM Sports style. Set pitchType to "evergreen" for all.

- 3 pitches MUST be triggered by the FRESH NEWS above — pick the most interesting/viral stories and frame them as timeless narratives
- 2 pitches should be pure evergreen — career deep dives, untold moments, rivalry retrospectives that have NOT been covered yet
- Do NOT rehash any topic from the "already covered" list above — find NEW angles, NEW stories, NEW moments
- If a topic has been covered before, find a completely different angle or skip it entirely

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
              format: p.format || p.pitchType || "evergreen",
              pitchType: p.pitchType || p.format || "evergreen",
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
      newsFound: !freshNews.includes("No fresh news"),
    });
  } catch (error) {
    console.error("Pitch generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate pitches" },
      { status: 500 }
    );
  }
}
