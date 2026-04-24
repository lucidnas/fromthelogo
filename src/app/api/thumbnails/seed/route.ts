import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Called by generate.py after local generation to register the image in the DB.
export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { slug, title, format, model, imageUrl, version } = await request.json();

    if (!slug || !title || !format || !model || !imageUrl || !version) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const record = await prisma.generatedThumbnail.create({
      data: { slug, title, format, model, imageUrl, version },
    });

    return NextResponse.json({ id: record.id, ok: true });
  } catch (error) {
    console.error("Thumbnail seed error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Seed failed" },
      { status: 500 }
    );
  }
}
