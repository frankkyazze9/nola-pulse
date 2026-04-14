export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <div className="max-w-6xl mx-auto w-full px-4 py-6">
      <h1 className="text-2xl font-semibold mb-2">Admin</h1>
      <p className="text-sm text-muted mb-6">
        Spend, scrapers, entity review, documents. Coming soon.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Placeholder
          title="Spend"
          hint="Month-to-date vs ceiling, per-service breakdown, daily trend."
        />
        <Placeholder
          title="Scrapers"
          hint="Run history, records fetched/upserted, error details."
        />
        <Placeholder
          title="Entity review"
          hint="Splink needs_review queue — approve or reject candidate merges."
        />
        <Placeholder
          title="Documents"
          hint="Ingest volume by source system."
        />
      </div>
    </div>
  );
}

function Placeholder({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="px-4 py-6 border border-dashed border-card-border rounded">
      <p className="text-sm font-medium mb-1">{title}</p>
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}
