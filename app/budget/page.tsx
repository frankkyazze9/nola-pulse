import { queryKB } from "@/lib/bigquery";

export const dynamic = "force-dynamic";

interface Stat { count: number }
interface TaxRecord { year: number; indicator_name: string; indicator_value: number }
interface SalaryRecord { position_title: string; department: string; salary: number }
interface BizRecord { business_type: string; count: number }

async function getData() {
  try {
    const [
      taxRevenue,
      topSalaries,
      bizTypes,
      [totalPermits],
    ] = await Promise.all([
      queryKB<TaxRecord>(
        `SELECT CAST(year AS INT64) as year, indicator_name, indicator_value
         FROM nola_pulse_kb.tax_revenue
         WHERE indicator_value IS NOT NULL
         ORDER BY year DESC, indicator_value DESC LIMIT 20`
      ),
      queryKB<SalaryRecord>(
        `SELECT position_title, department, salary FROM nola_pulse_kb.employee_salaries
         WHERE salary IS NOT NULL ORDER BY salary DESC LIMIT 15`
      ),
      queryKB<BizRecord>(
        `SELECT business_type, COUNT(*) as count FROM nola_pulse_kb.business_licenses
         WHERE business_type IS NOT NULL GROUP BY business_type ORDER BY count DESC LIMIT 10`
      ),
      queryKB<Stat>("SELECT COUNT(*) as count FROM nola_pulse_kb.building_permits"),
    ]);
    return { taxRevenue: taxRevenue || [], topSalaries: topSalaries || [], bizTypes: bizTypes || [], totalPermits: totalPermits?.count || 0 };
  } catch (err) {
    console.error("Budget data error:", err);
    return null;
  }
}

export default async function BudgetPage() {
  const data = await getData();

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold">
        <span className="text-accent">Budget</span> Explorer
      </h1>
      <p className="mb-10 text-muted">
        Where the city&apos;s money actually goes. Tax revenue, salaries, and
        business activity — from public records.
      </p>

      {data ? (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-card-border bg-card-bg p-6 text-center">
              <p className="text-3xl font-bold text-accent">{data.totalPermits.toLocaleString()}</p>
              <p className="text-xs text-muted">Building Permits Filed</p>
            </div>
            <div className="rounded-xl border border-card-border bg-card-bg p-6 text-center">
              <p className="text-3xl font-bold text-accent">{data.taxRevenue.length}</p>
              <p className="text-xs text-muted">Tax Revenue Records</p>
            </div>
            <div className="rounded-xl border border-card-border bg-card-bg p-6 text-center">
              <p className="text-3xl font-bold text-accent">{data.bizTypes.reduce((s, b) => s + b.count, 0).toLocaleString()}</p>
              <p className="text-xs text-muted">Business Licenses (Last Year)</p>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            {data.topSalaries.length > 0 && (
              <div>
                <h2 className="mb-2 text-xl font-semibold">Highest City Salaries</h2>
                <p className="mb-4 text-xs text-muted">Top earners on the city payroll — public record</p>
                <div className="rounded-xl border border-card-border bg-card-bg">
                  {data.topSalaries.slice(0, 10).map((s, i) => (
                    <div key={`${s.position_title}-${i}`} className={`flex items-center justify-between px-4 py-3 ${i < 9 ? "border-b border-card-border" : ""}`}>
                      <div>
                        <p className="text-sm font-medium">{s.position_title}</p>
                        <p className="text-xs text-muted">{s.department}</p>
                      </div>
                      <span className="font-mono text-sm font-semibold text-accent">
                        ${s.salary?.toLocaleString() || "N/A"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.bizTypes.length > 0 && (
              <div>
                <h2 className="mb-2 text-xl font-semibold">Business License Types</h2>
                <p className="mb-4 text-xs text-muted">What kind of businesses are opening in New Orleans</p>
                <div className="rounded-xl border border-card-border bg-card-bg">
                  {data.bizTypes.map((b, i) => (
                    <div key={b.business_type} className={`flex items-center justify-between px-4 py-3 ${i < data.bizTypes.length - 1 ? "border-b border-card-border" : ""}`}>
                      <span className="text-sm">{b.business_type}</span>
                      <span className="font-mono text-sm font-semibold text-accent">{b.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.taxRevenue.length > 0 && (
              <div className="lg:col-span-2">
                <h2 className="mb-2 text-xl font-semibold">Tax Revenue History</h2>
                <p className="mb-4 text-xs text-muted">Sales tax and other revenue flowing into the general fund</p>
                <div className="rounded-xl border border-card-border bg-card-bg">
                  {data.taxRevenue.slice(0, 10).map((t, i) => (
                    <div key={`${t.year}-${t.indicator_name}-${i}`} className={`flex items-center justify-between px-4 py-3 ${i < 9 ? "border-b border-card-border" : ""}`}>
                      <div>
                        <span className="text-sm font-medium">{t.indicator_name}</span>
                        <span className="ml-2 text-xs text-muted">({t.year})</span>
                      </div>
                      <span className="font-mono text-sm font-semibold text-success">
                        ${(t.indicator_value / 1_000_000).toFixed(1)}M
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-card-border bg-card-bg p-8 text-center text-muted">
          Budget data loading. Scouts are ingesting financial records.
        </div>
      )}

      <p className="mt-8 text-center text-xs text-muted">
        Data: data.nola.gov — Tax revenue, employee salaries, business licenses. Updated monthly.
      </p>
    </div>
  );
}
