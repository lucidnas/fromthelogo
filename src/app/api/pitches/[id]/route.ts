import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pitchId = parseInt(id, 10);

    if (isNaN(pitchId)) {
      return NextResponse.json({ error: "Invalid pitch ID" }, { status: 400 });
    }

    const body = await request.json();
    const { status, generatedScript } = body;

    const data: Record<string, unknown> = {};
    if (status) data.status = status;
    if (generatedScript !== undefined) data.generatedScript = generatedScript;

    const pitch = await prisma.pitch.update({
      where: { id: pitchId },
      data,
    });

    return NextResponse.json({ pitch });
  } catch (error) {
    console.error("Update pitch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update pitch" },
      { status: 500 }
    );
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pitchId = parseInt(id, 10);

    if (isNaN(pitchId)) {
      return NextResponse.json({ error: "Invalid pitch ID" }, { status: 400 });
    }

    const pitch = await prisma.pitch.findUnique({
      where: { id: pitchId },
    });

    if (!pitch) {
      return NextResponse.json({ error: "Pitch not found" }, { status: 404 });
    }

    return NextResponse.json({ pitch });
  } catch (error) {
    console.error("Get pitch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get pitch" },
      { status: 500 }
    );
  }
}
