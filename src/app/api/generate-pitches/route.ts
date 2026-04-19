import { NextResponse } from "next/server";
import { callGeminiWithTools } from "@/lib/ai";
import { prisma } from "@/lib/db";
import { fetchAllNewsSources } from "@/lib/news-sources";
import type { ResearchSummaryShape } from "@/lib/research";

const SYSTEM_PROMPT = `You are the lead content strategist for "From The Logo" — a faceless YouTube channel focused on Caitlin Clark and the Indiana Fever.

POSITIONING (one line): FTL is the faceless version of Rachel DeMita — same beat (Caitlin Clark, Indiana Fever, plus bigger NBA/WNBA stories that intersect with Clark), same editorial sensibility, delivered through narrative voiceover + visuals instead of on-camera presentation. Pitches should feel like something Rachel would cover, just in FTL's faceless format.

Your approach is ADAPTATION, not invention. You take proven viral title frameworks — primarily from Hoop Reports and JxmyHighroller (DKM is a secondary reference) — and adapt them to current Caitlin Clark storylines. Rachel DeMita's own titles lean into that same Hoop-Reports/Jxmy aesthetic, so when her videos show up in the research block, treat her titles as additional aligned examples of the style you're matching.

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
      "sourceNews": "The news story this is based on (include view count if YouTube)",
      "sourceChannel": "Mick Talks Hoops | Rachel DeMita | Athlon Sports",
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
  // Balanced sample: top 30 from each channel so no single channel dominates.
  // Taking top by views ensures we get proven viral formulas.
  const [hoopReports, dkm, jxmy] = await Promise.all([
    prisma.titleTemplate.findMany({
      where: { channel: "hoop-reports", views: { gt: 100000 } },
      orderBy: { views: "desc" },
      take: 30,
    }),
    prisma.titleTemplate.findMany({
      where: { channel: "dkm", views: { gt: 100000 } },
      orderBy: { views: "desc" },
      take: 30,
    }),
    prisma.titleTemplate.findMany({
      where: { channel: "jxmy", views: { gt: 100000 } },
      orderBy: { views: "desc" },
      take: 30,
    }),
  ]);

  // Interleave so the AI sees diverse channels early in the list
  const maxLen = Math.max(hoopReports.length, dkm.length, jxmy.length);
  const interleaved: typeof hoopReports = [];
  for (let i = 0; i < maxLen; i++) {
    if (hoopReports[i]) interleaved.push(hoopReports[i]);
    if (dkm[i]) interleaved.push(dkm[i]);
    if (jxmy[i]) interleaved.push(jxmy[i]);
  }

  return interleaved
    .map((t) => `[${t.views.toLocaleString()} views][${t.channel}][${t.pattern}] "${t.title}"`)
    .join("\n");
}

async function getFTLTopPerformers(): Promise<string> {
  const rows = await prisma.channelStat.findMany({
    where: { views: { gt: 50_000 } },
    orderBy: { views: "desc" },
    take: 30,
  });
  if (rows.length === 0) return "";
  return rows
    .map((r) => `[${r.views.toLocaleString()} views][from-the-logo] "${r.title}"`)
    .join("\n");
}

async function getResearchBlock(urls: string[]): Promise<string> {
  if (urls.length === 0) return "";
  const rows = await prisma.researchSummary.findMany({
    where: { url: { in: urls } },
    orderBy: { fetchedAt: "desc" },
  });
  if (rows.length === 0) return "";

  return rows
    .map((r, i) => {
      const s = r.summary as unknown as ResearchSummaryShape;
      const views = r.viewCount ? ` (${r.viewCount.toLocaleString()} views)` : "";
      const bullets = [
        `Angle: ${s.angle}`,
        s.villain ? `Villain: ${s.villain}` : null,
        s.keyMoments?.length ? `Key moments:\n${s.keyMoments.map((m) => `  - ${m}`).join("\n")}` : null,
        s.quotes?.length ? `Quotes:\n${s.quotes.map((q) => `  - ${q}`).join("\n")}` : null,
        s.stats?.length ? `Stats:\n${s.stats.map((st) => `  - ${st}`).join("\n")}` : null,
        s.whyItResonated ? `Why it resonated: ${s.whyItResonated}` : null,
      ]
        .filter(Boolean)
        .join("\n");
      return `${i + 1}. "${r.title}" — ${r.source}${views}\n   URL: ${r.url}\n${bullets
        .split("\n")
        .map((l) => `   ${l}`)
        .join("\n")}`;
    })
    .join("\n\n");
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

export async function POST(request: Request) {
  try {
    let researchUrls: string[] = [];
    try {
      const body = await request.json();
      if (Array.isArray(body?.researchUrls)) researchUrls = body.researchUrls;
    } catch {
      // no body — default behavior (fresh news)
    }
    const useResearch = researchUrls.length > 0;

    const [freshNews, researchBlock, coveredTopics, templates, ftlTop] =
      await Promise.all([
        useResearch ? Promise.resolve("") : fetchAllNewsSources(),
        useResearch ? getResearchBlock(researchUrls) : Promise.resolve(""),
        getAlreadyCoveredTopics(),
        getTemplateLibrary(),
        getFTLTopPerformers(),
      ]);

    const storiesBlock = useResearch
      ? `=== RESEARCHED STORIES (Gemini-extracted summaries — your PRIMARY material) ===
