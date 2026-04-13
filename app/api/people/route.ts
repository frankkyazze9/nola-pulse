/**
 * GET /api/people?q=<query>&limit=<n>
 *
 * Quick person search for the typeahead in the research UI.
 * Thin wrapper around the brain's searchPeople handler.
 */

import { searchPeople } from "@/lib/brain/handlers";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const limit = Math.min(
    Number(request.nextUrl.searchParams.get("limit") ?? 10),
    50
  );

  if (!q.trim()) {
    return Response.json({ results: [], count: 0 });
  }

  const data = await searchPeople({ query: q, limit });
  return Response.json(data);
}
