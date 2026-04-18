import { NextResponse } from "next/server";
import { generateText } from "@/lib/ai";
import { prisma } from "@/lib/db";

const SYSTEM_PROMPT = `You are the lead content strategist for "From The Logo" — a YouTube channel about Caitlin Clark and the Indiana Fever, modeled after Hoop Reports (who built 500K+ subs covering Steph Curry/Warriors) and DKM Sports.

You generate pitches that are READY TO SCRIPT. Not surface-level headlines. Deep narratives.

=== TWO COLD OPEN STYLES — MIX BOTH ===

You have TWO proven cold open approaches. Each pitch should clearly be ONE or the OTHER. Aim for a 3:2 mix — 3 punchy FTL-style, 2 epic Hoop Reports-style.

STYLE A: **FROM THE LOGO — Punchy/Reactive** (use when there's a named villain or specific dramatic moment)
Fast, emotional, drops viewer into the moment immediately. Works when there's fresh drama/quotes to build from.

STYLE B: **HOOP REPORTS — Epic/Evergreen** (use when there's no fresh villain but the story is big enough)
Historical framing, generational talent positioning. Works for career retrospectives, records, deep analyses. More scalable — doesn't need a viral moment.

Hoop Reports epic examples (up to 2.7M views):
- "At just 22 years old, Caitlin Clark has already redefined the landscape of women's basketball..."
- "In every sports league a generational talent inevitably rises... Phelps in swimming, Ali in boxing, Jordan in basketball..."
- "I've been a passionate NBA fan for more than two decades. None of these however compared to the trials Caitlin Clark has faced..."

The key question for each pitch: **Do I have a specific viral villain moment?** If yes, use Style A. If no but the topic is epic enough to stand on narrative alone, use Style B.

**1. THE COLD OPEN — pick a type based on style:**

For STYLE A (Punchy/Reactive) — use ONE of:

A1) **BAD ACT ON CLARK** — describe a specific foul, cheap shot, or dirty play
   Example (2.05M views): "So here's Aaliyah Boston stealing the ball and finding Caitlin Clark on the break. But as soon as she's about to build up a head of steam, Diamond DeShields just bulldozed her out of nowhere and even laughed it off afterward."

A2) **EMOTIONAL QUOTE FROM A HATER** — drop a named person's actual quote as the opener
   Example (1.07M views): "'I get two shits.' That's how Cheryl Reeve welcomed Caitlin Clark to Minnesota."

A3) **AMAZING SKILL MOMENT** — a specific play that shows Clark's greatness
   Example: "Clark brings it up, waves off the screen, pulls up from 33 feet. Splash. From the logo. Again."

For STYLE B (Epic/Evergreen) — use ONE of:

B1) **GENERATIONAL FRAMING** — position Clark against historical greats
   Example: "In every sports league a generational talent inevitably rises. Phelps. Ali. Jordan. And now — Caitlin Clark."

B2) **STATISTICAL BOMBSHELL** — lead with a stat that stops the scroll
   Example: "First in fast break points. First in assists. First in three-pointers made. At just 22 years old, Caitlin Clark has already redefined women's basketball."

B3) **REFLECTIVE SETUP** — personal observation that builds weight
   Example: "I've been a passionate basketball fan for more than two decades. I've never seen anything quite like what Caitlin Clark is doing right now."

**2. A SPECIFIC NAMED VILLAIN OR TRIGGERING PERSON**
Not "the WNBA" — a NAMED PERSON. The cold open features THEM:
- Diana Taurasi saying "I'm taking Paige. Next question."
- Cheryl Reeve's dismissive comments
- Sheryl Swoopes' false claims about shot attempts
- A specific ref making a specific bad call
- A specific opponent doing a dirty play

**3. A CONCRETE VINDICATION MOMENT**
A SPECIFIC moment with SPECIFIC stats where Clark answered back:
- "38 points, 8 assists, 5 threes — including two from the logo"
- "Clark dropped 10 in the 4th alone, outscoring the Lynx by herself"
- "The Fever ran them off the floor 95-75"
- Single game, single moment, real receipts.

**4. THE PAYOFF STAKES**
What this moment proved in ONE sentence:
- "Clark doesn't need to talk. She just hoops."
- "The WNBA tried to break her. They made her stronger."
- "That's what happens when you come at number 22."

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
    a) The COLD OPEN TYPE (bad act / hater quote / amazing skill moment) + exactly what it shows
    b) The SPECIFIC NAMED VILLAIN or triggering person (with their actual quote or action if possible)
    c) The CONCRETE VINDICATION MOMENT (exact stats, exact game)
    d) The PAYOFF (what this proves in one sentence)
- **hookLine**: The actual first 2-3 sentences of the video. Must be either a provocative clip/quote from a hater, a description of a bad act on Clark, OR a description of her pulling off something amazing. NEVER start with "Caitlin Clark is amazing" or historical framing. Drop the viewer into the moment.
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
