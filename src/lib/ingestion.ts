// Daily autonomous ingestion pipeline.
//
// Stage 1 (INGEST): For each channel in YOUTUBE_CHANNELS, pull the latest
// videos, skip any URL already in ResearchSummary, and for each new video
// extract a structured summary + list of discrete topics.
//
// Stage 2 (CORROBORATE): For each topic extracted, find corroborating reporting
// from official sources (NBA.com, WNBA.com, team sites) and reputable outlets.
// Fallback: cite the video URL + timestamp when no external source exists.
//
// Both stages are handled by a SINGLE Gemini 3.1 call per video with both
// url_context and googleSearch tools enabled. This keeps the pipeline simple
// and the token cost bounded.

import { callGeminiWithTools } from "./ai";
import { prisma } from "./db";
import {
  fetchAllNewsItems,
  type NewsItem,
} from "./news-sources";
import type { ResearchSummaryShape } from "./research";

const MAX_NEW_VIDEOS_PER_RUN = 20;

const INGESTION_SYSTEM_PROMPT = `You are the overnight research analyst for "From The Logo" — a YouTube channel covering Caitlin Clark, the Indiana Fever, and the bigger NBA/WNBA stories that intersect with them.

You have two tools available:
1. url_context — read a URL's content (YouTube captions + metadata, or article text)
2. googleSearch — search the live web for corroborating reporting

Your job for each source URL you receive:

STAGE 1 — READ THE VIDEO
- Use url_context to read the URL's captions and metadata.
- Extract the structured fields listed in the output schema below.
- Identify 2 to 4 DISCRETE TOPICS the video covers. A topic is a named claim or storyline (e.g. "Caitlin Clark's technical foul for bouncing the ball", "Diana Taurasi's retirement tour snub"). Not a category.

STAGE 2 — CORROBORATE EACH TOPIC
For each topic, decide:
- Is this a factual claim that should be corroborated by external reporting? (Game stats, quotes, trades, injuries, announcements = yes. The creator's own opinions = no.)
- If yes: use googleSearch to find 1-3 corroborating sources from official sites (NBA.com, WNBA.com, team sites) or reputable outlets (ESPN, Athlon, The Athletic, AP, Sports Illustrated). For each, capture the URL, outlet name, and a short excerpt (≤ 200 chars) verifying the claim.
- If no external source is found OR the claim is creator opinion: skip the sources array and instead capture 1-2 video references with the timestamp (from captions) where the claim is made, plus a short description of the claim.

OUTPUT SCHEMA — return JSON matching exactly this shape, no markdown fences:

{
  "angle": "1-2 sentences on the source's central angle",
  "villain": "named person + what they did, or null",
  "keyMoments": ["3-5 specific moments"],
  "quotes": ["2-4 verbatim quotes with attribution"],
  "stats": ["2-4 specific numbers or records"],
  "whyItResonated": "1-2 sentences",
  "topics": [
    {
      "topic": "short topic name",
      "summary": "1-2 sentences framing the claim or storyline",
      "sources": [
        { "url": "https://...", "outlet": "Outlet name", "excerpt": "short verifying excerpt" }
      ],
      "videoReferences": [
        { "timestamp": "MM:SS", "claim": "what is said at this point" }
      ]
    }
  ]
}

CRITICAL — VALID JSON ONLY:
- Output must be parseable by JSON.parse. No trailing commas, no comments, no markdown fences.
- Escape every internal double quote with a backslash (\\").
- Escape every backslash as \\\\, every newline as \\n.
- Your first character must be '{' and your last character must be '}'.`;

function buildIngestionUserPrompt(item: NewsItem): string {
  const meta = [
    item.source ? `Channel: ${item.source}` : null,
    item.title ? `Title: ${item.title}` : null,
    item.date ? `Published: ${item.date}` : null,
    typeof item.score === "number" && item.score > 0
      ? `Views at scrape time: ${item.score.toLocaleString()}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `Research this video end to end — read it, summarize it, extract topics, and corroborate each factual topic via Google search.

${meta}
URL: ${item.url}

Return JSON only. No preamble. No markdown fences.`;
}

function parseIngestionResponse(raw: string): ResearchSummaryShape {
  const cleaned = raw
    .replace(/```(?:json)?\s*/g, "")
    .replace(/```\s*$/g, "")
    .trim();

  try {
    return JSON.parse(cleaned) as ResearchSummaryShape;
  } catch {
    // Fall through to brace slicing
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error(`No JSON object found. First 300 chars: ${cleaned.slice(0, 300)}`);
  }
  const slice = cleaned.slice(firstBrace, lastBrace + 1);
  return JSON.parse(slice) as ResearchSummaryShape;
}

export type IngestionRunResult = {
  processed: number;
  skippedAlreadyResearched: number;
  errors: Array<{ url: string; message: string }>;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
};

export async function runDailyIngestion(): Promise<IngestionRunResult> {
  const startedAt = new Date();

  const grouped = await fetchAllNewsItems();
  // Ingest YouTube items only for now. Athlon corroboration happens inside
  // each video's topic research via googleSearch.
  const candidates = grouped.youtube.filter((i) => !!i.url);

  // Skip anything we already have a research row for.
  const urls = candidates.map((c) => c.url!);
  const existing = await prisma.researchSummary.findMany({
    where: { url: { in: urls } },
    select: { url: true },
  });
  const existingSet = new Set(existing.map((e) => e.url));

  const toIngest = candidates
    .filter((c) => !existingSet.has(c.url!))
    .slice(0, MAX_NEW_VIDEOS_PER_RUN);

  const model = process.env.RESEARCH_MODEL || "gemini-3.1-pro-preview";
  const errors: Array<{ url: string; message: string }> = [];
  let processed = 0;

  for (const item of toIngest) {
    try {
      const result = await callGeminiWithTools(
        buildIngestionUserPrompt(item),
        INGESTION_SYSTEM_PROMPT,
        model,
        {
          urlContext: true,
          googleSearch: true,
          maxOutputTokens: 32768,
        }
      );

      const summary = parseIngestionResponse(result.text);

      await prisma.researchSummary.upsert({
        where: { url: item.url! },
        create: {
          url: item.url!,
          source: item.source,
          title: item.title,
          viewCount: item.score ?? null,
          summary: summary as unknown as object,
          rawText: JSON.stringify(summary),
          model,
        },
        update: {
          source: item.source,
          title: item.title,
          viewCount: item.score ?? null,
          summary: summary as unknown as object,
          rawText: JSON.stringify(summary),
          model,
          fetchedAt: new Date(),
        },
      });

      processed += 1;
    } catch (err) {
      errors.push({
        url: item.url!,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const finishedAt = new Date();
  return {
    processed,
    skippedAlreadyResearched: existingSet.size,
    errors,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
  };
}
