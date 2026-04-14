import Link from "next/link";
import { listElections } from "@/lib/brain/handlers";
import CountdownBadge from "@/components/elections/CountdownBadge";

export const dynamic = "force-dynamic";

export default async function ElectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const upcoming = filter !== "past";
  const elections = await listElections({ upcoming, limit: 100 });

  return (
    <div className="max-w-6xl mx-auto w-full px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Elections</h1>
        <p className="text-sm text-muted mt-1">
          Louisiana and New Orleans races — {elections.length}{" "}
          {upcoming ? "upcoming" : "past"}
        </p>
      </div>

      <div className="flex gap-2 mb-4">
        <FilterLink href="/elections" active={upcoming}>
          Upcoming
        </FilterLink>
        <FilterLink href="/elections?filter=past" active={!upcoming}>
          Past
        </FilterLink>
      </div>

      {elections.length === 0 ? (
        <div className="px-4 py-12 border border-dashed border-card-border rounded text-center">
          <p className="text-sm font-medium mb-1">
            No {upcoming ? "upcoming" : "past"} elections
          </p>
          <p className="text-xs text-muted">
            Ask the agent on the Research page to register an election, or run
            the Ballotpedia scraper to ingest previews.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {elections.map((e) => {
            const candidateCount = e.candidacies.length;
            const postCount = new Set(e.candidacies.map((c) => c.post.ocdId)).size;
            return (
              <li key={e.id}>
                <Link
                  href={`/elections/${e.id}`}
                  className="block px-4 py-3 border border-card-border rounded bg-card-bg/50 hover:bg-card-bg transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">
                        {new Date(e.date).toLocaleDateString(undefined, {
                          weekday: "short",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          timeZone: "UTC",
                        })}
                        <span className="ml-2 text-muted font-normal">
                          {e.jurisdiction.name} · {e.electionType}
                        </span>
                      </div>
                      <div className="text-xs text-muted mt-1">
                        {postCount} race{postCount === 1 ? "" : "s"} ·{" "}
                        {candidateCount} candidate
                        {candidateCount === 1 ? "" : "s"}
                      </div>
                    </div>
                    <CountdownBadge date={e.date.toISOString()} />
                  </div>
                </Link>
              </li>
            );
          })}
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
