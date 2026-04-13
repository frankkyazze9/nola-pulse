/**
 * POST /api/brain/stream
 *
 * Body: { question: string }
 *
 * Returns an SSE stream of brain events (tool_call, tool_result, thinking,
 * answer, error). The chat UI connects to this instead of the non-streaming
 * /api/brain route for interactive mode.
 */

import { streamBrainInteractive } from "@/lib/brain/stream";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { question?: string };
  try {
    body = (await request.json()) as { question?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.question || typeof body.question !== "string") {
    return Response.json(
      { error: "Missing 'question' string in body" },
      { status: 400 }
    );
  }

  const stream = streamBrainInteractive(body.question);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
