import { queryKB } from "@/lib/bigquery";

export const dynamic = "force-dynamic";

interface Stat { count: number }

async function getData() {
  try {
    const [
      [drainageComplaints],
      [totalBlight],
    ] = await Promise.all([
      queryKB<Stat>(
        `SELECT COUNT(*) as count FROM nola_pulse_kb.service_requests_311
         WHERE LOWER(request_type) LIKE '%drain%' OR LOWER(request_type) LIKE '%flood%' OR LOWER(request_type) LIKE '%water%'`
      ),
      queryKB<Stat>("SELECT COUNT(*) as count FROM nola_pulse_kb.blight_cases"),
    ]);
    return {
      drainageComplaints: drainageComplaints?.count || 0,
      totalBlight: totalBlight?.count || 0,
    };
  } catch (err) {
    console.error("Flood data error:", err);
    return null;
  }
}

export default async function FloodsPage() {
  const data = await getData();

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold">
        <span className="text-accent">Flood</span> Predictions
      </h1>
      <p className="mb-10 text-muted">
        The drainage system needs $939 million in upgrades. Only 7% of funding
        is secured. Catch basins haven&apos;t been cleaned in over 30 years. These
        are the numbers nobody in City Hall wants to talk about.
      </p>

      <div className="mb-10 grid gap-6 sm:grid-cols-3">
        <div className="rounded-xl border border-card-border bg-card-bg p-6">
          <p className="text-sm text-muted">Drainage Upgrades Needed</p>
          <p className="mt-1 text-4xl font-bold text-danger">$939M</p>
          <p className="mt-2 text-xs text-muted">Total cost to fix the drainage system</p>
        </div>
        <div className="rounded-xl border border-card-border bg-card-bg p-6">
          <p className="text-sm text-muted">Funding Secured</p>
          <p className="mt-1 text-4xl font-bold text-danger">7%</p>
          <p className="mt-2 text-xs text-muted">$66M of $939M — 93% unfunded</p>
        </div>
        <div className="rounded-xl border border-card-border bg-card-bg p-6">
          <p className="text-sm text-muted">Catch Basin Cleaning</p>
          <p className="mt-1 text-4xl font-bold text-warning">30+ years</p>
          <p className="mt-2 text-xs text-muted">Since the last systematic cleaning</p>
        </div>
      </div>

      {data && data.drainageComplaints > 0 && (
        <div className="mb-10">
          <div className="rounded-xl border border-card-border bg-card-bg p-6">
            <p className="text-sm text-muted">Drainage / Flooding 311 Complaints (Last 30 Days)</p>
            <p className="mt-1 text-3xl font-bold text-warning">{data.drainageComplaints.toLocaleString()}</p>
            <p className="mt-2 text-xs text-muted">Residents reporting drainage issues, flooding, and standing water</p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-card-border bg-card-bg p-8">
        <h2 className="mb-4 text-xl font-semibold">What&apos;s Coming</h2>
        <p className="mb-4 text-sm text-muted">
          The Flood Prediction system will pull data from NOAA/NWS APIs and
          Sewerage &amp; Water Board pump station reports every 6 hours during
          hurricane season (June–November). Neighborhood-level flood risk maps
          based on elevation, drainage capacity, and pump station status.
        </p>
        <p className="text-sm text-muted">
          When it rains in New Orleans, some neighborhoods flood and others
          don&apos;t — and the difference isn&apos;t random. It&apos;s infrastructure
          investment. This tool will make that visible.
        </p>
      </div>

      <p className="mt-8 text-center text-xs text-muted">
        Stats: City infrastructure reports, 311 data from data.nola.gov. NOAA integration coming June 2026.
      </p>
    </div>
  );
}
