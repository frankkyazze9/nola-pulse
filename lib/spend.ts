/**
 * Dark Horse spend tracking.
 *
 * All third-party API costs (Claude, Google Document AI) flow through
 * `logSpend()` which writes an `ApiSpendLog` row and returns the computed cost
 * in USD. `getMonthToDateSpend()` powers the hard-cap enforcement in
 * `lib/claude/spend.ts` and the `/admin/spend` dashboard.
 *
 * See `.claude/skills/cost-discipline/SKILL.md` for the $100/mo budget rules.
 */

import { prisma } from "./db";

// 2026 approximate pricing per million tokens. Update when pricing changes.
const CLAUDE_PRICING = {
  claude_haiku: { input: 0.8, cachedInput: 0.08, output: 4.0 },
  claude_sonnet: { input: 3.0, cachedInput: 0.3, output: 15.0 },
  claude_opus: { input: 15.0, cachedInput: 1.5, output: 75.0 },
} as const;

const DOC_AI_PER_THOUSAND_PAGES_USD = 1.5;

export const SPEND_CAPS = {
  /** Hard monthly ceiling — above this, Claude calls are rejected. */
  monthlyHardCap: 100,
  /** Soft cap — above this, Sonnet/Opus calls downgrade to Haiku. */
  sonnetSoftCap: 95,
} as const;

export type Service =
  | "claude_haiku"
  | "claude_sonnet"
  | "claude_opus"
  | "documentai"
  | "gcs"
  | "cloud_sql"
  | "cloud_run"
  | "embed"
  | "other";

export type Operation = string;

export interface SpendUsage {
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  pagesProcessed?: number;
}

export function computeCost(service: Service, usage: SpendUsage): number {
  if (
    service === "claude_haiku" ||
    service === "claude_sonnet" ||
    service === "claude_opus"
  ) {
    const pricing = CLAUDE_PRICING[service];
    return (
      ((usage.inputTokens ?? 0) / 1_000_000) * pricing.input +
      ((usage.cachedInputTokens ?? 0) / 1_000_000) * pricing.cachedInput +
      ((usage.outputTokens ?? 0) / 1_000_000) * pricing.output
    );
  }
  if (service === "documentai") {
    return ((usage.pagesProcessed ?? 0) / 1000) * DOC_AI_PER_THOUSAND_PAGES_USD;
  }
  // Cloud Run / GCS / Cloud SQL / embed are billed by GCP and aren't tracked here.
  return 0;
}

export async function logSpend(params: {
  service: Service;
  operation: Operation;
  usage: SpendUsage;
  metadata?: Record<string, unknown>;
}): Promise<{ costUsd: number }> {
  const costUsd = computeCost(params.service, params.usage);
  await prisma.apiSpendLog.create({
    data: {
      service: params.service,
      operation: params.operation,
      inputTokens: params.usage.inputTokens,
      cachedInputTokens: params.usage.cachedInputTokens,
      outputTokens: params.usage.outputTokens,
      pagesProcessed: params.usage.pagesProcessed,
      // Prisma's Decimal field accepts number | string | Prisma.Decimal.
      costUsd: costUsd.toFixed(5) as unknown as number,
      metadata: params.metadata as object | undefined,
    },
  });
  return { costUsd };
}

export async function getMonthToDateSpend(): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const result = await prisma.apiSpendLog.aggregate({
    where: { loggedAt: { gte: startOfMonth } },
    _sum: { costUsd: true },
  });
  return Number(result._sum.costUsd ?? 0);
}

export async function getMonthToDateSpendByService(): Promise<Record<string, number>> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const rows = await prisma.apiSpendLog.groupBy({
    by: ["service"],
    where: { loggedAt: { gte: startOfMonth } },
    _sum: { costUsd: true },
  });
  return Object.fromEntries(rows.map((r) => [r.service, Number(r._sum.costUsd ?? 0)]));
}
