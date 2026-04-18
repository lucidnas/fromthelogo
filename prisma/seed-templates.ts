// Seeds TitleTemplate table with scraped titles from Hoop Reports, DKM, and JxmyHighroller.
// Reads from /tmp/hoopreports_titles.txt, /tmp/dkm_titles.txt, /tmp/jxmy_titles.txt.
// Each line format: videoId|||title|||views|||duration

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "fs";
import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.local" });

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

type Channel = "hoop-reports" | "dkm" | "jxmy";

function classifySubject(title: string, channel: Channel): string {
  const t = title.toLowerCase();
  if (t.includes("caitlin") || t.includes("clark") || t.includes("wnba") || t.includes("fever") || t.includes("angel reese") || t.includes("sophie cunningham")) {
    return "cc-wnba";
  }
  if (t.includes("curry") || t.includes("warriors") || t.includes("golden state") || t.includes("klay") || t.includes("draymond") || t.includes("wiggins") || t.includes("dubs") || t.includes("poole")) {
    return "curry-warriors";
  }
  return "nba-general";
}

function extractPattern(title: string): string {
  const t = title.toLowerCase();

  if (t.startsWith("the day ")) return "the-day";
  if (t.includes("but they get increasingly")) return "increasingly";
  if (t.includes("backfired")) return "backfired";
  if (t.startsWith("when you're the ") || t.startsWith("when you are the ")) return "when-youre-the";
  if (t.startsWith("how ") && (t.includes("became") || t.includes("saved") || t.includes("changed"))) return "how-became";
  if (t.startsWith("this is what happens") || t.startsWith("what happens when")) return "what-happens";
  if (t.startsWith("why ") && (t.includes("scared") || t.includes("fear"))) return "why-scared";
  if (t.startsWith("why ")) return "why";
  if (t.startsWith("the story of ") || t.startsWith("story of ")) return "the-story-of";
  if (t.includes("trash talk")) return "trash-talk";
  if (t.includes("exposed")) return "exposed";
  if (t.match(/^\d+ (stories|times|things|plays|moments|reasons)/i)) return "number-list";
  if (t.startsWith("this is why")) return "this-is-why";
  if (t.includes("just became") || t.includes("has officially")) return "just-became";
  if (t.match(/\.\.\s*(but|then|and)/i)) return "punchline";

  return "other";
}

async function seedChannel(filePath: string, channel: Channel) {
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    console.log(`File not found: ${filePath}, skipping`);
    return 0;
  }

  const lines = content.split("\n").filter((l) => l.trim());
  let count = 0;
  let skipped = 0;

  for (const line of lines) {
    const parts = line.split("|||");
    if (parts.length < 4) {
      skipped++;
      continue;
    }

    const [youtubeId, title, viewsStr, durationStr] = parts.map((p) => p.trim());
    if (!youtubeId || !title) continue;

    const views = parseInt(viewsStr) || 0;
    const duration = parseInt(durationStr) || 0;
    const subject = classifySubject(title, channel);
    const pattern = extractPattern(title);

    try {
      await prisma.titleTemplate.upsert({
        where: { youtubeId },
        create: {
          youtubeId,
          title,
          channel,
          views,
          duration,
          subject,
          pattern,
        },
        update: {
          views,
          duration,
          subject,
          pattern,
        },
      });
      count++;
    } catch (err) {
      console.error(`Failed to insert ${youtubeId}:`, err instanceof Error ? err.message : err);
      skipped++;
    }
  }

  console.log(`${channel}: inserted/updated ${count}, skipped ${skipped}`);
  return count;
}

async function main() {
  const hr = await seedChannel("/tmp/hoopreports_titles.txt", "hoop-reports");
  const dkm = await seedChannel("/tmp/dkm_titles.txt", "dkm");
  const jxmy = await seedChannel("/tmp/jxmy_titles.txt", "jxmy");

  const total = hr + dkm + jxmy;
  console.log(`\nTotal templates seeded: ${total}`);

  // Stats
  const bySubject = await prisma.titleTemplate.groupBy({
    by: ["subject"],
    _count: true,
  });
  console.log("\nBy subject:", bySubject);

  const byPattern = await prisma.titleTemplate.groupBy({
    by: ["pattern"],
    _count: true,
    orderBy: { _count: { pattern: "desc" } },
    take: 15,
  });
  console.log("\nTop patterns:", byPattern);

  await prisma.$disconnect();
}

main().catch(console.error);
