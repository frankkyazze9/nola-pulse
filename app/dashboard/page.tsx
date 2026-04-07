export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold">
        <span className="text-accent">NOLA Pulse</span> Dashboard
      </h1>
      <p className="mb-8 text-muted">
        Real-time civic data for New Orleans. Infrastructure, safety, housing,
        and government — all in one place.
      </p>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Avg Days to Fill Pothole", value: "355", trend: "bad" },
          { label: "2025 Entergy Outages", value: "304,178", trend: "bad" },
          { label: "Drainage Funding Secured", value: "7%", trend: "bad" },
          { label: "STR Ratio (Marigny)", value: "1 in 10", trend: "bad" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-card-border bg-card-bg p-6"
          >
            <p className="text-sm text-muted">{stat.label}</p>
            <p className="mt-1 text-3xl font-bold text-danger">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-xl border border-card-border bg-card-bg p-8 text-center">
        <p className="text-muted">
          Live data feeds and interactive charts coming soon. This dashboard will
          pull real-time data from Entergy, the city council, NOAA, and the city
          budget.
        </p>
      </div>
    </div>
  );
}
