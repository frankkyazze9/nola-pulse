export default function CouncilPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold">
        <span className="text-accent">Council</span> Whisperer
      </h1>
      <p className="mb-8 text-muted">
        AI-generated summaries of New Orleans City Council meetings. What they
        decided, how they voted, and what it means for you — in plain language.
      </p>

      <div className="rounded-xl border border-card-border bg-card-bg p-8 text-center">
        <p className="mb-4 text-lg font-semibold">No meetings summarized yet</p>
        <p className="text-muted">
          Council meeting transcripts will be ingested and summarized by AI.
          Each summary includes key decisions, votes, public comment highlights,
          and what to watch.
        </p>
      </div>
    </div>
  );
}
