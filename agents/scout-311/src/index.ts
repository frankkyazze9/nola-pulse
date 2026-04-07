import { Agent } from "../../shared/agent-sdk";
import { SocrataClient, DATASETS } from "../../shared/socrata";

const agent = new Agent({ name: "scout-311", version: "1.0.0", type: "scout" });
const socrata = new SocrataClient();

async function main() {
  await agent.run(async () => {
    console.log(`[${agent.name}] Fetching 311 service requests...`);

    // Fetch recent 311 calls — potholes, streetlights, drainage, etc.
    for await (const batch of socrata.paginate(DATASETS.CALLS_311, {
      order: "date_created DESC",
      where: `date_created >= '${daysAgo(30)}'`,
    })) {
      const rows = batch.map((r: any) => ({
        request_id: r.service_request || r.rowid,
        request_type: r.request_type || null,
        request_reason: r.request_reason || null,
        date_created: r.date_created || null,
        date_closed: r.date_closed || null,
        status: r.request_status || r.status || null,
        address: r.address || null,
        council_district: r.council_district || null,
        neighborhood: r.neighborhood_statistical_areas || null,
        zip_code: r.zip_codes || null,
        latitude: r.latitude ? parseFloat(r.latitude) : null,
        longitude: r.longitude ? parseFloat(r.longitude) : null,
        ingested_at: new Date().toISOString(),
      }));

      if (rows.length > 0) {
        await agent.insertKB("service_requests_311", rows);
        console.log(`[${agent.name}] Stored ${rows.length} 311 records`);
      }
    }

    await agent.publish("data.ingested", { source: "311" });
    console.log(`[${agent.name}] Complete.`);
  });
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

export { main };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
