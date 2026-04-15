import Link from "next/link";
import { notFound } from "next/navigation";
import { getCase, listRisks } from "@/lib/brain/handlers";

export const dynamic = "force-dynamic";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await getCase({ caseId: id });
  if (!c) notFound();

  const risks = await listRisks({
    subjectType: "case",
    subjectId: id,
    status: "active",
    limit: 20,
  });

  const evidenceByRole = {
    primary_source: c.evidence.filter((e) => e.role === "primary_source"),
    supporting: c.evidence.filter((e) => e.role === "supporting"),
    contradicting: c.evidence.filter((e) => e.role === "contradicting"),
    background: c.evidence.filter((e) => e.role === "background"),
  };

  return (
    <div className="max-w-5xl mx-auto w-full px-4 py-6">
      <div className="mb-6">
        <Link
          href="/cases"
          className="text-xs text-muted hover:text-accent"
        >
          ← All cases
        </Link>
        <div className="flex items-start justify-between gap-4 mt-2">
          <h1 className="text-2xl font-semibold">{c.title}</h1>
          <span
            className={`px-2 py-0.5 text-xs rounded ${
              c.status === "active"
                ? "bg-success/20 text-success"
                : c.status === "published"
                ? "bg-accent/20 text-accent"
                : "bg-muted/20 text-muted"
            }`}
          >
            {c.status}
          </span>
        </div>
        <p className="text-xs text-muted mt-1">
          Created {new Date(c.createdAt).toLocaleString()} · Updated{" "}
          {new Date(c.updatedAt).toLocaleString()}
        </p>
      </div>

      <Section title="Brief">
        <p className="text-sm whitespace-pre-wrap">{c.brief}</p>
      </Section>

      <Section title={`Risk (${risks.length})`}>
        {risks.length === 0 ? (
          <p className="text-sm text-muted italic">
            No risk assessments yet. Ask the agent: &ldquo;assess risk on this case&rdquo;.
          </p>
        ) : (
          <ul className="space-y-2">
            {risks.map((r) => (
              <li
                key={r.id}
                className="px-3 py-2 border border-card-border rounded bg-background text-sm"
              >
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span
                    className={`px-2 py-0.5 text-xs rounded font-semibold uppercase ${
                      r.severity === "critical"
                        ? "bg-danger text-white"
                        : r.severity === "high"
                        ? "bg-danger/20 text-danger"
                        : r.severity === "medium"
                        ? "bg-warning/20 text-warning"
                        : "bg-muted/20 text-muted"
                    }`}
                  >
                    {r.severity}
                  </span>
                  <span className="text-xs uppercase tracking-wider text-muted">
                    {r.riskType.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="font-medium">{r.summary}</p>
                {r.description && (
                  <p className="text-muted mt-1 whitespace-pre-wrap">
                    {r.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {c.findings ? (
        <Section title="Findings">
          <pre className="text-xs bg-card-bg/50 border border-card-border rounded p-3 overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(c.findings, null, 2)}
          </pre>
        </Section>
      ) : (
        <Section title="Findings">
          <p className="text-sm text-muted italic">
            No findings yet. Ask the agent to populate them.
          </p>
        </Section>
      )}

      <Section title={`Evidence (${c.evidence.length})`}>
        {c.evidence.length === 0 ? (
          <p className="text-sm text-muted italic">
            No evidence attached yet.
          </p>
        ) : (
          <div className="space-y-4">
            {(Object.keys(evidenceByRole) as Array<keyof typeof evidenceByRole>).map(
              (role) =>
                evidenceByRole[role].length > 0 && (
                  <div key={role}>
                    <h3 className="text-xs uppercase tracking-wider text-muted mb-2">
                      {role.replace("_", " ")} ({evidenceByRole[role].length})
                    </h3>
                    <ul className="space-y-1">
                      {evidenceByRole[role].map((e) => (
                        <EvidenceItem key={e.id} evidence={e} />
                      ))}
                    </ul>
                  </div>
                )
            )}
          </div>
        )}
      </Section>

      {c.outputDraft && (
        <Section title="Draft">
          <div className="prose prose-sm max-w-none border border-card-border rounded p-4 bg-card-bg/50">
            <pre className="whitespace-pre-wrap text-sm font-sans">
              {c.outputDraft}
            </pre>
          </div>
        </Section>
      )}
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

interface EvidenceItemData {
  id: string;
  note: string | null;
  document: { id: string; title: string | null; sourceUrl: string; sourceSystem: string; publishedAt: Date | null } | null;
  claim: { id: string; predicate: string; objectText: string; confidence: number } | null;
  person: { id: string; givenName: string; familyName: string } | null;
  organization: { id: string; name: string; orgType: string } | null;
}

function EvidenceItem({ evidence }: { evidence: EvidenceItemData }) {
  const { document, claim, person, organization, note } = evidence;
  return (
    <li className="px-3 py-2 border border-card-border rounded bg-background text-sm">
      {document && (
        <div>
          <a
            href={document.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            {document.title || document.sourceUrl}
          </a>
          <span className="text-xs text-muted ml-2">
            [{document.sourceSystem}]
            {document.publishedAt &&
              ` · ${new Date(document.publishedAt).toLocaleDateString()}`}
          </span>
        </div>
      )}
      {claim && (
        <div>
          <span className="text-xs text-muted">claim:</span>{" "}
          <span>
            {claim.predicate} — {claim.objectText}
          </span>
          <span className="text-xs text-muted ml-2">
            ({(claim.confidence * 100).toFixed(0)}% confidence)
          </span>
        </div>
      )}
      {person && (
        <div>
          <span className="text-xs text-muted">person:</span>{" "}
          {person.givenName} {person.familyName}
        </div>
      )}
      {organization && (
        <div>
          <span className="text-xs text-muted">org:</span> {organization.name}
          <span className="text-xs text-muted ml-1">({organization.orgType})</span>
        </div>
      )}
      {note && <p className="text-xs text-muted mt-1">{note}</p>}
    </li>
  );
}
