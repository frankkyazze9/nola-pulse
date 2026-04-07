import Link from "next/link";

export default function KnowledgeBasePage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8 flex items-center gap-4">
        <Link href="/admin" className="text-muted hover:text-foreground">
          &larr; Command Center
        </Link>
      </div>

      <h1 className="mb-2 text-3xl font-bold">
        <span className="text-accent">Knowledge</span> Base
      </h1>
      <p className="mb-8 text-muted">
        Browse ingested data, check coverage, and manually upload documents.
      </p>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { domain: "Council", table: "council_meetings", icon: "🏛️", desc: "Meeting transcripts, votes, ordinances" },
          { domain: "Energy", table: "outage_timeseries", icon: "⚡", desc: "Entergy outage records by zip/neighborhood" },
          { domain: "Housing", table: "property_sales", icon: "🏘️", desc: "Sales, STR permits, evictions, demolitions" },
          { domain: "Budget", table: "budget_items", icon: "💰", desc: "Line items, contracts, CAFRs" },
          { domain: "News", table: "news_articles", icon: "📰", desc: "Local media articles and press releases" },
          { domain: "Insights", table: "insights", icon: "💡", desc: "AI-generated patterns and anomalies" },
        ].map((d) => (
          <div
            key={d.domain}
            className="rounded-xl border border-card-border bg-card-bg p-6"
          >
            <div className="mb-2 text-2xl">{d.icon}</div>
            <h3 className="mb-1 font-semibold">{d.domain}</h3>
            <p className="mb-3 text-xs text-muted">{d.desc}</p>
            <p className="text-xs text-muted">
              Table: <code className="text-foreground">{d.table}</code>
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-card-border bg-card-bg p-6">
        <h2 className="mb-4 text-lg font-semibold">Manual Upload</h2>
        <p className="mb-4 text-sm text-muted">
          Paste a council transcript or upload a document for AI processing.
        </p>
        <textarea
          placeholder="Paste a council meeting transcript here..."
          rows={8}
          className="mb-4 w-full rounded-lg border border-card-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted"
        />
        <button className="rounded-lg bg-accent px-6 py-2 text-sm font-medium text-background">
          Process with AI
        </button>
      </div>
    </div>
  );
}
