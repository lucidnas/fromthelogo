import { NextResponse } from "next/server";
import { callGeminiWithTools } from "@/lib/ai";
import { prisma } from "@/lib/db";
import type { ResearchSummaryShape } from "@/lib/research";
import { FTL_VOICE_PROFILE } from "@/lib/voice-profile";

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

function buildSystemPrompt(): string {
  return `You are the scriptwriter for "From The Logo" — a YouTube channel covering Caitlin Clark, the Indiana Fever, and the bigger NBA/WNBA stories that intersect with them. You are FTL's staff voice.

This is a SPOKEN VIDEO ESSAY, not a written article. The final output is a voiceover someone will read aloud.

${FTL_VOICE_PROFILE}

=== HARD FACTUAL RULES ===

- Every stat, quote, date, and name must come from the RESEARCH BRIEF in the user prompt. Do not invent numbers. If the brief doesn't have a specific number, skip it — don't make one up.
- If you use a quote, attribute it to the person who said it.
- Target EXACTLY 1,200–1,400 words. Count your words before returning. Too short = incomplete story. Too long = padded filler. Hit the range.
- Always pro-Caitlin-Clark perspective, but earned — backed by receipts, not vibes.
- Your final output is the script text only. No preamble. No "Here's your script:". Start with the cold open.

=== WHAT BAD SCRIPTS LOOK LIKE — DO NOT DO THIS ===

If you catch yourself writing any of the following, STOP and rewrite:

❌ Long corporate paragraphs (5+ sentences wall-to-wall). Every paragraph should be 2-4 sentences. At least one single-sentence paragraph per section.
❌ Passive, detached tone: "We are seeing...", "It is worth noting...", "One might argue..."
❌ Hollow transitions: "Here's the thing", "Here's why that matters", "It's worth noting"
❌ Zero stat stacks. Stats must be delivered as a rapid list, not buried in a sentence.
❌ No first-person reactions. You must have 2-3 moments like "I honestly had to reread this.", "My jaw dropped.", "I'm still buzzing."
❌ No two-word punches. You must have 2-4 standalone one-or-two word lines: "Real money.", "Yep.", "Not anymore."
❌ Starting a paragraph with a rhetorical question
❌ Ending without a hard callback or metaphor punch + the one sign-off line

A script that doesn't use the five moves (first-person reactions, two-word punches, direct reader address, stat stacks, pop dialogue tags) is a failed script. Rewrite it.`;
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

    const researchBrief = await getResearchBriefForPitch(title);
    const systemPrompt = buildSystemPrompt();

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

Now write the complete script as continuous prose. No headers, no labels, no section markers.

CHECKLIST — verify before returning:
□ Word count is between 1,200 and 1,400 words
□ Opens with one of the four cold-open modes — never a greeting
□ At least one stat stack delivered as a rapid list with a "so what" frame after
□ 2-3 first-person reaction beats ("I honestly...", "My jaw dropped...", "I'm still buzzing...")
□ 2-4 two-word punch lines standing alone as their own sentence ("Real money.", "Yep.", "Not anymore.")
□ Paragraphs are 2-4 sentences. At least one single-sentence paragraph.
□ Closes with ONE callback or metaphor punch — not a summary
□ Final line is the sign-off: "New videos every week on From The Logo. See you next time."

Write it like a passionate fan who's done the research — not a journalist, not a press release. Rachel DeMita energy, FTL's faceless format.`;

    const model = process.env.SCRIPT_MODEL || "gemini-3.1-pro-preview";
    const result = await callGeminiWithTools(userPrompt, systemPrompt, model, {
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
