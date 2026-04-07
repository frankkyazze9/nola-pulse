import { Agent } from "../../shared/agent-sdk";
import { SocrataClient, DATASETS } from "../../shared/socrata";

const agent = new Agent({ name: "scout-blight", version: "1.0.0", type: "scout" });
const socrata = new SocrataClient();

async function main() {
  await agent.run(async () => {
    console.log(`[${agent.name}] Fetching code enforcement and blight data...`);

    // --- Blight Cases ---
    let caseCount = 0;
    for await (const batch of socrata.paginate(DATASETS.BLIGHT_CASES, {
      order: "casefiled DESC",
      where: `casefiled >= '${daysAgo(365)}'`,
    })) {
      const rows = batch.map((r: any) => ({
        case_id: r.caseid || null,
        case_no: r.caseno || null,
        location: r.location || null,
        stage: r.stage || null,
        status: r.keystatus || null,
        status_date: r.statdate || null,
        case_filed: r.casefiled || null,
        inspection_result: r.initinspresult || null,
        next_hearing: r.nexthearingdate || null,
        zip_code: r.zipcode || null,
        geo_pin: r.geopin || null,
        ingested_at: new Date().toISOString(),
      }));

      if (rows.length > 0) {
        await agent.insertKB("blight_cases", rows);
        caseCount += rows.length;
      }
    }

    // --- Blight Violations ---
    let violationCount = 0;
    for await (const batch of socrata.paginate(DATASETS.BLIGHT_VIOLATIONS, {
      order: "violationdate DESC",
      where: `violationdate >= '${daysAgo(365)}'`,
    })) {
      const rows = batch.map((r: any) => ({
        case_id: r.caseid || null,
        violation_id: r.violationid || null,
        case_no: r.caseno || null,
        location: r.location || null,
        violation_date: r.violationdate || null,
        code_section: r.codesection || null,
        violation: r.violation || null,
        description: r.description || null,
        ingested_at: new Date().toISOString(),
      }));

      if (rows.length > 0) {
        await agent.insertKB("blight_violations", rows);
        violationCount += rows.length;
      }
    }

    await agent.publish("data.ingested", {
      source: "blight",
      cases: caseCount,
      violations: violationCount,
    });
    console.log(`[${agent.name}] Complete. ${caseCount} cases, ${violationCount} violations.`);
  });
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

export { main };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
