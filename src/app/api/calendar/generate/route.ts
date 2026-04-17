import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getNextDayOfWeek(from: Date, targetDay: number): Date {
  const result = new Date(from);
  const currentDay = result.getDay();
  let diff = targetDay - currentDay;
  if (diff < 0) diff += 7;
  if (diff === 0) {
    // If today is the target day, include it
    return result;
  }
  result.setDate(result.getDate() + diff);
  return result;
}

export async function POST() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const created: Array<{ date: Date; dayOfWeek: string; slotType: string }> = [];

    // Generate slots for the next 4 weeks
    for (let weekOffset = 0; weekOffset < 4; weekOffset++) {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() + weekOffset * 7);

      // Monday = 1, Thursday = 4
      const days = [
        { target: 1, dayOfWeek: "monday", slotType: "news-evergreen" },
        { target: 4, dayOfWeek: "thursday", slotType: "deep-dive" },
      ];

      for (const { target, dayOfWeek, slotType } of days) {
        const slotDate = getNextDayOfWeek(weekStart, target);
        // Skip if date is in the past (before today)
        if (slotDate < today) continue;

        const weekNum = getISOWeekNumber(slotDate);
        const year = slotDate.getFullYear();

        // Check if slot already exists
        const existing = await prisma.calendarSlot.findFirst({
          where: {
            year,
            weekNumber: weekNum,
            dayOfWeek,
          },
        });

        if (!existing) {
          await prisma.calendarSlot.create({
            data: {
              weekNumber: weekNum,
              year,
              dayOfWeek,
              slotType,
              date: slotDate,
              status: "open",
            },
          });
          created.push({ date: slotDate, dayOfWeek, slotType });
        }
      }
    }

    return NextResponse.json({
      message: `Generated ${created.length} new calendar slots`,
      created,
    });
  } catch (error) {
    console.error("Generate calendar slots error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate calendar slots" },
      { status: 500 }
    );
  }
}
