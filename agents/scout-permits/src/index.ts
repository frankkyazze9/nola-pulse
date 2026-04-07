import { Agent } from "../../shared/agent-sdk";
import { SocrataClient, DATASETS } from "../../shared/socrata";

const agent = new Agent({ name: "scout-permits", version: "1.0.0", type: "scout" });
const socrata = new SocrataClient();

async function main() {
  await agent.run(async () => {
    console.log(`[${agent.name}] Fetching permits and demolitions...`);

    // --- Building Permits ---
    let permitCount = 0;
    for await (const batch of socrata.paginate(DATASETS.PERMITS, {
      order: "filingdate DESC",
      where: `filingdate >= '${daysAgo(365)}'`,
    })) {
      const rows = batch.map((r: any) => ({
        permit_id: r.numstring || null,
        address: r.address || null,
        owner: r.owner || null,
        description: r.description || null,
        permit_type: r.type || null,
        filing_date: r.filingdate || null,
        issue_date: r.issuedate || null,
        status: r.currentstatus || null,
        land_use: r.landuse || null,
        construction_value: r.constrval ? parseFloat(r.constrval) : null,
        council_district: r.councildist || null,
        zoning: r.zoning || null,
        historic_district: r.historicdistrict || null,
        days_open: r.daysopen ? parseInt(r.daysopen) : null,
        ingested_at: new Date().toISOString(),
      }));

      if (rows.length > 0) {
        await agent.insertKB("building_permits", rows);
        permitCount += rows.length;
      }
    }

    // --- Demolitions ---
    let demoCount = 0;
    for await (const batch of socrata.paginate(DATASETS.DEMOLITIONS)) {
      const rows = batch.map((r: any) => ({
        case_id: r.caseid || null,
        address: r.full_address || null,
        program: r.program || null,
        units: r.units ? parseInt(r.units) : null,
        council_district: r.council_district || null,
        demolition_start: r.demolition_start || null,
        demolition_complete: r.demolition_complete || null,
        ingested_at: new Date().toISOString(),
      }));

      if (rows.length > 0) {
        await agent.insertKB("demolitions", rows);
        demoCount += rows.length;
      }
    }

    await agent.publish("data.ingested", {
      source: "permits",
      permits: permitCount,
      demolitions: demoCount,
    });
    console.log(`[${agent.name}] Complete. ${permitCount} permits, ${demoCount} demolitions.`);
  });
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

export { main };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
