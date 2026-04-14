import Link from "next/link";
import { notFound } from "next/navigation";
import { getElection } from "@/lib/brain/handlers";
import { CountdownText } from "@/components/elections/CountdownBadge";

export const dynamic = "force-dynamic";

export default async function ElectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const e = await getElection({ electionId: id });
  if (!e) notFound();

  // Group candidacies by post
  const byPost = new Map<string, typeof e.candidacies>();
  for (const c of e.candidacies) {
    const key = c.post.id;
    if (!byPost.has(key)) byPost.set(key, []);
    byPost.get(key)!.push(c);
  }
  const posts = Array.from(byPost.values()).map((candidates) => ({
    post: candidates[0].post,
    candidates,
  }));

  return (
    <div className="max-w-5xl mx-auto w-full px-4 py-6">
      <Link
        href="/elections"
        className="text-xs text-muted hover:text-accent"
      >
        ← All elections
      </Link>
      <div className="mt-2 mb-6">
        <h1 className="text-2xl font-semibold">
          {new Date(e.date).toLocaleDateString(undefined, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            timeZone: "UTC",
          })}
        </h1>
        <p className="text-sm text-muted mt-1">
          {e.jurisdiction.name} · {e.electionType}
          <CountdownText date={e.date.toISOString()} />
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="px-4 py-12 border border-dashed border-card-border rounded text-center">
          <p className="text-sm font-medium mb-1">No candidacies registered</p>
          <p className="text-xs text-muted">
            Ask the agent to populate candidates for this election, or run the
            Ballotpedia scraper and re-invoke the registration flow.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {posts.map(({ post, candidates }) => (
            <section
              key={post.id}
              className="border border-card-border rounded overflow-hidden"
            >
              <div className="px-4 py-3 bg-card-bg/50 border-b border-card-border">
                <div className="text-sm font-semibold">{post.label}</div>
                {post.jurisdiction && (
                  <div className="text-xs text-muted mt-0.5">
                    {post.jurisdiction.name}
                  </div>
                )}
              </div>
              <ul>
                {candidates.map((c) => (
                  <li
                    key={c.id}
                    className="px-4 py-3 border-b border-card-border last:border-0 flex items-start justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">
                        {c.person.givenName}
                        {c.person.middleName ? ` ${c.person.middleName}` : ""}{" "}
                        {c.person.familyName}
                        {c.person.suffix ? ` ${c.person.suffix}` : ""}
                      </div>
                      <div className="text-xs text-muted mt-0.5">
                        {c.person.party || "No party listed"}
                        {c.outcome && c.outcome !== "pending" && (
                          <span className="ml-2">· {c.outcome}</span>
                        )}
                        {c.votesPct != null && (
                          <span className="ml-2">· {c.votesPct.toFixed(1)}%</span>
                        )}
                      </div>
                    </div>
                    <OutcomeBadge outcome={c.outcome} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: string | null }) {
  if (!outcome || outcome === "pending") {
    return (
      <span className="px-2 py-0.5 text-xs rounded bg-card-bg text-muted">
        pending
      </span>
    );
  }
  const color =
    outcome === "won"
      ? "bg-success/20 text-success"
      : outcome === "lost"
      ? "bg-danger/20 text-danger"
      : "bg-muted/20 text-muted";
  return (
    <span className={`px-2 py-0.5 text-xs rounded ${color}`}>{outcome}</span>
  );
}
