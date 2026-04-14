/**
 * POST /api/jobs/brain
 *
 * Cron-authed endpoint to dispatch the brain programmatically. Used by
 * Cloud Scheduler, by me (the developer), and by any future autonomous
 * workflow that needs brain reasoning without the web UI or Telegram.
 *
 * Auth: x-cron-secret header matches CRON_SECRET in Secret Manager.
 *
 * Body:
 *   { prompt: string, conversationKey?: string }
 *
 * If conversationKey is provided, the brain gets the last N messages from
 * Conversation(channel="cron", externalUserId=conversationKey) as context,
 * and the response is saved. Lets scheduled workflows maintain state across
 * runs ("yesterday's scrape turned up X, today's adds Y").
 */

import { runBrainInteractive } from "@/lib/brain/runner";
import {
  getOrCreateConversation,
  loadRecentMessages,
  saveMessage,
} from "@/lib/conversation";
import { SpendCapExceededError } from "@/lib/claude/spend";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 3600;

interface Body {
  prompt?: string;
  conversationKey?: string;
}

export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const got = request.headers.get("x-cron-secret");
  if (!expected || got !== expected) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.prompt || typeof body.prompt !== "string") {
    return Response.json({ error: "prompt required" }, { status: 400 });
  }

  try {
    let conversationId: string | null = null;
    let priorMessages;
    if (body.conversationKey) {
      conversationId = await getOrCreateConversation(
        "web", // reuse the web channel — could add "cron" later if we want separate histories
        `cron:${body.conversationKey}`
      );
      priorMessages = await loadRecentMessages(conversationId);
      await saveMessage(conversationId, "user", body.prompt);
    }

    const answer = await runBrainInteractive(body.prompt, {
      priorMessages,
    });

    if (conversationId) {
      await saveMessage(conversationId, "assistant", answer.markdown);
    }

    return Response.json({
      markdown: answer.markdown,
      claims: answer.claims,
      sourcesConsulted: answer.sourcesConsulted,
      nextSteps: answer.nextSteps,
      conversationId,
    });
  } catch (err) {
    if (err instanceof SpendCapExceededError) {
      return Response.json(
        {
          error: "monthly_spend_cap_exceeded",
          monthToDate: err.monthToDate,
          cap: err.cap,
        },
        { status: 402 }
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/jobs/brain] error:", err);
    return Response.json({ error: "brain_error", message }, { status: 500 });
  }
}
