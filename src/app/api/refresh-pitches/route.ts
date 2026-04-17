import { NextResponse } from "next/server";

// Refresh pitches just calls the generate-pitches endpoint logic
// This avoids duplicating the prompt and news-fetching logic
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin") || request.headers.get("host") || "localhost:3000";
    const protocol = origin.includes("localhost") ? "http" : "https";
    const baseUrl = origin.includes("://") ? origin : `${protocol}://${origin}`;

    const res = await fetch(`${baseUrl}/api/generate-pitches`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: request.headers.get("cookie") || "",
      },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("Refresh pitches error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to refresh pitches" },
      { status: 500 }
    );
  }
}
