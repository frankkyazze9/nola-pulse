/**
 * GET /api/projects — list projects
 * POST /api/projects — create project { title, kind?, subjectPersonId?, subjectOrgId?, goals? }
 */

import { createProject, listProjects } from "@/lib/brain/handlers";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  const limit = Math.min(
    Number(request.nextUrl.searchParams.get("limit") ?? 50),
    200
  );
  const results = await listProjects({ status, limit });
  return Response.json({ results });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    title?: string;
    kind?: "campaign" | "brand" | "other";
    subjectPersonId?: string;
    subjectOrgId?: string;
    goals?: Record<string, unknown>;
  };
  if (!body.title) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }
  const row = await createProject({
    title: body.title,
    kind: body.kind,
    subjectPersonId: body.subjectPersonId,
    subjectOrgId: body.subjectOrgId,
    goals: body.goals,
  });
  return Response.json(row, { status: 201 });
}
