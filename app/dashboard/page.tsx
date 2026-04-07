import { queryKB } from "@/lib/bigquery";

export const dynamic = "force-dynamic";

interface Stat { count: number }
interface TypeCount { request_type: string; count: number }
interface NeighborhoodCount { neighborhood: string; count: number }
interface CrimeType { signal_description: string; count: number }

async function getDashboardData() {
  try {
    const [
      [total311],
      [totalSTR],
      [totalPolice],
      [totalBlight],
      [totalDemos],
      [totalUOF],
      [totalPermits],
      top311Types,
      topBlightAreas,
      strByNeighborhood,
      topCrimeTypes,
    ] = await Promise.all([
      queryKB<Stat>("SELECT COUNT(*) as count FROM nola_pulse_kb.service_requests_311"),
      queryKB<Stat>("SELECT COUNT(*) as count FROM nola_pulse_kb.str_permits"),
      queryKB<Stat>("SELECT COUNT(*) as count FROM nola_pulse_kb.police_reports"),
      queryKB<Stat>("SELECT COUNT(*) as count FROM nola_pulse_kb.blight_cases"),
      queryKB<Stat>("SELECT COUNT(*) as count FROM nola_pulse_kb.demolitions"),
      queryKB<Stat>("SELECT COUNT(*) as count FROM nola_pulse_kb.use_of_force"),
      queryKB<Stat>("SELECT COUNT(*) as count FROM nola_pulse_kb.building_permits"),
      queryKB<TypeCount>(
        `SELECT request_type, COUNT(*) as count FROM nola_pulse_kb.service_requests_311
         WHERE request_type IS NOT NULL GROUP BY request_type ORDER BY count DESC LIMIT 5`
      ),
      queryKB<{ location: string; case_count: number }>(
        `SELECT location, COUNT(*) as case_count FROM nola_pulse_kb.blight_cases
         WHERE location IS NOT NULL GROUP BY location ORDER BY case_count DESC LIMIT 5`
      ),
      queryKB<NeighborhoodCount>(
        `SELECT neighborhood, COUNT(*) as count FROM nola_pulse_kb.str_permits
         WHERE neighborhood IS NOT NULL GROUP BY neighborhood ORDER BY count DESC LIMIT 5`
      ),
      queryKB<CrimeType>(
        `SELECT signal_description, COUNT(*) as count FROM nola_pulse_kb.police_reports
         WHERE signal_description IS NOT NULL GROUP BY signal_description ORDER BY count DESC LIMIT 5`
      ),
    ]);

    return {
      total311: total311?.count || 0,
      totalSTR: totalSTR?.count || 0,
      totalPolice: totalPolice?.count || 0,
      totalBlight: totalBlight?.count || 0,
      totalDemos: totalDemos?.count || 0,
      totalUOF: totalUOF?.count || 0,
      totalPermits: totalPermits?.count || 0,
      top311Types: top311Types || [],
      topBlightAreas: topBlightAreas || [],
      strByNeighborhood: strByNeighborhood || [],
      topCrimeTypes: topCrimeTypes || [],
    };
  } catch (err) {
    console.error("Dashboard data error:", err);
    return null;
  }
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  if (!data) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-12">
        <h1 className="mb-4 text-3xl font-bold"><span className="text-accent">NOLA Pulse</span> Dashboard</h1>
        <div className="rounded-xl border border-card-border bg-card-bg p-8 text-center text-muted">
          Knowledge base is loading. Scouts are ingesting civic data.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold">
        <span className="text-accent">NOLA Pulse</span> Dashboard
      </h1>
      <p className="mb-10 text-muted">
        Real civic data for New Orleans — pulled from city records, not press releases.
      </p>

      {/* Headline Stories */}
      <div className="mb-10 grid gap-6 lg:grid-cols-2">
        <StoryCard
          icon="🚽"
          headline={`${fmt(data.total311)} complaints filed in the last 30 days`}
          body={`New Orleans residents filed ${fmt(data.total311)} service requests recently. The top complaint? ${data.top311Types[0]?.request_type || "Unknown"} with ${fmt(data.top311Types[0]?.count || 0)} calls — that's ${Math.round(((data.top311Types[0]?.count || 0) / data.total311) * 100)}% of all requests. ${data.top311Types[1] ? `Followed by ${data.top311Types[1].request_type} (${fmt(data.top311Types[1].count)}).` : ""}`}
          color="text-warning"
        />

        <StoryCard
          icon="🏘️"
          headline={`${fmt(data.totalSTR)} active short-term rental licenses`}
          body={`${fmt(data.totalSTR)} properties are licensed to operate as short-term rentals across the city. ${data.strByNeighborhood[0] ? `The most concentrated area is ${data.strByNeighborhood[0].neighborhood} with ${fmt(data.strByNeighborhood[0].count)} licenses.` : ""} ${data.strByNeighborhood[1] ? `${data.strByNeighborhood[1].neighborhood} follows with ${fmt(data.strByNeighborhood[1].count)}.` : ""} Every one of these is a home that's not housing a resident.`}
          color="text-danger"
        />

        <StoryCard
          icon="🏚️"
          headline={`${fmt(data.totalBlight)} active blight cases`}
          body={`The city is tracking ${fmt(data.totalBlight)} code enforcement cases for blighted properties. ${fmt(data.totalDemos)} properties have been demolished. ${data.topBlightAreas[0] ? `The most cited address is ${data.topBlightAreas[0].location} with ${data.topBlightAreas[0].case_count} cases.` : ""}`}
          color="text-danger"
        />

        <StoryCard
          icon="🚔"
          headline={`${fmt(data.totalPolice)} police reports filed`}
          body={`NOPD logged ${fmt(data.totalPolice)} incident reports. ${data.topCrimeTypes[0] ? `Most common: ${data.topCrimeTypes[0].signal_description} (${fmt(data.topCrimeTypes[0].count)}).` : ""} Separately, ${fmt(data.totalUOF)} use-of-force incidents were documented — every one is public record.`}
          color="text-warning"
        />
      </div>

      {/* Data Breakdown Tables */}
      <div className="grid gap-8 lg:grid-cols-2">
        {data.top311Types.length > 0 && (
          <div>
            <h2 className="mb-3 text-lg font-semibold">What People Are Complaining About</h2>
            <p className="mb-4 text-xs text-muted">Top 311 service request types, last 30 days</p>
            <DataTable
              rows={data.top311Types.map((t) => ({
                label: t.request_type,
                value: fmt(t.count),
                pct: Math.round((t.count / data.total311) * 100),
              }))}
            />
          </div>
        )}

        {data.strByNeighborhood.length > 0 && (
          <div>
            <h2 className="mb-3 text-lg font-semibold">Where the Rentals Are</h2>
            <p className="mb-4 text-xs text-muted">Active STR licenses by neighborhood</p>
            <DataTable
              rows={data.strByNeighborhood.map((n) => ({
                label: n.neighborhood,
                value: fmt(n.count),
                pct: Math.round((n.count / data.totalSTR) * 100),
              }))}
              color="text-danger"
            />
          </div>
        )}

        {data.topCrimeTypes.length > 0 && (
          <div>
            <h2 className="mb-3 text-lg font-semibold">Most Common Incident Types</h2>
            <p className="mb-4 text-xs text-muted">Police report categories by frequency</p>
            <DataTable
              rows={data.topCrimeTypes.map((c) => ({
                label: c.signal_description,
                value: fmt(c.count),
                pct: Math.round((c.count / data.totalPolice) * 100),
              }))}
              color="text-warning"
            />
          </div>
        )}

        {data.topBlightAreas.length > 0 && (
          <div>
            <h2 className="mb-3 text-lg font-semibold">Worst Blight Addresses</h2>
            <p className="mb-4 text-xs text-muted">Most cited locations for code enforcement</p>
            <DataTable
              rows={data.topBlightAreas.map((b) => ({
                label: b.location,
                value: String(b.case_count),
                pct: 0,
              }))}
              color="text-danger"
            />
          </div>
        )}
      </div>

      {/* Bottom Stats */}
      <div className="mt-10 grid gap-4 sm:grid-cols-4">
        <MiniStat label="Building Permits Filed" value={fmt(data.totalPermits)} />
        <MiniStat label="Properties Demolished" value={fmt(data.totalDemos)} />
        <MiniStat label="Use of Force Incidents" value={fmt(data.totalUOF)} />
        <MiniStat label="News Articles Tracked" value="150+" />
      </div>

      <p className="mt-8 text-center text-xs text-muted">
        Data sourced from data.nola.gov (Socrata Open Data). Updated daily by NOLA Pulse scouts.
      </p>
    </div>
  );
}

function StoryCard({ icon, headline, body, color }: { icon: string; headline: string; body: string; color: string }) {
  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-6">
      <div className="mb-3 text-2xl">{icon}</div>
      <h3 className={`mb-2 text-lg font-bold ${color}`}>{headline}</h3>
      <p className="text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}

function DataTable({ rows, color }: { rows: { label: string; value: string; pct: number }[]; color?: string }) {
  return (
    <div className="rounded-xl border border-card-border bg-card-bg">
      {rows.map((row, i) => (
        <div key={row.label} className={`flex items-center justify-between px-4 py-3 ${i !== rows.length - 1 ? "border-b border-card-border" : ""}`}>
          <span className="text-sm">{row.label}</span>
          <div className="flex items-center gap-3">
            {row.pct > 0 && <span className="text-xs text-muted">{row.pct}%</span>}
            <span className={`font-mono text-sm font-semibold ${color || "text-accent"}`}>{row.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-4 text-center">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}
