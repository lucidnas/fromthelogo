import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export interface GeneratedThumbnail {
  id: number;
  filename: string;
  url: string;
  slug: string;
  title: string;
  format: string; // 'a' | 'b' | 'c'
  model: "openai" | "gemini";
  version: number;
  createdAt: string;
}

export interface ThumbnailGroup {
  slug: string;
  title: string;
  formats: {
    a: GeneratedThumbnail[];
    b: GeneratedThumbnail[];
    c: GeneratedThumbnail[];
  };
}

export async function GET() {
  try {
    const records = await prisma.generatedThumbnail.findMany({
      orderBy: [{ slug: "asc" }, { format: "asc" }, { version: "desc" }],
    });

    // Group by slug → format
    const groupMap = new Map<string, ThumbnailGroup>();

    for (const r of records) {
      if (!groupMap.has(r.slug)) {
        groupMap.set(r.slug, {
          slug: r.slug,
          title: r.title,
          formats: { a: [], b: [], c: [] },
        });
      }
      const group = groupMap.get(r.slug)!;
      const fmt = r.format as "a" | "b" | "c";
      if (fmt in group.formats) {
        group.formats[fmt].push({
          id: r.id,
          filename: r.imageUrl.split("/").pop() ?? "",
          url: r.imageUrl,
          slug: r.slug,
          title: r.title,
          format: r.format,
          model: r.model as "openai" | "gemini",
          version: r.version,
          createdAt: r.createdAt.toISOString(),
        });
      }
    }

    const groups = Array.from(groupMap.values());
    return NextResponse.json({ groups });
  } catch (error) {
    console.error("Generated thumbnails error:", error);
    // Fallback to empty
    return NextResponse.json({ groups: [] });
  }
}
