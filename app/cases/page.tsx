import Link from "next/link";
import { listCases } from "@/lib/brain/handlers";

export const dynamic = "force-dynamic";

const STATUSES = ["active", "paused", "closed", "published"] as const;

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = status && STATUSES.includes(status as (typeof STATUSES)[number]) ? status : undefined;
  const cases = await listCases({ status: filter, limit: 100 });

  return (
    <div className="max-w-6xl mx-auto w-full px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Cases</h1>
          <p className="text-sm text-muted mt-1">
            Investigations — {cases.length} {filter ?? "total"}
          </p>
        </div>
        <Link
          href="/research"
          className="px-3 py-1.5 text-sm font-medium bg-accent text-white rounded hover:bg-accent-hover transition-colors"
        >
          + New case
        </Link>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        <FilterLink href="/cases" active={!filter}>
          All
        </FilterLink>
        {STATUSES.map((s) => (
          <FilterLink
            key={s}
            href={`/cases?status=${s}`}
            active={filter === s}
          >
            {s}
          </FilterLink>
        ))}
      </div>

      {cases.length === 0 ? (
        <div className="px-4 py-12 border border-dashed border-card-border rounded text-center">
          <p className="text-sm font-medium mb-1">No cases yet</p>
          <p className="text-xs text-muted">
            Ask the agent on the Research page to start an investigation.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {cases.map((c) => (
            <li key={c.id}>
              <Link
                href={`/cases/${c.id}`}
                className="block px-4 py-3 border border-card-border rounded bg-card-bg/50 hover:bg-card-bg transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.title}</div>
                    <div className="text-xs text-muted mt-1">
                      Updated {new Date(c.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
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
      className={`px-3 py-1 text-xs rounded whitespace-nowrap transition-colors ${
        active ? "bg-accent text-white" : "text-muted hover:bg-card-bg"
      }`}
    >
      {children}
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "active"
      ? "bg-success/20 text-success"
      : status === "published"
      ? "bg-accent/20 text-accent"
      : status === "closed"
      ? "bg-muted/20 text-muted"
      : "bg-warning/20 text-warning";
  return (
    <span className={`px-2 py-0.5 text-xs rounded ${color}`}>{status}</span>
  );
}