Each item includes the angle, named villain, specific quotes, stats, and why it resonated. Use the concrete specifics (named people, exact quotes, numbers) in your pitches — not vague paraphrase.

${researchBlock}`
      : `=== CURRENT STORIES (the news to adapt the templates to) ===
${freshNews}`;

    const ftlBlock = ftlTop
      ? `

=== FROM THE LOGO — OWN TOP PERFORMERS (voice reference) ===
Your channel's own best-performing titles. Use for cadence and vocabulary — but the NORTH STAR for title style is Hoop Reports + JxmyHighroller (from the templates above). Rachel DeMita's titles in the research block already lean into that same Hoop-Reports/Jxmy aesthetic — treat her as an aligned reference, not a separate voice.

${ftlTop}`
      : "";

    const prompt = `Generate 10 video pitches by ADAPTING proven viral titles to current Caitlin Clark / Fever / WNBA stories.

=== PROVEN TITLE TEMPLATES (your raw material — pick from these) ===
These are real titles from Hoop Reports, DKM, and JxmyHighroller with their view counts. Pick the ones that naturally adapt to a Caitlin Clark story. Each template shows [views][channel][pattern] "title".

${templates}${ftlBlock}

${storiesBlock}

=== HOW TO USE THE SOURCES ===

1. **WNBA YOUTUBE COVERAGE (primary)** — Every item is already sorted by view count. HIGH VIEWS = PROVEN AUDIENCE DEMAND for that story. If Mick dropped a video on a topic and it has 100K+ views in 3 days, viewers are hungry for more angles on it. Cluster topics: if 3+ videos across the channels cover the same storyline, that's a guaranteed hot story and a strong pitch candidate.

