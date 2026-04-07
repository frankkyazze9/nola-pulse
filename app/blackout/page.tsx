export default function BlackoutPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold">
        <span className="text-accent">Blackout</span> Prediction
      </h1>
      <p className="mb-8 text-muted">
        Predicting power outages before Entergy tells you. Built on historical
        outage data, weather patterns, and infrastructure age.
      </p>

      <div className="grid gap-6 sm:grid-cols-3">
        {[
          { label: "2025 Customer Outages", value: "304,178" },
          { label: "Memorial Day 2025", value: "100,000+" },
          { label: "Proposed Fee Increase", value: "$400M" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-card-border bg-card-bg p-6"
          >
            <p className="text-sm text-muted">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold text-danger">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-card-border bg-card-bg p-8 text-center">
        <p className="text-muted">
          Outage prediction model coming soon. Will scrape Entergy outage data
          every 30 minutes during storm season and build historical patterns by
          zip code and neighborhood.
        </p>
      </div>
    </div>
  );
}
