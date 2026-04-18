import { NextResponse } from "next/server";
import { generateText } from "@/lib/ai";
import { prisma } from "@/lib/db";
import { fetchAllNewsSources } from "@/lib/news-sources";

const SYSTEM_PROMPT = `You are the lead content strategist for "From The Logo" — a YouTube channel about Caitlin Clark and the Indiana Fever.

Your approach is ADAPTATION, not invention. You take proven viral title frameworks from three reference channels (Hoop Reports, DKM, JxmyHighroller) and adapt them to current Caitlin Clark storylines.

=== THE METHODOLOGY ===

For each pitch:
1. PICK a proven high-performing title from the template library (you'll be given the library)
2. IDENTIFY a current story from the news sources that naturally fits that template's structure
3. ADAPT the title — swap in Caitlin Clark / Fever / WNBA characters and specifics
4. BUILD the pitch around that story with the same narrative DNA

Example:
- Template: "The Day Steph Curry Exposed the Rockets" (Hoop Reports, 600K views)
- Current news: "Caitlin Clark drops 40 on Connecticut Sun in OT win"
- Adapted title: "The Day Caitlin Clark Exposed the Connecticut Sun"
- Pitch: Story about the specific game, the doubters before, the 40-point response, what it proved

=== NON-NEGOTIABLE RULES ===

1. Title MUST include "Caitlin Clark" (or an opponent's name where Clark is the subject). This is THE Caitlin Clark channel.
2. Each pitch must cite BOTH:
   a) The specific template title it's adapted from (with channel + views)
   b) The specific current news story it's based on (with source)
3. The pitch must have a named villain with a specific quote or specific action.
4. The pitch must have a concrete vindication moment with stats or a specific play.
5. Do NOT generate pitches for topics already in the "already covered" list.

=== OUTPUT FORMAT ===

JSON only, no markdown, no explanation. Structure:
{
  "pitches": [
    {
      "title": "The adapted CC title (must include Caitlin Clark)",
      "templateTitle": "The original template title it was adapted from",
      "templateChannel": "hoop-reports | dkm | jxmy",
      "templateViews": 500000,
      "sourceNews": "The news story or fan discussion this is based on",
      "sourceChannel": "Reddit r/wnba | Sports Illustrated | etc",
      "format": "evergreen",
      "pitchType": "evergreen",
      "angle": "2-3 sentence explanation covering: the villain, the vindication moment, the stakes",
      "hookLine": "The first 2-3 sentences of the video — cold open style",
      "talkingPoints": ["4 talking points"],
      "performanceScore": 75
    }
  ]
}

Aim for 10 pitches. Each must adapt a DIFFERENT template. Prefer templates with the highest views.`;

