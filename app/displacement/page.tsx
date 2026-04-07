export default function DisplacementPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold">
        <span className="text-accent">Displacement</span> Tracker
      </h1>
      <p className="mb-8 text-muted">
        Tracking where people are being pushed out of New Orleans — STR
        conversions, evictions, demolitions, and the quiet erasure of
        neighborhoods.
      </p>

      <div className="grid gap-6 sm:grid-cols-3">
        {[
          { label: "Marigny STR Ratio", value: "1 in 10 homes" },
          { label: "Housing Trust Fund", value: "~$17M/yr (2026)" },
          { label: "IZ Affordable Units Built", value: "0" },
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
          Interactive displacement map coming soon. Will overlay STR permits,
          property sales, eviction filings, and demolition permits by
          neighborhood with Leaflet + OpenStreetMap.
        </p>
      </div>
    </div>
  );
}
