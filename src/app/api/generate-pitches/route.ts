import { NextResponse } from "next/server";
import { generateText } from "@/lib/ai";
import { prisma } from "@/lib/db";

const SYSTEM_PROMPT = `You are the lead content strategist for "From The Logo" — a YouTube channel about Caitlin Clark and the Indiana Fever, modeled after Hoop Reports (who built 500K+ subs covering Steph Curry/Warriors) and DKM Sports.

You generate pitches that are READY TO SCRIPT. Not surface-level headlines. Deep narratives.

=== THE HOOP REPORTS DNA (every pitch MUST have these 4 elements) ===

A successful Hoop Reports-style video has FOUR non-negotiable elements. If you can't fill all four, the pitch is weak and should be rejected.

**1. EPIC FRAMING** — Place Caitlin Clark in historical/cultural context
Examples from actual Hoop Reports 2M+ view videos:
- "I've been a passionate NBA fan for more than two decades... none of these however compared to the trials Caitlin Clark has faced..."
- "In every Sports League a generational talent inevitably rises... for women's MMA Ronda Rousey took the mantle, Serena Williams dominated tennis... in the NBA's darkest days it was Bird and Magic..."
- Frame Clark's story against Phelps, Ali, Jordan, Ruth. She's not just a basketball player — she's a generational shift.

**2. A SPECIFIC NAMED VILLAIN WITH A SPECIFIC QUOTE**
Not "the WNBA" — a NAMED PERSON who said/did something.
Real examples that worked:
- Diana Taurasi saying "I'm taking Paige. Next question." on live TV before the Clark matchup
- Cheryl Reeve saying "I get two shits" about home crowd cheering for Clark
- Sheryl Swoopes claiming "Caitlin takes 40 shots a game" (factually wrong — 20)
- Specific WNBA refs making specific calls on specific dates

The villain + quote is the KEY. Without it, there's no tension.

**3. A CONCRETE VINDICATION MOMENT**
Not "Clark played well" — a SPECIFIC moment with SPECIFIC stats.
- "Clark dropped 10 points in the 4th quarter alone, nearly outscoring the entire Lynx team by herself"
- "38 points, 8 assists, 5 threes — including two from the logo"
- "She broke the record in 126 games; Kelsey Plum needed 139"
- The vindication must be a SINGLE MOMENT or SINGLE GAME with receipts

**4. STAKES THAT MATTER BEYOND THE GAME**
Why does this moment matter for something bigger?
- "This moment proved the WNBA snub was about ego, not basketball"
- "The day every other WNBA player had to accept Clark was the face of the league"
- "The moment the Fever became a championship team, not a rebuild"
- The video must prove/disprove something about legacy, respect, or the sport itself

=== TITLE PATTERNS (USE THESE EXACTLY) ===

From The Logo's top performers (YOUR channel data):
- "The Day [Person] [DRAMATIC PAST TENSE VERB] [Target]" — avg 800K views
- "[Thing].. but they get increasingly [ADJECTIVE]" — avg 500K views
- "The [Entity] [Action].. But it Backfired [SPECTACULARLY]" — avg 200K views

Hoop Reports CC titles (up to 2.7M views):
- "The Day Caitlin Clark [Showed Her Bully Who's Boss / Exposed USA Basketball / etc.]"
- "The WNBA Will Regret [Losing/Doing Something To] Caitlin Clark"
- "How Caitlin Clark SAVED [Person/Team]"
- "The Story Of Why [Entity] Is Attacking Caitlin Clark"
- "This Is How Caitlin Clark Is Saving The WNBA From [Something]"
- "[Number] Times Caitlin Clark Proved Her Haters Wrong"

=== REQUIRED OUTPUT PER PITCH ===

Each pitch must include:
- **title**: Dramatic, narrative-driven, using proven patterns above
- **format**: "evergreen"
- **pitchType**: "evergreen"
- **angle**: Must explicitly identify:
    a) The EPIC FRAMING (what historical context does this fit into?)
    b) The SPECIFIC VILLAIN + their specific quote or action (with date if possible)
    c) The SPECIFIC VINDICATION MOMENT (exact stats, exact game)
    d) The BIGGER STAKES (what does this prove?)
- **hookLine**: First 1-2 sentences of the video. Must drop viewer into the story (not "Caitlin Clark is amazing" — start with the villain's quote or a specific moment)
- **talkingPoints**: 4 bullets, each a CHAPTER of the video (who's the villain, what they did, how Clark responded, what it means)
- **performanceScore**: 1-100 based on how well this matches top-performing patterns

Respond in this exact JSON format:
{ "pitches": [{...}, {...}, {...}, {...}, {...}] }

CRITICAL: If you can't identify a specific named villain with a specific quote for a pitch, DON'T generate that pitch. Go deeper. Find a real story with real characters.`;

