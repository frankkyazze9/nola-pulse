import { queryKB } from "@/lib/bigquery";

export const dynamic = "force-dynamic";

interface Official { name: string; office: string; level: string; district: string; party: string; email: string }
interface CrimeDistrict { district: string; count: number }

async function getData() {
  try {
    const [
      officials,
      crimeByDistrict,
    ] = await Promise.all([
      queryKB<Official>(
        `SELECT name, office, level, district, party, email
         FROM nola_pulse_kb.elected_officials
         ORDER BY level, office`
      ),
      queryKB<CrimeDistrict>(
        `SELECT district, COUNT(*) as count FROM nola_pulse_kb.police_reports
         WHERE district IS NOT NULL GROUP BY district ORDER BY count DESC LIMIT 10`
      ),
    ]);
    return { officials: officials || [], crimeByDistrict: crimeByDistrict || [] };
  } catch (err) {
    console.error("Entity data error:", err);
    return null;
  }
}

export default async function EntitiesPage() {
  const data = await getData();

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold">
        <span className="text-accent">Entity</span> Tracker
      </h1>
      <p className="mb-10 text-muted">
        Who runs New Orleans, what they oversee, and what the data says
        about their districts. Public officials, public accountability.
      </p>

      {data ? (
        <>
          <div className="mb-10">
            <h2 className="mb-4 text-xl font-semibold">Elected Officials</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.officials.map((o) => (
                <div key={o.name} className="rounded-xl border border-card-border bg-card-bg p-4">
                  <h3 className="font-semibold">{o.name}</h3>
                  <p className="text-sm text-accent">{o.office}</p>
                  <div className="mt-2 flex gap-3 text-xs text-muted">
                    {o.party && <span>{o.party}</span>}
                    {o.email && <span>{o.email}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {data.crimeByDistrict.length > 0 && (
            <div>
              <h2 className="mb-2 text-xl font-semibold">Police Reports by District</h2>
              <p className="mb-4 text-xs text-muted">Which NOPD districts have the most incident reports</p>
              <div className="rounded-xl border border-card-border bg-card-bg">
                {data.crimeByDistrict.map((d, i) => (
                  <div key={d.district} className={`flex items-center justify-between px-4 py-3 ${i < data.crimeByDistrict.length - 1 ? "border-b border-card-border" : ""}`}>
                    <span className="text-sm">District {d.district}</span>
                    <span className="font-mono text-sm font-semibold text-warning">{d.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-card-border bg-card-bg p-8 text-center text-muted">
          Entity data loading.
        </div>
      )}

      <p className="mt-8 text-center text-xs text-muted">
        Data: data.nola.gov, public records. Campaign finance integration coming soon.
      </p>
    </div>
  );
}
