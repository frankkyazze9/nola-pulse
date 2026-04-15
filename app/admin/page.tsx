import Link from "next/link";
import { prisma } from "@/lib/db";
import { getMonthToDateSpend } from "@/lib/spend";

export const dynamic = "force-dynamic";

const SPEND_CEILING_USD = 100;

export default async function AdminPage() {
  const [scraperRuns, sourceCounts, entityCounts, mtdSpend, recentErrors] =
    await Promise.all([
      latestRunPerScraper(),
      docsPerSource(),
      getEntityCounts(),
      getMonthToDateSpend(),
      recentScraperErrors(),
    ]);

  return (
    <div className="max-w-6xl mx-auto w-full px-4 py-6">
      <h1 className="text-2xl font-semibold mb-1">Admin</h1>
      <p className="text-sm text-muted mb-6">
        Data pipeline health, entity volume, month-to-date spend.
      </p>

      <section className="mb-8">
        <h2 className="text-sm uppercase tracking-wider text-muted mb-3 font-semibold">
          Spend
        </h2>
        <div className="px-4 py-3 border border-card-border rounded bg-card-bg/50">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-2xl font-semibold">
              ${mtdSpend.toFixed(2)}
            </span>
            <span className="text-xs text-muted">
              of ${SPEND_CEILING_USD.toFixed(2)} ceiling
            </span>
          </div>
          <div className="h-2 bg-background rounded overflow-hidden">
            <div
              className={`h-full ${
                mtdSpend / SPEND_CEILING_USD > 0.8
                  ? "bg-danger"
                  : mtdSpend / SPEND_CEILING_USD > 0.5
                  ? "bg-warning"
                  : "bg-success"
              }`}
              style={{
                width: `${Math.min(100, (mtdSpend / SPEND_CEILING_USD) * 100).toFixed(1)}%`,
              }}
            />
          </div>
          <p className="text-xs text-muted mt-2">
            <Link
              href="/admin/spend"
              className="text-accent hover:underline"
            >
              Full spend breakdown →
            </Link>
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm uppercase tracking-wider text-muted mb-3 font-semibold">
          Scrapers
        </h2>
        {scraperRuns.length === 0 ? (
          <p className="text-sm text-muted italic">
            No scraper runs recorded yet. Trigger one via{" "}
            <code className="font-mono">POST /api/jobs/scrape/[name]</code>.
          </p>
        ) : (
          <table className="w-full text-sm border border-card-border rounded overflow-hidden">
            <thead className="bg-card-bg/50 text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="text-left px-3 py-2">Scraper</th>
                <th className="text-left px-3 py-2">Last run</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-3 py-2">Fetched</th>
                <th className="text-right px-3 py-2">Upserted</th>
                <th className="text-right px-3 py-2">Errors</th>
              </tr>
            </thead>
            <tbody>
              {scraperRuns.map((r) => (
                <tr
                  key={r.scraperName}
                  className="border-t border-card-border"
                >
                  <td className="px-3 py-2 font-mono">{r.scraperName}</td>
                  <td className="px-3 py-2 text-muted">
                    {r.startedAt ? timeAgo(r.startedAt) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {r.recordsFetched}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {r.recordsUpserted}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-mono ${
                      r.errorCount > 0 ? "text-danger" : "text-muted"
                    }`}
                  >
                    {r.errorCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {recentErrors.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm uppercase tracking-wider text-muted mb-3 font-semibold">
            Recent scraper errors
          </h2>
          <ul className="space-y-2">
            {recentErrors.map((r) => (
              <li
                key={r.id}
                className="px-3 py-2 border border-card-border rounded bg-background text-sm"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs">{r.scraperName}</span>
                  <span className="text-xs text-muted">
                    {timeAgo(r.startedAt)}
                  </span>
                  <StatusBadge status={r.status} />
                </div>
                {r.errorDetails ? (
                  <pre className="text-xs text-muted whitespace-pre-wrap overflow-x-auto">
                    {JSON.stringify(r.errorDetails, null, 2).slice(0, 500)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-8">
        <h2 className="text-sm uppercase tracking-wider text-muted mb-3 font-semibold">
          Documents by source
        </h2>
        {sourceCounts.length === 0 ? (
          <p className="text-sm text-muted italic">
            No documents ingested yet.
          </p>
        ) : (
          <table className="w-full text-sm border border-card-border rounded overflow-hidden">
            <thead className="bg-card-bg/50 text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="text-left px-3 py-2">Source</th>
                <th className="text-right px-3 py-2">Total docs</th>
                <th className="text-right px-3 py-2">Last 7d</th>
                <th className="text-left px-3 py-2">Latest</th>
              </tr>
            </thead>
            <tbody>
              {sourceCounts.map((s) => (
                <tr
                  key={s.sourceSystem}
                  className="border-t border-card-border"
                >
                  <td className="px-3 py-2 font-mono">{s.sourceSystem}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {s.total}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {s.last7d}
                  </td>
                  <td className="px-3 py-2 text-muted">
                    {s.latest ? timeAgo(s.latest) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-sm uppercase tracking-wider text-muted mb-3 font-semibold">
          Entities
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {entityCounts.map((e) => (
            <div
              key={e.label}
              className="px-3 py-3 border border-card-border rounded bg-background"
            >
              <div className="text-2xl font-semibold">{e.count}</div>
              <div className="text-xs text-muted">{e.label}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "success"
      ? "bg-success/20 text-success"
      : status === "running"
      ? "bg-accent/20 text-accent"
      : status === "partial"
      ? "bg-warning/20 text-warning"
      : "bg-danger/20 text-danger";
  return (
    <span
      className={`px-2 py-0.5 text-xs rounded font-semibold uppercase ${cls}`}
    >
      {status}
    </span>
  );
}

function timeAgo(d: Date): string {
  const ms = Date.now() - d.getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

interface ScraperRow {
  scraperName: string;
  startedAt: Date | null;
  status: string;
  recordsFetched: number;
  recordsUpserted: number;
  errorCount: number;
}

async function latestRunPerScraper(): Promise<ScraperRow[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      scraperName: string;
      startedAt: Date;
      status: string;
      recordsFetched: number;
      recordsUpserted: number;
      errorCount: number;
    }>
  >`
    SELECT DISTINCT ON ("scraperName")
      "scraperName", "startedAt", status,
      "recordsFetched", "recordsUpserted", "errorCount"
    FROM "ScraperRun"
    ORDER BY "scraperName", "startedAt" DESC
  `;
  return rows.map((r) => ({
    scraperName: r.scraperName,
    startedAt: r.startedAt,
    status: r.status,
    recordsFetched: Number(r.recordsFetched),
    recordsUpserted: Number(r.recordsUpserted),
    errorCount: Number(r.errorCount),
  }));
}

async function recentScraperErrors() {
  return prisma.scraperRun.findMany({
    where: { OR: [{ status: "failed" }, { status: "partial" }] },
    orderBy: { startedAt: "desc" },
    take: 5,
  });
}

async function docsPerSource(): Promise<
  Array<{ sourceSystem: string; total: number; last7d: number; latest: Date | null }>
> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rows = await prisma.$queryRaw<
    Array<{
      sourceSystem: string;
      total: bigint;
      last7d: bigint;
      latest: Date | null;
    }>
  >`
    SELECT
      "sourceSystem",
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE "collectedAt" >= ${sevenDaysAgo})::bigint AS "last7d",
      MAX("collectedAt") AS latest
    FROM "Document"
    GROUP BY "sourceSystem"
    ORDER BY total DESC
  `;
  return rows.map((r) => ({
    sourceSystem: r.sourceSystem,
    total: Number(r.total),
    last7d: Number(r.last7d),
    latest: r.latest,
  }));
}

async function getEntityCounts(): Promise<Array<{ label: string; count: number }>> {
  const [people, orgs, docs, claims, cases, elections, candidacies, donations] =
    await Promise.all([
      prisma.person.count(),
      prisma.organization.count(),
      prisma.document.count(),
      prisma.claim.count(),
      prisma.case.count(),
      prisma.election.count(),
      prisma.candidacy.count(),
      prisma.donation.count(),
    ]);
  return [
    { label: "people", count: people },
    { label: "organizations", count: orgs },
    { label: "documents", count: docs },
    { label: "claims", count: claims },
    { label: "cases", count: cases },
    { label: "elections", count: elections },
    { label: "candidacies", count: candidacies },
    { label: "donations", count: donations },
  ];
}
