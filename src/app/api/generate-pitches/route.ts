import { NextResponse } from "next/server";
import { generateText } from "@/lib/ai";
import { prisma } from "@/lib/db";
import { fetchAllNewsSources } from "@/lib/news-sources";

const SYSTEM_PROMPT = `You are the lead content strategist for "From The Logo" — a YouTube channel about Caitlin Clark and the Indiana Fever, modeled after Hoop Reports (who built 500K+ subs covering Steph Curry/Warriors) and DKM Sports.

You generate pitches that are READY TO SCRIPT. Not surface-level headlines. Deep narratives.

=== ABSOLUTE FOCUS RULE (non-negotiable) ===

This is THE Caitlin Clark channel. Every single pitch must be ABOUT Caitlin Clark, not adjacent to her. The way Hoop Reports was THE Steph Curry channel — not "NBA stories that mention Curry," but CURRY stories.

**REQUIRED:**
- "Caitlin Clark" MUST appear in every title. No exceptions.
- The main character of every video is Caitlin Clark. She's the hero, the subject, the reason people clicked.
- Fever stories are allowed ONLY when Clark is the protagonist of that story (e.g. "How Caitlin Clark Turned Indiana Into A Championship Team")
- Teammate stories work ONLY through Clark's lens (e.g. "How Caitlin Clark SAVED Sophie Cunningham's Career")

**REJECT these angles (they fail the focus test):**
- ❌ Stories about other WNBA rookies, even if Clark is mentioned
- ❌ Boston/Sophie/Fever teammate stories where THEY are the main character
- ❌ General WNBA business/CBA stories
- ❌ Stories where Clark is a supporting reference, not the subject

**KEEP these angles (they pass):**
- ✅ "The Day Caitlin Clark [verb] [target]"
- ✅ "How Caitlin Clark [did something]"
- ✅ "Caitlin Clark's [thing]"
- ✅ "The Story Of Why [someone] [action about] Caitlin Clark"
- ✅ "This Is Why [bold claim] About Caitlin Clark"
- ✅ "The WNBA/[Person] Just [action] Caitlin Clark.. But It Backfired"

Model it after Hoop Reports' Curry videos — their top titles:
- "The Day Caitlin Clark Exposed USA Basketball" (2.4M)
- "The Day Caitlin Clark Showed Her WNBA Bully Who's Boss" (2.7M)
- "The WNBA Will Regret Losing Caitlin Clark" (1.9M)
- "How Caitlin Clark SAVED Lexie Hull's WNBA Career" (383K)

Every single title has CAITLIN CLARK's name. Non-negotiable.

=== TWO COLD OPEN STYLES — MIX BOTH ===

You have TWO proven cold open approaches. Each pitch should clearly be ONE or the OTHER. Aim for a 6:4 mix — 6 punchy FTL-style, 4 epic Hoop Reports-style.

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
      fetchAllNewsSources(),
      getAlreadyCoveredTopics(),
    ]);

    const prompt = `Generate 10 deeply researched video pitches for today.

${freshNews}

=== ALREADY COVERED — DO NOT REPEAT ===
These topics/angles have been used. Find COMPLETELY different stories:
${coveredTopics}

=== HOW TO USE THE SOURCES ===
- MAINSTREAM NEWS = basic facts, recent games, official announcements
- OUTLET DEEP COVERAGE = SI/BR/ClutchPoints longer narratives — goldmines for pitch ideas
- FAN COMMUNITY (Reddit) = highest upvoted posts show what fans are ACTUALLY outraged or excited about. This is the VIRAL pulse. WEIGHT THESE HEAVILY — they tell you the real storylines driving discussion.
- COMPETITOR VIDEOS = what other CC channels are covering. Don't copy their angles, but see what's RESONATING this week.

The Reddit posts especially will surface specific named villains, specific incidents, and viral moments that mainstream coverage misses. These are your best source for authentic storylines.

=== INSTRUCTIONS ===

1. Read all the sources. Look for patterns — what's being discussed across multiple platforms?
2. Identify 6 stories with the most narrative potential from the REDDIT + OUTLET sources (not just mainstream headlines). Look for named villains, specific incidents, viral moments.
3. For each of those 6, construct a full pitch with all 4 required elements (cold open type, named villain/trigger, concrete vindication, payoff stakes).
4. Generate 4 MORE pitches that are pure evergreen — career milestones, untold moments, specific past games that haven't been covered yet.
5. Every pitch MUST have a specific named villain with a specific quote or action. Use Reddit posts to find these — the most upvoted threads usually have the specific receipts.
6. Do NOT regurgitate the news headlines as titles. Transform them into narrative stories.
7. Do NOT suggest anything similar to the "already covered" list.

OUTPUT FORMAT — critical:
- Respond with ONLY a valid JSON object, nothing else
- No markdown code fences (no \`\`\`json or \`\`\`)
- No explanation before or after the JSON
- Structure: { "pitches": [ { ...pitch... }, { ...pitch... }, ... ] }
- Exactly 10 pitches in the array

All 10 pitches must have "Caitlin Clark" in the title. All 10 must pass the focus test and the 4-element test. If you can't generate 5 that pass, generate fewer — quality over quantity.`;

    const result = await generateText(prompt, SYSTEM_PROMPT);

    let pitches;
    let rawText = result.text;
    try {
      // Strip markdown code fences if present
      rawText = rawText.replace(/```(?:json)?\s*/g, "").replace(/```\s*$/g, "").trim();

      // Try to find the pitches array first (more reliable than matching whole object)
      const pitchesArrayMatch = rawText.match(/"pitches"\s*:\s*(\[[\s\S]*?\])\s*\}?\s*$/);
      if (pitchesArrayMatch) {
        // Try parsing just the array
        pitches = JSON.parse(pitchesArrayMatch[1]);
      } else {
        // Fallback: greedy match for the outermost {...}
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON found in response");
        const parsed = JSON.parse(jsonMatch[0]);
        pitches = parsed.pitches;
      }

      if (!Array.isArray(pitches) || pitches.length === 0) {
        throw new Error("No pitches in parsed response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response. Error:", parseError);
      console.error("Raw text:", rawText.slice(0, 2000));
      return NextResponse.json(
        {
          error: "Failed to parse AI response",
          details: parseError instanceof Error ? parseError.message : "Unknown",
          rawPreview: rawText.slice(0, 500),
        },
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
