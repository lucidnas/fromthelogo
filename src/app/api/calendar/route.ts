import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const weekNumber = searchParams.get("weekNumber");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: Record<string, unknown> = {};
    if (year) where.year = parseInt(year, 10);
    if (weekNumber) where.weekNumber = parseInt(weekNumber, 10);
    if (startDate || endDate) {
      where.date = {};
      if (startDate) (where.date as Record<string, unknown>).gte = new Date(startDate);
      if (endDate) (where.date as Record<string, unknown>).lte = new Date(endDate);
    }

    const slots = await prisma.calendarSlot.findMany({
      where,
      include: { pitch: true },
      orderBy: { date: "asc" },
    });

    return NextResponse.json({ slots });
  } catch (error) {
    console.error("Fetch calendar slots error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch calendar slots" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { weekNumber, year, dayOfWeek, slotType, date, pitchId, status, notes } = body;

    if (!weekNumber || !year || !dayOfWeek || !slotType || !date) {
      return NextResponse.json(
        { error: "weekNumber, year, dayOfWeek, slotType, and date are required" },
        { status: 400 }
      );
    }

    const slot = await prisma.calendarSlot.create({
      data: {
        weekNumber,
        year,
        dayOfWeek,
        slotType,
        date: new Date(date),
        pitchId: pitchId || null,
        status: status || "open",
        notes: notes || null,
      },
      include: { pitch: true },
    });

    return NextResponse.json({ slot }, { status: 201 });
  } catch (error) {
    console.error("Create calendar slot error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create calendar slot" },
      { status: 500 }
    );
  }
}
