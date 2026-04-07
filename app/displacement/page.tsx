import { queryKB } from "@/lib/bigquery";

export const dynamic = "force-dynamic";

interface Stat { count: number }
interface NeighborhoodSTR { neighborhood: string; count: number }
interface DemoRecord { address: string; program: string; council_district: string }

async function getData() {
  try {
    const [
      [totalSTR],
      [totalDemos],
      [totalBlight],
      strByNeighborhood,
      recentDemos,
    ] = await Promise.all([
      queryKB<Stat>("SELECT COUNT(*) as count FROM nola_pulse_kb.str_permits"),
      queryKB<Stat>("SELECT COUNT(*) as count FROM nola_pulse_kb.demolitions"),
      queryKB<Stat>("SELECT COUNT(*) as count FROM nola_pulse_kb.blight_cases"),
      queryKB<NeighborhoodSTR>(
        `SELECT neighborhood, COUNT(*) as count FROM nola_pulse_kb.str_permits
         WHERE neighborhood IS NOT NULL GROUP BY neighborhood ORDER BY count DESC LIMIT 10`
      ),
      queryKB<DemoRecord>(
        `SELECT address, program, council_district FROM nola_pulse_kb.demolitions
         WHERE address IS NOT NULL ORDER BY demolition_complete DESC LIMIT 10`
      ),
    ]);
    return {
      totalSTR: totalSTR?.count || 0,
      totalDemos: totalDemos?.count || 0,
      totalBlight: totalBlight?.count || 0,
      strByNeighborhood: strByNeighborhood || [],
      recentDemos: recentDemos || [],
    };
  } catch (err) {
    console.error("Displacement data error:", err);
    return null;
  }
}

export default async function DisplacementPage() {
  const data = await getData();

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold">
        <span className="text-accent">Displacement</span> Tracker
      </h1>
      <p className="mb-10 text-muted">
        Tracking where people are being pushed out of New Orleans — STR
        conversions, demolitions, and the quiet erasure of neighborhoods.
      </p>

      {data ? (
        <>
          <div className="mb-10 grid gap-6 lg:grid-cols-3">
            <div className="rounded-xl border border-card-border bg-card-bg p-6">
              <p className="text-sm text-muted">Active STR Licenses</p>
              <p className="mt-1 text-4xl font-bold text-danger">{data.totalSTR.toLocaleString()}</p>
              <p className="mt-2 text-xs text-muted">Every one is a home not housing a resident</p>
            </div>
            <div className="rounded-xl border border-card-border bg-card-bg p-6">
              <p className="text-sm text-muted">Properties Demolished</p>
              <p className="mt-1 text-4xl font-bold text-warning">{data.totalDemos.toLocaleString()}</p>
              <p className="mt-2 text-xs text-muted">Entire neighborhoods erased from the map</p>
            </div>
            <div className="rounded-xl border border-card-border bg-card-bg p-6">
              <p className="text-sm text-muted">Active Blight Cases</p>
              <p className="mt-1 text-4xl font-bold text-danger">{data.totalBlight.toLocaleString()}</p>
              <p className="mt-2 text-xs text-muted">Properties rotting while the city debates</p>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="mb-2 text-xl font-semibold">STR Concentration by Neighborhood</h2>
              <p className="mb-4 text-xs text-muted">Where tourist rentals are displacing residents</p>
              <div className="rounded-xl border border-card-border bg-card-bg">
                {data.strByNeighborhood.map((n, i) => (
                  <div key={n.neighborhood} className={`flex items-center justify-between px-4 py-3 ${i < data.strByNeighborhood.length - 1 ? "border-b border-card-border" : ""}`}>
                    <span className="text-sm">{n.neighborhood}</span>
                    <div className="flex items-center gap-3">
                      <div className="h-2 rounded-full bg-danger/30" style={{ width: `${Math.max(20, (n.count / data.strByNeighborhood[0].count) * 120)}px` }}>
                        <div className="h-full rounded-full bg-danger" style={{ width: `${(n.count / data.strByNeighborhood[0].count) * 100}%` }} />
                      </div>
                      <span className="font-mono text-sm font-semibold text-danger">{n.count.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="mb-2 text-xl font-semibold">Recent Demolitions</h2>
              <p className="mb-4 text-xs text-muted">Properties recently torn down</p>
              <div className="rounded-xl border border-card-border bg-card-bg">
                {data.recentDemos.map((d, i) => (
                  <div key={`${d.address}-${i}`} className={`px-4 py-3 ${i < data.recentDemos.length - 1 ? "border-b border-card-border" : ""}`}>
                    <p className="text-sm font-medium">{d.address}</p>
                    <p className="text-xs text-muted">{d.program} &middot; District {d.council_district}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-card-border bg-card-bg p-8 text-center text-muted">
          Displacement data loading. Scouts are ingesting housing records.
        </div>
      )}

      <p className="mt-8 text-center text-xs text-muted">
        Data: data.nola.gov — STR licenses, demolition records, blight cases. Updated daily.
      </p>
    </div>
  );
}
