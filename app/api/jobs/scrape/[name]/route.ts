/**
 * POST /api/jobs/scrape/[name]
 *
 * Trigger a scraper by name. Auth via x-cron-secret header matching CRON_SECRET.
 * Body: optional JSON args forwarded to the scraper.
 *
 * Runs synchronously — the caller waits for the scraper to complete or the
 * Cloud Run timeout to hit. Scrapers are idempotent (content-hash dedupe),
 * so partial runs are safe to resume.
 */

import { runScraper } from "@/lib/scraper/base";
import { nolaNewsRss } from "@/pipelines/scrapers/nola-news-rss/index";
import { gdelt } from "@/pipelines/scrapers/gdelt/index";
import { fec } from "@/pipelines/scrapers/fec/index";
import { laEthicsBootstrap } from "@/pipelines/scrapers/la-ethics-bootstrap/index";
import { bluesky } from "@/pipelines/scrapers/bluesky/index";
import { ballotpedia } from "@/pipelines/scrapers/ballotpedia/index";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 3600;

const SCRAPERS = {
  "nola-news-rss": nolaNewsRss,
  gdelt,
  fec,
  "la-ethics-bootstrap": laEthicsBootstrap,
  bluesky,
  ballotpedia,
} as const;

type ScraperName = keyof typeof SCRAPERS;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const expected = process.env.CRON_SECRET;
  const got = request.headers.get("x-cron-secret");
  if (!expected || got !== expected) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { name } = await params;
  const def = SCRAPERS[name as ScraperName];
  if (!def) {
    return Response.json(
      { error: `unknown scraper: ${name}`, available: Object.keys(SCRAPERS) },
      { status: 404 }
    );
  }

  let args: Record<string, unknown> = {};
  try {
    const body = await request.text();
    if (body) args = JSON.parse(body) as Record<string, unknown>;
  } catch {
    // ignore, use empty args
  }

  const result = await runScraper(def, args);
  return Response.json(result);
}