async function getTemplateLibrary(): Promise<string> {
  // Get top-performing templates across all 3 channels
  // Prioritize Curry/Warriors content (most directly adaptable to CC) and high-view videos
  const templates = await prisma.titleTemplate.findMany({
    where: {
      views: { gt: 100000 }, // Only high-performing templates
    },
    orderBy: { views: "desc" },
    take: 80,
  });

  return templates
    .map((t) => `[${t.views.toLocaleString()} views][${t.channel}][${t.pattern}] "${t.title}"`)
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
    const [freshNews, coveredTopics, templates] = await Promise.all([
      fetchAllNewsSources(),
      getAlreadyCoveredTopics(),
      getTemplateLibrary(),
    ]);

    const prompt = `Generate 10 video pitches by ADAPTING proven viral titles to current Caitlin Clark / Fever / WNBA stories.

=== PROVEN TITLE TEMPLATES (your raw material — pick from these) ===
These are real titles from Hoop Reports, DKM, and JxmyHighroller with their view counts. Pick the ones that naturally adapt to a Caitlin Clark story. Each template shows [views][channel][pattern] "title".

${templates}

=== CURRENT STORIES (the news to adapt the templates to) ===
${freshNews}

=== HOW TO USE THE SOURCES (priority order) ===

1. **WNBA JOURNALISM VIDEOS (Mick Talks Hoops + Rachel DeMita)** — HIGHEST PRIORITY. Mick covers WNBA hourly. Rachel DeMita does deeper WNBA journalism. Each title is a live storyline. Look for TOPIC CLUSTERS — if 3+ Mick videos cover the same theme this week, that's a guaranteed hot story.

2. **TWITTER / X (@CClarkReport + @kenswift)** — Real-time reactions, breaking news, specific quotes and tweets. These often contain the exact viral moments and hater takes. When a tweet goes viral, it becomes a pitch.

3. **OUTLET DEEP COVERAGE (SI, ClutchPoints, Athlon Sports)** — Longer narrative pieces with named characters. Goldmine for pitch angles.

4. **GENERAL MAINSTREAM NEWS (Google News)** — Basic facts, games, announcements. Thinnest source.

5. **COMPETITOR CC CHANNELS** — What Hoop Reports / BTS / From The Logo are covering. Don't copy, but use to see which angles are resonating.

**KEY CROSS-REFERENCE INSIGHT**: When (Mick OR Rachel) cover a topic AND (@CClarkReport OR @kenswift) tweet about it AND an outlet writes it up — that's a three-way confirmation. These stories get 2-5x more views than any single-source pitch.

=== ALREADY COVERED — DO NOT RECREATE ===
${coveredTopics}

=== YOUR TASK ===

For each of 10 pitches:

1. Pick a template from the library above. Aim to use templates with 500K+ views when possible. Vary the patterns across pitches.
2. Find a matching current story from the news sources (prioritize Reddit discussions and outlet coverage — those have the specific characters and incidents).
3. Adapt the template by swapping in Caitlin Clark / Fever / WNBA names and specifics.
4. The adapted title MUST include "Caitlin Clark" (or frame her as the subject).
5. Verify:
   - Is there a specific named villain with a quote or action?
   - Is there a concrete vindication moment with stats or a specific play?
   - Does this match a PROVEN viral framework?
6. Reject and pick a different template/story if any element is missing.

Vary the template patterns. Don't use 10 "The Day..." titles. Mix: "The Day", "This Is Why", "How [X] Became", "Why [X] Is Scared Of", "The Story Of Why", "[X] Times [Y] Did [Z]", etc.

Return ONLY the JSON object with 10 pitches. No markdown, no explanation.`;

    const result = await generateText(prompt, SYSTEM_PROMPT);

    let pitches;
    let rawText = result.text;
    try {
      rawText = rawText.replace(/```(?:json)?\s*/g, "").replace(/```\s*$/g, "").trim();
      const pitchesArrayMatch = rawText.match(/"pitches"\s*:\s*(\[[\s\S]*?\])\s*\}?\s*$/);
      if (pitchesArrayMatch) {
        pitches = JSON.parse(pitchesArrayMatch[1]);
      } else {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON found in response");
        const parsed = JSON.parse(jsonMatch[0]);
        pitches = parsed.pitches;
      }
      if (!Array.isArray(pitches) || pitches.length === 0) {
        throw new Error("No pitches in parsed response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.error("Raw:", rawText.slice(0, 2000));
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
          templateTitle?: string;
          templateChannel?: string;
          templateViews?: number;
          sourceNews?: string;
          sourceChannel?: string;
          format: string;
          pitchType?: string;
          angle: string;
          hookLine: string;
          talkingPoints: string[];
          performanceScore: number;
        }) => {
          // Embed template metadata into the angle so the user can see what it's based on
          const metadataPrefix = p.templateTitle
            ? `📐 Template: "${p.templateTitle}" (${p.templateChannel}, ${p.templateViews?.toLocaleString()} views)\n📰 Source: ${p.sourceNews || "N/A"} (${p.sourceChannel || "N/A"})\n\n`
            : "";
          return prisma.pitch.create({
            data: {
              title: p.title,
              format: "evergreen",
              pitchType: "evergreen",
              angle: metadataPrefix + p.angle,
              hookLine: p.hookLine,
              talkingPoints: p.talkingPoints,
              performanceScore: p.performanceScore || 0,
              status: "pending",
              aiProvider: provider,
              aiModel: model,
            },
          });
        }
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
