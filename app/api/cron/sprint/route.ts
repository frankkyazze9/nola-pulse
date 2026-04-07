import { NextResponse } from "next/server";

/**
 * Sprint endpoint — runs all scouts, analysts, and generates content.
 * Triggered by Cloud Scheduler daily at 5am CT.
 *
 * This is a lightweight trigger — the actual work happens in the agent code.
 * For heavy workloads, this should be moved to a Cloud Run Job.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Import and run agents sequentially to stay within Cloud Run timeout
  const results: Record<string, string> = {};

  // Scouts (data ingestion)
  const scoutModules = [
    ["scout-311", () => import("@/agents/scout-311/src/index")],
    ["scout-str", () => import("@/agents/scout-str/src/index")],
    ["scout-news", () => import("@/agents/scout-news/src/index")],
    ["scout-blight", () => import("@/agents/scout-blight/src/index")],
  ] as const;

  for (const [name, load] of scoutModules) {
    try {
      const mod = await load();
      await mod.main();
      results[name] = "success";
    } catch (err) {
      results[name] = `failed: ${(err as Error).message}`;
    }
  }

  // Story Finder (generates article draft)
  try {
    const sf = await import("@/agents/analyst-story-finder/src/index");
    await sf.findTodaysStory();
    results["story-finder"] = "success";
  } catch (err) {
    results["story-finder"] = `failed: ${(err as Error).message}`;
  }

  return NextResponse.json({ sprint: "complete", results });
}
