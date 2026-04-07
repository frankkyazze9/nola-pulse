import { queryKB } from "@/lib/bigquery";

export const dynamic = "force-dynamic";
export const revalidate = 300; // revalidate every 5 minutes

interface StatResult {
  count: number;
}

async function getStats() {
  try {
    const [
      [total311],
      [openPotholes],
      [totalSTR],
      [policeReports],
      [blightCases],
      [demolitions],
      [useOfForce],
      [permits],
    ] = await Promise.all([
      queryKB<StatResult>("SELECT COUNT(*) as count FROM nola_pulse_kb.service_requests_311"),
      queryKB<StatResult>("SELECT COUNT(*) as count FROM nola_pulse_kb.service_requests_311 WHERE request_type LIKE '%Pothole%' AND status != 'Closed'"),
      queryKB<StatResult>("SELECT COUNT(*) as count FROM nola_pulse_kb.str_permits"),
      queryKB<StatResult>("SELECT COUNT(*) as count FROM nola_pulse_kb.police_reports"),
      queryKB<StatResult>("SELECT COUNT(*) as count FROM nola_pulse_kb.blight_cases"),
      queryKB<StatResult>("SELECT COUNT(*) as count FROM nola_pulse_kb.demolitions"),
      queryKB<StatResult>("SELECT COUNT(*) as count FROM nola_pulse_kb.use_of_force"),
      queryKB<StatResult>("SELECT COUNT(*) as count FROM nola_pulse_kb.building_permits"),
    ]);

    return {
      total311: total311?.count || 0,
      openPotholes: openPotholes?.count || 0,
      totalSTR: totalSTR?.count || 0,
      policeReports: policeReports?.count || 0,
      blightCases: blightCases?.count || 0,
      demolitions: demolitions?.count || 0,
      useOfForce: useOfForce?.count || 0,
      permits: permits?.count || 0,
    };
  } catch (err) {
    console.error("BigQuery stats error:", err);
    return null;
  }
}

async function getTopBlightNeighborhoods() {
  try {
    return await queryKB<{ location: string; case_count: number }>(
      `SELECT location, COUNT(*) as case_count
       FROM nola_pulse_kb.blight_cases
       WHERE location IS NOT NULL
       GROUP BY location
       ORDER BY case_count DESC
       LIMIT 5`
    );
  } catch {
    return [];
  }
}

async function getTop311Types() {
  try {
    return await queryKB<{ request_type: string; count: number }>(
      `SELECT request_type, COUNT(*) as count
       FROM nola_pulse_kb.service_requests_311
       WHERE request_type IS NOT NULL
       GROUP BY request_type
       ORDER BY count DESC
       LIMIT 8`
    );
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const [stats, topBlight, top311] = await Promise.all([
    getStats(),
    getTopBlightNeighborhoods(),
    getTop311Types(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold">
        <span className="text-accent">NOLA Pulse</span> Dashboard
      </h1>
      <p className="mb-8 text-muted">
        Real civic data for New Orleans — pulled from city records, not
        press releases.
      </p>

      {stats ? (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="311 Service Requests" value={fmt(stats.total311)} />
            <StatCard label="Open Pothole Complaints" value={fmt(stats.openPotholes)} color="text-warning" />
            <StatCard label="Active STR Licenses" value={fmt(stats.totalSTR)} color="text-danger" />
            <StatCard label="Police Reports" value={fmt(stats.policeReports)} />
            <StatCard label="Blight Cases" value={fmt(stats.blightCases)} color="text-danger" />
            <StatCard label="Demolitions" value={fmt(stats.demolitions)} />
            <StatCard label="Use of Force Incidents" value={fmt(stats.useOfForce)} color="text-danger" />
            <StatCard label="Building Permits" value={fmt(stats.permits)} color="text-success" />
          </div>

          {top311.length > 0 && (
            <div className="mb-8">
              <h2 className="mb-4 text-xl font-semibold">Top 311 Request Types</h2>
              <div className="rounded-xl border border-card-border bg-card-bg">
                {top311.map((item, i) => (
                  <div
                    key={item.request_type}
                    className={`flex items-center justify-between px-4 py-3 ${i !== top311.length - 1 ? "border-b border-card-border" : ""}`}
                  >
                    <span className="text-sm">{item.request_type}</span>
                    <span className="font-mono text-sm font-semibold text-accent">
                      {fmt(item.count)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {topBlight.length > 0 && (
            <div>
              <h2 className="mb-4 text-xl font-semibold">
                Top Blight Locations
              </h2>
              <div className="rounded-xl border border-card-border bg-card-bg">
                {topBlight.map((item, i) => (
                  <div
                    key={item.location}
                    className={`flex items-center justify-between px-4 py-3 ${i !== topBlight.length - 1 ? "border-b border-card-border" : ""}`}
                  >
                    <span className="text-sm">{item.location}</span>
                    <span className="font-mono text-sm font-semibold text-danger">
                      {fmt(item.case_count)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-card-border bg-card-bg p-8 text-center">
          <p className="text-muted">
            Dashboard data loading. Knowledge base is being populated by
            scouts.
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-6">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color || "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}
