/**
 * GET /api/cases — list cases (optional ?status=active|paused|closed|published)
 * POST /api/cases — create case { title, brief }
 */

import { createCase, listCases } from "@/lib/brain/handlers";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  const limit = Math.min(
    Number(request.nextUrl.searchParams.get("limit") ?? 50),
    200
  );
  const results = await listCases({ status, limit });
  return Response.json({ results });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { title?: string; brief?: string };
  if (!body.title || !body.brief) {
    return Response.json(
      { error: "title and brief are required" },
      { status: 400 }
    );
  }
  const row = await createCase({ title: body.title, brief: body.brief });
  return Response.json(row, { status: 201 });
}
