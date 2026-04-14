/**
 * GET /api/cases/[id] — load case with evidence
 * PATCH /api/cases/[id] — update case fields
 */

import { getCase, updateCase } from "@/lib/brain/handlers";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const row = await getCase({ caseId: id });
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(row);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const row = await updateCase({
    caseId: id,
    title: body.title as string | undefined,
    brief: body.brief as string | undefined,
    status: body.status as "active" | "paused" | "closed" | "published" | undefined,
    findings: body.findings as Record<string, unknown> | undefined,
    outputDraft: body.outputDraft as string | undefined,
  });
  return Response.json(row);
}
