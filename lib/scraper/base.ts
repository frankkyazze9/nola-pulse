/**
 * Shared scraper framework for Dark Horse.
 *
 * Every Dark Horse scraper is a `ScraperDefinition` wrapped in `runScraper`,
 * which:
 *   - opens a ScraperRun row with status=running
 *   - provides rate-limit, retry, GCS raw-save, and Wayback helpers via ctx
 *   - closes the run with recordsFetched/recordsUpserted/errorCount/errorDetails
 *
 * Use this consistently so `/admin/ingest` and dashboards get reliable data.
 * See `.claude/skills/add-data-source/SKILL.md`.
 */

import { prisma } from "../db";
import { saveJson } from "../gcs";
import { savePageNow } from "../wayback";

export class RateLimiter {
  private lastCallAt = 0;
  constructor(private readonly minIntervalMs: number) {}

  async wait(): Promise<void> {
    const now = Date.now();
    const delay = Math.max(0, this.lastCallAt + this.minIntervalMs - now);
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    this.lastCallAt = Date.now();
  }
}

export async function retry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i === attempts - 1) break;
      const backoffMs = Math.min(30_000, 1000 * Math.pow(2, i));
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  throw lastError;
}

export interface ScraperStats {
  recordsFetched: number;
  recordsUpserted: number;
  errorCount: number;
}

export interface ScraperContext {
  readonly runId: string;
  readonly stats: ScraperStats;
  readonly errorDetails: Array<Record<string, unknown>>;
  readonly rateLimit: RateLimiter;
  saveRaw: (filename: string, data: unknown) => Promise<string>;
  archive: (url: string) => Promise<string | null>;
  logError: (err: unknown, details?: Record<string, unknown>) => void;
}

export interface ScraperDefinition<Args = Record<string, unknown>> {
  name: string;
  sourceSystem: string;
  /** Default: 10 req/sec. Set lower for strict-rate-limit APIs. */
  rateLimitPerSec?: number;
  run: (args: Args, ctx: ScraperContext) => Promise<void>;
}

export interface ScraperRunResult {
  success: boolean;
  runId: string;
  stats: ScraperStats;
}

export async function runScraper<Args>(
  def: ScraperDefinition<Args>,
  args: Args
): Promise<ScraperRunResult> {
  const run = await prisma.scraperRun.create({
    data: { scraperName: def.name, status: "running" },
  });

  const stats: ScraperStats = { recordsFetched: 0, recordsUpserted: 0, errorCount: 0 };
  const errorDetails: Array<Record<string, unknown>> = [];
  const rateLimit = new RateLimiter(1000 / (def.rateLimitPerSec ?? 10));

  const ctx: ScraperContext = {
    runId: run.id,
    stats,
    errorDetails,
    rateLimit,
    async saveRaw(filename, data) {
      const path = `raw/${def.sourceSystem}/${run.id}/${filename}`;
      return saveJson(path, data);
    },
    async archive(url) {
      return savePageNow(url);
    },
    logError(err, details) {
      stats.errorCount++;
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      errorDetails.push({ message, stack, ...details });
      console.error(`[${def.name}] error:`, message, details ?? "");
    },
  };

  let caughtError = false;
  try {
    await def.run(args, ctx);
  } catch (err) {
    caughtError = true;
    ctx.logError(err, { phase: "run-top-level" });
  }

  const status =
    caughtError
      ? "failed"
      : stats.errorCount === 0
        ? "success"
        : "partial";

  await prisma.scraperRun.update({
    where: { id: run.id },
    data: {
      finishedAt: new Date(),
      status,
      recordsFetched: stats.recordsFetched,
      recordsUpserted: stats.recordsUpserted,
      errorCount: stats.errorCount,
      errorDetails: errorDetails.length > 0 ? (errorDetails as object) : undefined,
    },
  });

  return { success: !caughtError, runId: run.id, stats };
}
