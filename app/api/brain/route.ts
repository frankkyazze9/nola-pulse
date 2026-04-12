/**
 * POST /api/brain
 *
 * Body: { mode: "interactive", question: string }
 *       | { mode: "dossier", personId: string }
 *
 * Returns the validated BrainAnswer or Dossier JSON from the reasoning loop.
 * Runs under the nodejs runtime (default) because the brain needs Prisma and
 * raw pgvector queries. Cloud Run request timeout is the real ceiling, but
 * maxDuration tells Next to keep the handler alive long enough for a
 * multi-tool-use dossier run.
 */

import {
  generateDossier,
  runBrainInteractive,
} from "@/lib/brain/runner";
import { SpendCapExceededError } from "@/lib/claude/spend";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

interface InteractiveBody {
  mode: "interactive";
  question: string;
}
interface DossierBody {
  mode: "dossier";
  personId: string;
}
type BrainBody = InteractiveBody | DossierBody;

export async function POST(request: Request) {
  let body: BrainBody;
  try {
    body = (await request.json()) as BrainBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    if (body.mode === "interactive") {
      if (!body.question || typeof body.question !== "string") {
        return Response.json(
          { error: "interactive mode requires a 'question' string" },
          { status: 400 }
        );
      }
      const answer = await runBrainInteractive(body.question);
      return Response.json(answer);
    }

    if (body.mode === "dossier") {
      if (!body.personId || typeof body.personId !== "string") {
        return Response.json(
          { error: "dossier mode requires a 'personId' string" },
          { status: 400 }
        );
      }
      const dossier = await generateDossier(body.personId);
      return Response.json(dossier);
    }

    return Response.json(
      { error: "mode must be 'interactive' or 'dossier'" },
      { status: 400 }
    );
  } catch (err) {
    if (err instanceof SpendCapExceededError) {
      return Response.json(
        {
          error: "monthly_spend_cap_exceeded",
          monthToDate: err.monthToDate,
          cap: err.cap,
          message: err.message,
        },
        { status: 402 }
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/brain] error:", err);
    return Response.json({ error: "brain_error", message }, { status: 500 });
  }
}
