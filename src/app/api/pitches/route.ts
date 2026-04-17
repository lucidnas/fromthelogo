import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const pitchType = searchParams.get("pitchType");

    const where: Record<string, string> = {};
    if (status) where.status = status;
    if (pitchType) where.pitchType = pitchType;

    const pitches = await prisma.pitch.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ pitches });
  } catch (error) {
    console.error("Fetch pitches error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch pitches" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, format, pitchType, angle, hookLine, talkingPoints, performanceScore, aiProvider, aiModel } = body;

    if (!title || !format || !angle || !hookLine) {
      return NextResponse.json(
        { error: "title, format, angle, and hookLine are required" },
        { status: 400 }
      );
    }

    const pitch = await prisma.pitch.create({
      data: {
        title,
        format,
        pitchType: pitchType || "trending",
        angle,
        hookLine,
        talkingPoints: talkingPoints || [],
        performanceScore: performanceScore || 0,
        status: "pending",
        aiProvider: aiProvider || null,
        aiModel: aiModel || null,
      },
    });

    return NextResponse.json({ pitch }, { status: 201 });
  } catch (error) {
    console.error("Create pitch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create pitch" },
      { status: 500 }
    );
  }
}
