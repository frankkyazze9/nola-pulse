import { queryKB } from "@/lib/bigquery";

export const dynamic = "force-dynamic";

interface Stat { count: number }
interface TypeCount { request_type: string; count: number }

async function getData() {
  try {
    const [
      [powerRequests],
      [streetlightRequests],
      [totalBlight],
    ] = await Promise.all([
      queryKB<Stat>(
        `SELECT COUNT(*) as count FROM nola_pulse_kb.service_requests_311
         WHERE LOWER(request_type) LIKE '%electric%' OR LOWER(request_type) LIKE '%power%' OR LOWER(request_type) LIKE '%entergy%'`
      ),
      queryKB<Stat>(
        `SELECT COUNT(*) as count FROM nola_pulse_kb.service_requests_311
         WHERE LOWER(request_type) LIKE '%streetlight%' OR LOWER(request_type) LIKE '%street light%'`
      ),
      queryKB<Stat>("SELECT COUNT(*) as count FROM nola_pulse_kb.blight_cases"),
    ]);
    return {
      powerRequests: powerRequests?.count || 0,
      streetlightRequests: streetlightRequests?.count || 0,
      totalBlight: totalBlight?.count || 0,
    };
  } catch (err) {
    console.error("Blackout data error:", err);
    return null;
  }
}

export default async function BlackoutPage() {
  const data = await getData();

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold">
        <span className="text-accent">Blackout</span> Prediction
      </h1>
      <p className="mb-10 text-muted">
        Entergy recorded 304,178 customer outages in 2025 — the highest since
        2017. On Memorial Day alone, over 100,000 customers lost power without
        warning. Now they want $400M more in customer fees.
      </p>

      <div className="mb-10 grid gap-6 sm:grid-cols-3">
        <div className="rounded-xl border border-card-border bg-card-bg p-6">
          <p className="text-sm text-muted">2025 Customer Outages</p>
          <p className="mt-1 text-4xl font-bold text-danger">304,178</p>
          <p className="mt-2 text-xs text-muted">Highest since 2017 — Entergy data</p>
        </div>
        <div className="rounded-xl border border-card-border bg-card-bg p-6">
          <p className="text-sm text-muted">Memorial Day 2025</p>
          <p className="mt-1 text-4xl font-bold text-danger">100,000+</p>
          <p className="mt-2 text-xs text-muted">Customers lost power — no warning</p>
        </div>
        <div className="rounded-xl border border-card-border bg-card-bg p-6">
          <p className="text-sm text-muted">Proposed Fee Increase</p>
          <p className="mt-1 text-4xl font-bold text-warning">$400M</p>
          <p className="mt-2 text-xs text-muted">Entergy wants customers to pay more</p>
        </div>
      </div>

      {data && (
        <div className="mb-10 grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-card-border bg-card-bg p-6">
            <p className="text-sm text-muted">Streetlight Complaints (311)</p>
            <p className="mt-1 text-3xl font-bold text-warning">{data.streetlightRequests.toLocaleString()}</p>
            <p className="mt-2 text-xs text-muted">Broken streetlights reported by residents in the last 30 days</p>
          </div>
          <div className="rounded-xl border border-card-border bg-card-bg p-6">
            <p className="text-sm text-muted">Power/Electrical Complaints (311)</p>
            <p className="mt-1 text-3xl font-bold text-warning">{data.powerRequests.toLocaleString()}</p>
            <p className="mt-2 text-xs text-muted">Electrical issues reported by residents</p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-card-border bg-card-bg p-8">
        <h2 className="mb-4 text-xl font-semibold">What&apos;s Coming</h2>
        <p className="mb-4 text-sm text-muted">
          The Blackout Prediction model will scrape Entergy&apos;s outage tracker
          every 30 minutes during storm season and build historical patterns by
          zip code and neighborhood. The goal: predict outages before Entergy
          tells you.
        </p>
        <p className="text-sm text-muted">
          Combined with weather data from NOAA and infrastructure age data, this
          will be the first public tool that tells New Orleans residents their
          actual outage risk — not the sanitized version Entergy gives the City
          Council.
        </p>
      </div>

      <p className="mt-8 text-center text-xs text-muted">
        Stats: Entergy public filings, 311 data from data.nola.gov. Prediction model in development.
      </p>
    </div>
  );
}