**BEAT FOCUS (FTL's lane):** Caitlin Clark + Indiana Fever is the primary beat. Pitches should be anchored there. Bigger NBA or WNBA stories are fair game ONLY when they intersect with Clark/Fever (e.g. a league-wide narrative where Clark is a central figure, or a comparison/contrast that illuminates her). Pure NBA-without-Clark angles or pure WNBA-without-Clark angles should be rare and only make it in if the audience overlap is clear.

2. **ATHLON SPORTS (secondary)** — Longer outlet pieces with named characters and quotes. Use to add narrative depth and specific villain quotes to a pitch you've already picked from YouTube demand.

**KEY CROSS-REFERENCE INSIGHT**: When YouTube coverage of a topic is racking up views AND Athlon has written a piece on it — that's two-way confirmation the story has both audience demand and narrative meat. Those are your strongest pitches.

=== ALREADY COVERED — HARD RULE: DO NOT SUGGEST ANYTHING SIMILAR ===
These titles have been PUBLISHED, ACCEPTED, REJECTED, or PENDING. Do not propose pitches that:
- Cover the same incident or storyline
- Feature the same villain doing the same thing
- Use a similar "angle" even with a different title framing
- Recycle an existing rejected idea with a tweak

If your candidate pitch touches any topic in this list, DISCARD IT and find a new story.

${coveredTopics}

=== YOUR TASK ===

=== THE NARRATIVE LOGIC TEST (MOST IMPORTANT STEP) ===

Every template tells a specific KIND of story. Before picking a template, identify WHAT STORY it tells. Then check if your current news fits THAT story type.

Examples of template narrative logic:

- "The Day Steph Curry Exposed [X]" → Story type: "Hero delivers on-court revenge against a specific opponent who doubted/disrespected them."
  ✅ Fits: "The Day Caitlin Clark Exposed Diana Taurasi" (Taurasi publicly doubted her → Clark dropped 40 on Phoenix)
  ❌ Doesn't fit: "The Day Caitlin Clark Exposed the WNBA Draft Lottery" (lottery isn't a villain)

- "When You're The Best [X] But The [League] Doesn't Care" → Story type: "Elite player being under-recognized/under-paid despite dominance."
  ✅ Fits: "When You're The Best Rookie Ever But The WNBA Pays You Less Than The New Rookie" (if Azzi Fudd gets paid more)
  ❌ Doesn't fit: Any story where Clark IS being celebrated

- "The Odds of [X happening] Are 1 in [huge number]" → Story type: "Mathematical improbability — a player defying the odds to become great."
  ✅ Fits: "The Odds of Caitlin Clark Leading the WNBA in Assists as a Rookie" (actual improbable achievement)
  ❌ Doesn't fit: "The Odds of Caitlin Clark Drafting Raven Johnson" (she didn't draft anyone, and picking 10th isn't improbable)

- "This Is What Happens If You TRASH TALK [Hero]" → Story type: "Specific opponent trash talked, got punished with on-court domination."
  ✅ Fits: Any opponent who said something dismissive before losing to Clark
  ❌ Doesn't fit: Any story without a specific trash-talk incident

**BEFORE writing each pitch, state the template's narrative logic and verify your current story matches. If it doesn't match PERFECTLY, reject and find a different template or different story.**

=== STEPS FOR EACH OF 10 PITCHES ===

1. Pick a template. **Balance: at least 3 Hoop Reports, 2 DKM, 2 JxmyHighroller.**
2. IDENTIFY the template's narrative logic (what story does it really tell?).
3. Find a current story from the YouTube coverage (prioritize high-view items) or Athlon that has the SAME narrative logic. **At least 7 of 10 pitches must be anchored to a specific YouTube item with its view count cited as proof of demand.**
4. Check: does the news story's actual characters, events, and stakes match the template's story type? If it feels forced or aesthetic-only, reject.
5. Verify the 4 elements: specific named villain with quote/action, concrete vindication moment with stats, proven viral framework, not already covered.
6. The adapted title must include "Caitlin Clark" or frame her as the subject.
7. Strict dedup: if similar to ANY accepted/rejected/pending pitch (same incident, villain, or angle), discard.

**Vary template patterns.** Do not use 10 "The Day..." titles. Mix narrative types.

Return ONLY the JSON object with 10 pitches. No markdown, no explanation.`;

    const pitchModel = process.env.PITCH_MODEL || "gemini-3.1-pro-preview";
    const result = await callGeminiWithTools(prompt, SYSTEM_PROMPT, pitchModel, {
      forceJson: true,
      maxOutputTokens: 32768,
    });

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

    const provider = "gemini";
    const model = pitchModel;

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
