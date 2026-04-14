import Link from "next/link";
import { listObservations } from "@/lib/brain/handlers";

export const dynamic = "force-dynamic";

const TYPES = ["pattern", "hypothesis", "comedy"] as const;
const STATUSES = ["draft", "approved", "rejected", "published"] as const;

export default async function ObservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string }>;
}) {
  const { type, status } = await searchParams;
  const typeFilter = TYPES.includes(type as (typeof TYPES)[number])
    ? (type as (typeof TYPES)[number])
    : undefined;
  const statusFilter = STATUSES.includes(status as (typeof STATUSES)[number])
    ? (status as (typeof STATUSES)[number])
    : undefined;

  const observations = await listObservations({
    type: typeFilter,
    status: statusFilter,
    limit: 100,
  });

  return (
    <div className="max-w-5xl mx-auto w-full px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Observations</h1>
        <p className="text-sm text-muted mt-1">
          Patterns, hypotheses, comedy takes on ingested material —{" "}
          {observations.length} {statusFilter ?? "total"}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <FilterGroup label="Type">
          <FilterLink href={buildHref({ type: undefined, status })} active={!typeFilter}>
            All
          </FilterLink>
          {TYPES.map((t) => (
            <FilterLink
              key={t}
              href={buildHref({ type: t, status })}
              active={typeFilter === t}
            >
              {t}
            </FilterLink>
          ))}
        </FilterGroup>

        <FilterGroup label="Status">
          <FilterLink href={buildHref({ type, status: undefined })} active={!statusFilter}>
            All
          </FilterLink>
          {STATUSES.map((s) => (
            <FilterLink
              key={s}
              href={buildHref({ type, status: s })}
              active={statusFilter === s}
            >
              {s}
            </FilterLink>
          ))}
        </FilterGroup>
      </div>

      {observations.length === 0 ? (
        <div className="px-4 py-12 border border-dashed border-card-border rounded text-center">
          <p className="text-sm font-medium mb-1">No observations yet</p>
          <p className="text-xs text-muted">
            Ask the agent on the Research page: &ldquo;run observations on the last 24 hours&rdquo;, or wait for the nightly cron.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {observations.map((o) => (
            <li
              key={o.id}
              className="px-4 py-3 border border-card-border rounded bg-card-bg/50"
            >
              <div className="flex items-start gap-3 mb-2">
                <TypeBadge type={o.type} />
                {o.topic && (
                  <span className="text-xs text-muted">#{o.topic}</span>
                )}
                <span className="text-xs text-muted ml-auto">
                  {new Date(o.createdAt).toLocaleDateString()}
                </span>
                <StatusBadge status={o.status} />
              </div>
              <p className="text-sm whitespace-pre-wrap">{o.text}</p>
              <div className="text-xs text-muted mt-1">
                Confidence {(o.confidence * 100).toFixed(0)}%
              </div>
              {o.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-card-border">
                  <p className="text-xs text-muted mb-1">Sources:</p>
                  <ul className="space-y-0.5">
                    {o.sources.map((s) => (
                      <li key={s.id} className="text-xs text-muted">
                        <a
                          href={s.document.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:underline"
                        >
                          {s.document.title || s.document.sourceUrl}
                        </a>
                        <span className="ml-1 text-muted/60">
                          [{s.document.sourceSystem}]
                        </span>
                        {s.quote && (
                          <div className="italic mt-0.5">&ldquo;{s.quote}&rdquo;</div>
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
  type,
  status,
}: {
  type?: string;
  status?: string;
}): string {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (status) params.set("status", status);
  const q = params.toString();
  return q ? `/observations?${q}` : "/observations";
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

function TypeBadge({ type }: { type: string }) {
  const color =
    type === "pattern"
      ? "bg-accent/20 text-accent"
      : type === "hypothesis"
      ? "bg-warning/20 text-warning"
      : "bg-success/20 text-success"; // comedy
  return (
    <span className={`px-2 py-0.5 text-xs rounded font-semibold ${color}`}>
      {type}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "published"
      ? "bg-accent/20 text-accent"
      : status === "approved"
      ? "bg-success/20 text-success"
      : status === "rejected"
      ? "bg-danger/20 text-danger"
      : "bg-card-bg text-muted";
  return (
    <span className={`px-2 py-0.5 text-xs rounded ${color}`}>{status}</span>
  );
}
