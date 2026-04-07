export default function FloodsPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold">
        <span className="text-accent">Flood</span> Predictions
      </h1>
      <p className="mb-8 text-muted">
        Neighborhood-level flood risk powered by NOAA data, pump station status,
        and drainage system reality. Because $939M in needed upgrades with 7%
        funded means you need to know.
      </p>

      <div className="grid gap-6 sm:grid-cols-3">
        {[
          { label: "Drainage Upgrades Needed", value: "$939M" },
          { label: "Funding Secured", value: "7%" },
          { label: "Catch Basin Cleaning", value: "30+ yrs overdue" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-card-border bg-card-bg p-6"
          >
            <p className="text-sm text-muted">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold text-warning">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-card-border bg-card-bg p-8 text-center">
        <p className="text-muted">
          Flood prediction maps and pump station monitoring coming during
          hurricane season (June–November). Data from NOAA/NWS APIs and
          Sewerage & Water Board.
        </p>
      </div>
    </div>
  );
}
