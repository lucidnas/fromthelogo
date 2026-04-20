import { NextResponse } from "next/server";
import { runDailyIngestion } from "@/lib/ingestion";

// Daily cron handler — runs ingestion (research new videos + corroborate)
// then triggers pitch generation.
//
// Schedule: 10:00 PM America/Chicago (= 03:00 UTC during CDT, 04:00 UTC during CST).
// Set up externally via Railway cron, cron-job.org, or GitHub Actions hitting:
//   GET  https://<host>/api/cron/daily?secret=<CRON_SECRET>
// (or pass via the x-cron-secret header). The middleware recognizes both.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret") || request.headers.get("x-cron-secret");

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const ingestionResult = await runDailyIngestion();

    // Chain into pitch generation so fresh pitches are waiting in the morning.
    const host = request.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const baseUrl = `${protocol}://${host}`;

    const pitchRes = await fetch(`${baseUrl}/api/generate-pitches`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": process.env.CRON_SECRET || "",
      },
      body: JSON.stringify({}),
    });
    const pitchData = await pitchRes.json().catch(() => ({}));

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ingestion: ingestionResult,
      pitches: {
        ok: pitchRes.ok,
        count: pitchData.count || 0,
      },
    });
  } catch (error) {
    console.error("Cron daily error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron job failed" },
      { status: 500 }
    );
  }
}
