/**
 * GET /api/cases/[id]/pings — list all location pings for a case
 * POST /api/cases/[id]/pings — add a ping
 *   body: { latitude, longitude, timestamp, source?, label?, note?, accuracyM? }
 */

import { addLocationPing, listLocationPings } from "@/lib/brain/handlers";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pings = await listLocationPings({ caseId: id });
  return Response.json({ pings });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json()) as {
    latitude?: number;
    longitude?: number;
    timestamp?: string;
    source?: "manual" | "apple_findmy" | "airtag" | "gpx" | "other";
    label?: string;
    note?: string;
    accuracyM?: number;
  };

  if (
    typeof body.latitude !== "number" ||
    typeof body.longitude !== "number" ||
    !body.timestamp
  ) {
    return Response.json(
      { error: "latitude, longitude, and timestamp are required" },
      { status: 400 }
    );
  }
  if (body.latitude < -90 || body.latitude > 90 || body.longitude < -180 || body.longitude > 180) {
    return Response.json({ error: "invalid coordinates" }, { status: 400 });
  }

  const row = await addLocationPing({
    caseId: id,
    latitude: body.latitude,
    longitude: body.longitude,
    timestamp: body.timestamp,
    source: body.source,
    label: body.label,
    note: body.note,
    accuracyM: body.accuracyM,
  });
  return Response.json(row, { status: 201 });
}
