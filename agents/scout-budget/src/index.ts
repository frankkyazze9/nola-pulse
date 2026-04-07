import { Agent } from "../../shared/agent-sdk";
import { SocrataClient, DATASETS } from "../../shared/socrata";

const agent = new Agent({ name: "scout-budget", version: "1.0.0", type: "scout" });
const socrata = new SocrataClient();

async function main() {
  await agent.run(async () => {
    console.log(`[${agent.name}] Fetching budget, salary, and tax data...`);

    // --- Sales Tax Revenue ---
    let taxCount = 0;
    for await (const batch of socrata.paginate(DATASETS.SALES_TAX_REVENUE)) {
      const rows = batch.map((r: any) => ({
        year: r.year ? parseInt(r.year) : null,
        date: r.date || null,
        indicator_name: r.indicatorname || null,
        indicator_value: r.indicatorvalue ? parseFloat(r.indicatorvalue) : null,
        ingested_at: new Date().toISOString(),
      }));

      if (rows.length > 0) {
        await agent.insertKB("tax_revenue", rows);
        taxCount += rows.length;
      }
    }

    // --- Employee Salaries ---
    let salaryCount = 0;
    for await (const batch of socrata.paginate(DATASETS.EMPLOYEE_SALARIES)) {
      const rows = batch.map((r: any) => ({
        employee_name: r.employee_name || r.name || null,
        position_title: r.position_title || r.title || null,
        department: r.department || null,
        salary: r.salary ? parseFloat(r.salary) : null,
        ingested_at: new Date().toISOString(),
      }));

      if (rows.length > 0) {
        await agent.insertKB("employee_salaries", rows);
        salaryCount += rows.length;
      }
    }

    // --- Business Licenses ---
    let bizCount = 0;
    for await (const batch of socrata.paginate(DATASETS.BUSINESS_LICENSES, {
      order: "applicationdate DESC",
      where: `applicationdate >= '${daysAgo(365)}'`,
    })) {
      const rows = batch.map((r: any) => ({
        business_name: r.businessname || null,
        business_type: r.businesstype || null,
        naics_code: r.naicscode || null,
        address: r.locationaddress || null,
        status: r.status || null,
        application_date: r.applicationdate || null,
        issue_date: r.issuedate || null,
        neighborhood: r.neighborhood || null,
        council_district: r.councildistrict || null,
        ingested_at: new Date().toISOString(),
      }));

      if (rows.length > 0) {
        await agent.insertKB("business_licenses", rows);
        bizCount += rows.length;
      }
    }

    await agent.publish("data.ingested", {
      source: "budget",
      taxRecords: taxCount,
      salaryRecords: salaryCount,
      businessLicenses: bizCount,
    });
    console.log(`[${agent.name}] Complete. ${taxCount} tax, ${salaryCount} salary, ${bizCount} business records.`);
  });
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

export { main };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
