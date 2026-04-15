import Link from "next/link";
import { listRisks } from "@/lib/brain/handlers";

export const dynamic = "force-dynamic";

const SEVERITIES = ["critical", "high", "medium", "low"] as const;
const STATUSES = ["active", "watching", "resolved", "dismissed"] as const;

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export default async function RisksPage({
  searchParams,
}: {
  searchParams: Promise<{ severity?: string; status?: string }>;
}) {
  const { severity, status } = await searchParams;
  const sevFilter = SEVERITIES.includes(severity as (typeof SEVERITIES)[number])
    ? severity
    : undefined;
  const statusFilter = STATUSES.includes(status as (typeof STATUSES)[number])
    ? status
    : "active";

  const risks = await listRisks({
    severity: sevFilter,
    status: statusFilter,
    limit: 200,
  });

  // Sort by severity order
  risks.sort(
    (a, b) =>
      (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
  );

  return (
    <div className="max-w-5xl mx-auto w-full px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Risks</h1>
        <p className="text-sm text-muted mt-1">
          Structured risk assessments across persons, orgs, cases, projects —{" "}
          {risks.length} {statusFilter}
        </p>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <FilterGroup label="Severity">
          <FilterLink href={buildHref({ severity: undefined, status })} active={!sevFilter}>
            All
          </FilterLink>
          {SEVERITIES.map((s) => (
            <FilterLink
              key={s}
              href={buildHref({ severity: s, status })}
              active={sevFilter === s}
            >
              {s}
            </FilterLink>
          ))}
        </FilterGroup>

        <FilterGroup label="Status">
          {STATUSES.map((s) => (
            <FilterLink
              key={s}
              href={buildHref({ severity, status: s })}
              active={statusFilter === s}
            >
              {s}
            </FilterLink>
          ))}
        </FilterGroup>
      </div>

      {risks.length === 0 ? (
        <div className="px-4 py-12 border border-dashed border-card-border rounded text-center">
          <p className="text-sm font-medium mb-1">No risks recorded</p>
          <p className="text-xs text-muted">
            Ask the agent to assess risk on a case, person, or project.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {risks.map((r) => (
            <li
              key={r.id}
              className="px-4 py-3 border border-card-border rounded bg-card-bg/50"
            >
              <div className="flex items-start gap-3 mb-2 flex-wrap">
                <SeverityBadge severity={r.severity} />
                <span className="text-xs uppercase tracking-wider text-muted">
                  {r.riskType.replace(/_/g, " ")}
                </span>
                <span className="text-xs text-muted">
                  {r.subjectType}:{r.subjectId.slice(-6)}
                </span>
                <span className="text-xs text-muted ml-auto">
                  {new Date(r.updatedAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm font-medium">{r.summary}</p>
              {r.description && (
                <p className="text-sm text-muted mt-1 whitespace-pre-wrap">
                  {r.description}
                </p>
              )}
              <div className="text-xs text-muted mt-1">
                Confidence {(r.confidence * 100).toFixed(0)}%
              </div>
              {r.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-card-border">
                  <p className="text-xs text-muted mb-1">Sources:</p>
                  <ul className="space-y-0.5">
                    {r.sources.slice(0, 4).map((s) => (
                      <li key={s.id} className="text-xs text-muted">
                        {s.document ? (
                          <a
                            href={s.document.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent hover:underline"
                          >
                            {s.document.title || s.document.sourceUrl}
                          </a>
                        ) : (
                          <span>(source)</span>
                        )}
                        {s.quote && (
                          <div className="italic mt-0.5">
                            &ldquo;{s.quote}&rdquo;
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function buildHref({
  severity,
  status,
}: {
  severity?: string;
  status?: string;
}): string {
  const params = new URLSearchParams();
  if (severity) params.set("severity", severity);
  if (status && status !== "active") params.set("status", status);
  const q = params.toString();
  return q ? `/risks?${q}` : "/risks";
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted uppercase tracking-wider">
        {label}:
      </span>
      <div className="flex gap-1">{children}</div>
    </div>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-2 py-1 text-xs rounded whitespace-nowrap transition-colors ${
        active ? "bg-accent text-white" : "text-muted hover:bg-card-bg"
      }`}
    >
      {children}
    </Link>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const color =
    severity === "critical"
      ? "bg-danger text-white"
      : severity === "high"
      ? "bg-danger/20 text-danger"
      : severity === "medium"
      ? "bg-warning/20 text-warning"
      : "bg-muted/20 text-muted";
  return (
    <span className={`px-2 py-0.5 text-xs rounded font-semibold uppercase ${color}`}>
      {severity}
    </span>
  );
}
