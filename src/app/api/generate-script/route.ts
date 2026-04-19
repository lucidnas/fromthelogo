import { NextResponse } from "next/server";
import { callGeminiWithTools } from "@/lib/ai";
import { prisma } from "@/lib/db";
import type { ResearchSummaryShape } from "@/lib/research";

const DRIBUL_REFERENCE_URL =
  "https://dribul.com/news/wnba-supermax-era-wilson-boston-shatter-salary-records";

async function getFTLTopVideoUrls(limit = 3): Promise<string[]> {
  const rows = await prisma.channelStat.findMany({
    orderBy: { views: "desc" },
    take: limit,
  });
  return rows.map((r) => `https://youtube.com/watch?v=${r.youtubeId}`);
}

async function getResearchBriefForPitch(pitchTitle: string): Promise<string> {
  // Best-effort: pull recent research summaries whose title fuzzy-matches the pitch
  const rows = await prisma.researchSummary.findMany({
    orderBy: { fetchedAt: "desc" },
    take: 30,
  });
  const lowered = pitchTitle.toLowerCase();
  const keywords = lowered.split(/\s+/).filter((w) => w.length > 4);

  const relevant = rows
    .map((r) => {
      const matches = keywords.filter((k) => r.title.toLowerCase().includes(k)).length;
      return { row: r, matches };
    })
    .filter((x) => x.matches > 0)
    .sort((a, b) => b.matches - a.matches)
    .slice(0, 5);

  if (relevant.length === 0) return "";

  return relevant
    .map(({ row }) => {
      const s = row.summary as unknown as ResearchSummaryShape;
      const views = row.viewCount ? ` (${row.viewCount.toLocaleString()} views)` : "";
      return [
        `— "${row.title}" — ${row.source}${views}`,
        `  Angle: ${s.angle}`,
        s.villain ? `  Villain: ${s.villain}` : null,
        s.keyMoments?.length ? `  Key moments: ${s.keyMoments.slice(0, 3).join(" | ")}` : null,
        s.quotes?.length ? `  Quotes: ${s.quotes.slice(0, 3).join(" | ")}` : null,
        s.stats?.length ? `  Stats: ${s.stats.slice(0, 4).join(" | ")}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function buildSystemPrompt(ftlUrls: string[]): string {
  const ftlUrlList = ftlUrls.length
    ? ftlUrls.map((u, i) => `${i + 1}. ${u}`).join("\n")
    : "(no FTL top videos available yet — rely on the Dribul reference only)";

  return `You are the scriptwriter for "From The Logo" — a YouTube channel covering Caitlin Clark, the Indiana Fever, and the bigger NBA/WNBA stories that intersect with them. You are FTL's staff voice.

This is a SPOKEN VIDEO ESSAY, not a written article. The final output is a voiceover someone will read aloud. Sound like a basketball-obsessed friend telling you the story — composed enough to carry weight, loose enough to sound human.

=== VOICE — MESH TWO REFERENCES (use url_context to read both) ===

1. DRIBUL BASELINE — editorial composure, confident first-person, column-read-aloud:
   ${DRIBUL_REFERENCE_URL}

2. FROM THE LOGO TOP VIDEOS — the voice the viewer already expects from us. Study the cadence, the interjections, the way numbers are delivered:
${ftlUrlList}

The mesh: Dribul's composure + FTL's fan energy + FTL's specific cadence. If FTL's top videos open with a stat stacked three deep, do that. If Dribul opens with "I'm still buzzing", do that. Match whichever reference fits the story you've been handed.

=== VOICE RULES ===

- First person. Basketball-obsessed friend. Use "I" freely.
- Short paragraphs. Some are one sentence. Some are just a stat.
- Specific numbers, let them speak: "42 points. 15 rebounds. 0 turnovers."
- Two-word reaction interjections, sparingly: "Real money." "What?!" "Yep." "Five. Million. Dollars."
- Direct reader address when it earns weight: "If you've been following this team for a minute, you know..." / "Think about that for a second."
- Pop dialogue tags ONCE per script if it fits: "Hold my Gatorade." / "Cue the record scratch."
- End with ONE SHARP SENTENCE. Either a callback to the opening or a metaphor punch (Dribul's "putting its money where its mouth is").

=== NEVER USE (these are AI tells, clichés, or off-voice) ===

- "It's not just X — it's Y" / "She didn't just X, she Y"
- "This isn't X. It's Y." (unless used ONCE as the final line)
- "Let that sink in" / "Sit with that for a second" (used too often — at most ONCE per script)
- "Here's the thing" / "Here's why that matters" / "Here's where it gets interesting"
- "In a league where..." / "In an era where..."
- "What makes this even more remarkable"
- "It's worth noting that..." / "The numbers tell a different story"
- "This isn't hyperbole" / "Make no mistake"
- "At the end of the day" / "The bottom line is"
- "Whether you love her or hate her"
- Rhetorical questions to open paragraphs
- Street slang that pushes past Dribul register: no "y'all", "sheesh", "bro what are you even talking about"
- Channel intros at the top: no "what's up everyone, welcome back to From The Logo"
- Subscribe pitches anywhere except ONE natural mention at the end

=== OUTPUT RULES ===

- Continuous prose, top to bottom. NO markdown, NO section headers, NO labels like [HOOK] or [OUTRO].
- Every stat, quote, date, and name must come from the RESEARCH BRIEF in the user prompt. Do not invent numbers. If the brief doesn't have a specific number, skip it — don't make one up.
- If you use a quote, attribute it to the person who said it.
- Target 1000-1200 words (7-8 minutes speaking). Tight is better than padded.
- Always pro-Caitlin-Clark perspective, but earned — backed by receipts, not vibes.
- Your final output is the script text only. No preamble. No "Here's your script:". Start with the cold open.

=== COLD OPEN OPTIONS (pick whichever fits the story) ===

a. Stat-first: "38 points. 8 assists. 5 threes. Two from the logo. That was Tuesday night. Caitlin Clark just did something only three other players in WNBA history have ever done."
b. Quote-first: "'I get two shits.' That's the quote from Cheryl Reeve when she was asked about Caitlin Clark bringing fans to her arena."
c. Play-first: "Clark got teed up for bouncing a basketball. That's it. She bounced it off the base of the hoop and the ref whistled her for a technical."
d. Emotion-primed (Dribul-style): "I'm still buzzing from what Caitlin Clark just did last night. Not because of the highlight reel — because of what it meant for a franchise that's been rebuilding for a decade." Then drop into specifics within 2-3 sentences.`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, hookLine, format, angle, talkingPoints } = body;

    if (!title || !hookLine) {
      return NextResponse.json(
        { error: "title and hookLine are required" },
        { status: 400 }
      );
    }

    const [ftlUrls, researchBrief] = await Promise.all([
      getFTLTopVideoUrls(3),
      getResearchBriefForPitch(title),
    ]);

    const systemPrompt = buildSystemPrompt(ftlUrls);

    const userPrompt = `Write the voiceover script for this pitch.

PITCH TITLE: "${title}"
HOOK LINE: "${hookLine}"
FORMAT: ${format || "evergreen"}${angle ? `\nANGLE: ${angle}` : ""}${
      talkingPoints && talkingPoints.length > 0
        ? `\n\nTALKING POINTS:\n${talkingPoints
            .map((tp: string, i: number) => `${i + 1}. ${tp}`)
            .join("\n")}`
        : ""
    }

=== RESEARCH BRIEF (use only these facts for specifics) ===
${
  researchBrief ||
  "(No specific research bundle matched this pitch. Rely on well-known public facts about Caitlin Clark / the Indiana Fever that you're highly confident on, and keep specifics minimal rather than inventing numbers.)"
}

Before you write, use url_context on the DRIBUL BASELINE URL and the FROM THE LOGO TOP VIDEOS URLs listed in the system prompt. Internalize the mesh: Dribul composure, FTL cadence and vocabulary.

Now write the complete script as continuous prose, top to bottom, no headers, no labels. End with one natural sign-off like "New videos every week on From The Logo. See you next time."`;

    const model = process.env.SCRIPT_MODEL || "gemini-2.5-pro";
    const result = await callGeminiWithTools(userPrompt, systemPrompt, model, {
      urlContext: true,
      maxOutputTokens: 16384,
    });

    return NextResponse.json({
      script: result.text,
      provider: "gemini",
      model,
    });
  } catch (error) {
    console.error("Script generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate script" },
      { status: 500 }
    );
  }
}
