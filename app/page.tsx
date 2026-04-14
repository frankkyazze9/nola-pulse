import Link from "next/link";
import { listCases, listProjects } from "@/lib/brain/handlers";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [cases, projects] = await Promise.all([
    listCases({ status: "active", limit: 10 }).catch(() => []),
    listProjects({ status: "active", limit: 10 }).catch(() => []),
  ]);

  return (
    <div className="max-w-6xl mx-auto w-full px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted mt-1">
          Active investigations and projects.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cases */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Active Cases</h2>
            <Link
              href="/cases"
              className="text-sm text-accent hover:underline"
            >
              All cases →
            </Link>
          </div>
          {cases.length === 0 ? (
            <EmptyCard
              title="No active cases"
              hint="Head to Research and describe an investigation you want to run. The agent will create a case for you."
              href="/research"
              cta="Start a case"
            />
          ) : (
            <ul className="space-y-2">
              {cases.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/cases/${c.id}`}
                    className="block px-3 py-2 border border-card-border rounded bg-card-bg/50 hover:bg-card-bg transition-colors"
                  >
                    <div className="text-sm font-medium">{c.title}</div>
                    <div className="text-xs text-muted mt-0.5">
                      {new Date(c.updatedAt).toLocaleDateString()} · {c.status}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Projects */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Active Projects</h2>
            <Link
              href="/projects"
              className="text-sm text-accent hover:underline"
            >
              All projects →
            </Link>
          </div>
          {projects.length === 0 ? (
            <EmptyCard
              title="No active projects"
              hint="Projects are for campaigns and brand work. Ask the agent to start one."
              href="/research"
              cta="Start a project"
            />
          ) : (
            <ul className="space-y-2">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/projects/${p.id}`}
                    className="block px-3 py-2 border border-card-border rounded bg-card-bg/50 hover:bg-card-bg transition-colors"
                  >
                    <div className="text-sm font-medium">{p.title}</div>
                    <div className="text-xs text-muted mt-0.5">
                      {p.kind}
                      {p.subjectPerson &&
                        ` · ${p.subjectPerson.givenName} ${p.subjectPerson.familyName}`}
                      {p.subjectOrg && ` · ${p.subjectOrg.name}`}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold mb-3">Quick actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <QuickAction href="/research" label="Ask the agent" />
          <QuickAction href="/cases" label="Browse cases" />
          <QuickAction href="/projects" label="Browse projects" />
          <QuickAction href="/admin" label="Admin" />
        </div>
      </section>
    </div>
  );
}

function EmptyCard({
  title,
  hint,
  href,
  cta,
}: {
  title: string;
  hint: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="px-4 py-6 border border-dashed border-card-border rounded text-center">
      <p className="text-sm font-medium mb-1">{title}</p>
      <p className="text-xs text-muted mb-3">{hint}</p>
      <Link
        href={href}
        className="inline-block px-3 py-1.5 text-xs font-medium bg-accent text-white rounded hover:bg-accent-hover transition-colors"
      >
        {cta}
      </Link>
    </div>
  );
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block px-3 py-3 text-sm text-center border border-card-border rounded bg-card-bg/30 hover:bg-card-bg transition-colors"
    >
      {label}
    </Link>
  );
}
