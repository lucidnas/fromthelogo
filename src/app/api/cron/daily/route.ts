import { NextResponse } from "next/server";

// Cron calls the same generate-pitches endpoint internally.
// This keeps all pitch logic in one place (template-based adaptation).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret") || request.headers.get("x-cron-secret");

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const host = request.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const baseUrl = `${protocol}://${host}`;

    // Internal call to generate-pitches — needs to bypass middleware auth.
    // The middleware allows /api/cron/* and /api/auth/*, so we call it via
    // a service-to-service header that the middleware recognizes.
    const res = await fetch(`${baseUrl}/api/generate-pitches`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Pass cron secret as auth — we'll update middleware to accept this
        "x-cron-secret": process.env.CRON_SECRET || "",
      },
    });

    const data = await res.json();

    return NextResponse.json({
      success: res.ok,
      pitchesCreated: data.count || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron daily error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron job failed" },
      { status: 500 }
    );
  }
}
