/**
 * POST /api/jobs/observations
 *
 * Cron-authed endpoint. Runs the observation pass over recent documents.
 * Body (optional): { sinceHours?: number, limit?: number }
 */

import { runObservationPass } from "@/lib/observation";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 3600;

export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const got = request.headers.get("x-cron-secret");
  if (!expected || got !== expected) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { sinceHours?: number; limit?: number } = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text) as typeof body;
  } catch {
    // empty body ok
  }

  const result = await runObservationPass({
    sinceHours: body.sinceHours ?? 24,
    limit: body.limit ?? 20,
  });

  return Response.json(result);
}
