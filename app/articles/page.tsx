export default function ArticlesPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold">
        <span className="text-accent">Daily</span> Article
      </h1>
      <p className="mb-8 text-muted">
        AI-generated civic analysis written in Frank&apos;s voice. The most
        interesting thing happening in New Orleans today, explained by someone
        who actually lives here.
      </p>

      <div className="rounded-xl border border-card-border bg-card-bg p-8 text-center">
        <p className="mb-4 text-lg font-semibold">No articles yet</p>
        <p className="text-muted">
          Daily articles will be generated each morning using the latest civic
          data — council decisions, outage stats, displacement updates — and
          written in Frank&apos;s voice.
        </p>
      </div>
    </div>
  );
}
