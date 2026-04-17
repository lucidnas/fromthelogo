import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";

function detectFormat(title: string): string {
  if (/The Day/i.test(title)) return "the-day";
  if (/increasingly/i.test(title)) return "increasingly";
  if (/Backfired/i.test(title)) return "backfired";
  if (/This Caitlin Clark/i.test(title) || /Caitlin Clark (Play|Skill|Dribble)/i.test(title))
    return "highlight";
  return "other";
}

function parseDate(yyyymmdd: string): Date {
  const y = parseInt(yyyymmdd.slice(0, 4));
  const m = parseInt(yyyymmdd.slice(4, 6)) - 1;
  const d = parseInt(yyyymmdd.slice(6, 8));
  return new Date(y, m, d);
}

async function main() {
  const adapter = new PrismaPg(process.env.DATABASE_URL!);
  const prisma = new PrismaClient({ adapter });

  const dataPath = "/tmp/ftl_full_data.txt";
  const raw = fs.readFileSync(dataPath, "utf-8").trim();
  const lines = raw.split("\n").filter((l) => l.trim());

  console.log(`Found ${lines.length} videos to seed`);

  let created = 0;
  let updated = 0;

  for (const line of lines) {
    const [id, title, viewsStr, durationStr, uploadDate] = line.split("|||");
    if (!id || !title) continue;

    const views = parseInt(viewsStr) || 0;
    const duration = parseInt(durationStr) || 0;
    const publishedAt = parseDate(uploadDate);
    const format = detectFormat(title);

    const existing = await prisma.channelStat.findUnique({
      where: { youtubeId: id },
    });

    if (existing) {
      await prisma.channelStat.update({
        where: { youtubeId: id },
        data: { views, title, duration, lastChecked: new Date() },
      });
      updated++;
    } else {
      await prisma.channelStat.create({
        data: {
          youtubeId: id,
          title,
          views,
          duration,
          format,
          tags: [],
          publishedAt,
          lastChecked: new Date(),
        },
      });
      created++;
    }
  }

  console.log(`Seed complete: ${created} created, ${updated} updated`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