async function fetchFreshNews(): Promise<string> {
  const sources = [
    "https://news.google.com/rss/search?q=%22caitlin+clark%22&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=%22indiana+fever%22&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=wnba+drama+OR+controversy&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=caitlin+clark+angel+reese+OR+sophie+cunningham&hl=en-US&gl=US&ceid=US:en",
  ];

  const headlines: Array<{ title: string; source: string; date: string }> = [];
  const seen = new Set<string>();

  for (const url of sources) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (!res.ok) continue;
      const xml = await res.text();

      // Parse <item> blocks
      const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
      for (const item of items.slice(0, 20)) {
        const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/);
        const sourceMatch = item.match(/<source[^>]*>([^<]+)<\/source>/);
        const dateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);

        const title = titleMatch?.[1]?.trim() || "";
        if (!title || seen.has(title) || title.length < 15) continue;
        seen.add(title);

        headlines.push({
          title,
          source: sourceMatch?.[1]?.trim() || "Unknown",
          date: dateMatch?.[1]?.trim() || "",
        });
      }
    } catch {
      /* continue */
    }
  }

  if (headlines.length === 0) {
    return "No fresh news could be fetched. Generate pitches based on evergreen Caitlin Clark storylines and career moments.";
  }

  // Format as a numbered list with sources
  return headlines
    .slice(0, 25)
    .map((h, i) => `${i + 1}. "${h.title}" — ${h.source}${h.date ? ` (${h.date.slice(0, 16)})` : ""}`)
    .join("\n");
}

async function getAlreadyCoveredTopics(): Promise<string> {
  const channelVideos = await prisma.channelStat.findMany({
    select: { title: true },
    orderBy: { views: "desc" },
  });

  const pastPitches = await prisma.pitch.findMany({
    select: { title: true, status: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const covered = channelVideos.map((v) => `- ${v.title} [PUBLISHED]`);
  const pitched = pastPitches.map((p) => `- ${p.title} [${p.status.toUpperCase()}]`);

  return [...covered, ...pitched].join("\n");
}

export async function POST() {
  try {
    const [freshNews, coveredTopics] = await Promise.all([
      fetchFreshNews(),
      getAlreadyCoveredTopics(),
    ]);

    const prompt = `Generate 5 deeply researched video pitches for today.

=== FRESH NEWS SOURCES (today's headlines) ===
${freshNews}

=== ALREADY COVERED — DO NOT REPEAT ===
These topics/angles have been used. Find COMPLETELY different stories:
${coveredTopics}

=== INSTRUCTIONS ===

1. Read the fresh news carefully. Identify the 3 stories with the most narrative potential — where there's a named villain, a specific moment, and stakes.
2. For each of those 3 stories, construct a full Hoop Reports-style pitch with all 4 required elements (epic framing, named villain + quote, concrete vindication, bigger stakes).
3. Generate 2 MORE pitches that are pure evergreen — career milestones, untold moments, specific games that haven't been covered yet. These should also have all 4 elements.
4. Every pitch MUST have a specific named villain with a specific quote or action. If you can't find one, skip that pitch and find a different angle.
5. Do NOT regurgitate the news headlines as titles. Transform them into narrative stories.
6. Do NOT suggest anything similar to the "already covered" list.

Return ONLY the JSON object. No other text. All 5 pitches must pass the 4-element test or don't include them.`;

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
        { error: "Failed to parse AI response", raw: result.text.slice(0, 500) },
        { status: 500 }
      );
    }

    const provider = process.env.AI_PROVIDER || "anthropic";
    const model = process.env.AI_MODEL || "claude-opus-4-7";

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
              format: "evergreen",
              pitchType: "evergreen",
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
      newsHeadlinesUsed: !freshNews.includes("No fresh news"),
    });
  } catch (error) {
    console.error("Pitch generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate pitches" },
      { status: 500 }
    );
  }
}
