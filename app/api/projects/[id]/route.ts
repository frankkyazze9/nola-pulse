/**
 * GET /api/projects/[id] — load project with subject
 * PATCH /api/projects/[id] — update project fields
 */

import { getProject, updateProject } from "@/lib/brain/handlers";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const row = await getProject({ projectId: id });
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(row);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const row = await updateProject({
    projectId: id,
    title: body.title as string | undefined,
    status: body.status as "active" | "paused" | "closed" | undefined,
    goals: body.goals as Record<string, unknown> | undefined,
    brandAnalysis: body.brandAnalysis as Record<string, unknown> | undefined,
    influencerMap: body.influencerMap as Record<string, unknown> | undefined,
    growthPlan: body.growthPlan as Record<string, unknown> | undefined,
  });
  return Response.json(row);
}
