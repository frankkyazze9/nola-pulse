import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject } from "@/lib/brain/handlers";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await getProject({ projectId: id });
  if (!p) notFound();

  return (
    <div className="max-w-5xl mx-auto w-full px-4 py-6">
      <div className="mb-6">
        <Link href="/projects" className="text-xs text-muted hover:text-accent">
          ← All projects
        </Link>
        <div className="flex items-start justify-between gap-4 mt-2">
          <div>
            <h1 className="text-2xl font-semibold">{p.title}</h1>
            <p className="text-xs text-muted mt-1">
              {p.kind}
              {p.subjectPerson &&
                ` · ${p.subjectPerson.givenName} ${p.subjectPerson.familyName}`}
              {p.subjectOrg && ` · ${p.subjectOrg.name}`}
            </p>
          </div>
          <span
            className={`px-2 py-0.5 text-xs rounded ${
              p.status === "active"
                ? "bg-success/20 text-success"
                : p.status === "closed"
                ? "bg-muted/20 text-muted"
                : "bg-warning/20 text-warning"
            }`}
          >
            {p.status}
          </span>
        </div>
      </div>

      {p.subjectPerson && (
        <Section title="Subject">
          <div className="px-3 py-2 border border-card-border rounded bg-card-bg/50">
            <div className="text-sm font-medium">
              {p.subjectPerson.givenName} {p.subjectPerson.middleName}{" "}
              {p.subjectPerson.familyName}
            </div>
            {p.subjectPerson.party && (
              <div className="text-xs text-muted">
                Party: {p.subjectPerson.party}
              </div>
            )}
            {p.subjectPerson.bio && (
              <p className="text-xs text-muted mt-1">{p.subjectPerson.bio}</p>
            )}
          </div>
        </Section>
      )}

      <JsonSection title="Goals" data={p.goals} />
      <JsonSection title="Brand analysis" data={p.brandAnalysis} />
      <JsonSection title="Influencer map" data={p.influencerMap} />
      <JsonSection title="Growth plan" data={p.growthPlan} />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-sm uppercase tracking-wider text-muted mb-3 font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function JsonSection({ title, data }: { title: string; data: unknown }) {
  return (
    <Section title={title}>
      {data ? (
        <pre className="text-xs bg-card-bg/50 border border-card-border rounded p-3 overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : (
        <p className="text-sm text-muted italic">
          Not yet populated. Ask the agent to build this out.
        </p>
      )}
    </Section>
  );
}
