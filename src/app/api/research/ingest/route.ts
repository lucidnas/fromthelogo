import { NextResponse } from "next/server";
import { runDailyIngestion } from "@/lib/ingestion";

// Manual-trigger version of the daily ingestion job. Session-auth only
// (the middleware enforces the ftl_auth cookie for /api routes that aren't
// /api/cron or /api/auth).
export async function POST() {
  try {
    const result = await runDailyIngestion();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Manual ingestion error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ingestion failed" },
      { status: 500 }
    );
  }
}
