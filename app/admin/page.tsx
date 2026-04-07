export default function AdminPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold">
        <span className="text-accent">Admin</span> Panel
      </h1>
      <p className="mb-8 text-muted">
        Manage data pipelines, review articles, and trigger content generation.
      </p>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            title: "Article Generation",
            description: "Trigger daily article generation, review drafts, publish.",
          },
          {
            title: "Council Ingest",
            description: "Paste council transcripts for AI summarization.",
          },
          {
            title: "Pipeline Status",
            description: "Monitor data pipeline health and last-run times.",
          },
          {
            title: "Infographic Generator",
            description: "Generate comedic infographics from civic data.",
          },
          {
            title: "Forum Moderation",
            description: "Review and manage community suggestions.",
          },
          {
            title: "Data Sources",
            description: "Configure and test external data connections.",
          },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-xl border border-card-border bg-card-bg p-6"
          >
            <h3 className="mb-2 text-lg font-semibold">{item.title}</h3>
            <p className="text-sm text-muted">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
