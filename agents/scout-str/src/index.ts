import { Agent } from "../../shared/agent-sdk";
import { SocrataClient, DATASETS } from "../../shared/socrata";

const agent = new Agent({ name: "scout-str", version: "1.0.0", type: "scout" });
const socrata = new SocrataClient();

async function main() {
  await agent.run(async () => {
    console.log(`[${agent.name}] Fetching active short-term rental licenses...`);

    let totalCount = 0;

    for await (const batch of socrata.paginate(DATASETS.STR_ACTIVE, {
      order: "issue_date DESC",
    })) {
      const rows = batch.map((r: any) => ({
        license_number: r.license_number || null,
        address: r.address || null,
        license_type: r.license_type || null,
        residential_subtype: r.residential_subtype || null,
        expiration_date: r.expiration_date || null,
        bedroom_limit: r.bedroom_limit ? parseInt(r.bedroom_limit) : null,
        guest_limit: r.guest_occupancy_limit ? parseInt(r.guest_occupancy_limit) : null,
        operator_name: r.operator_name || null,
        issue_date: r.issue_date || null,
        application_date: r.application_date || null,
        neighborhood: r.neighborhood_statistical_areas || null,
        zip_code: r.zip_codes || null,
        council_district: r.council_districts || null,
        latitude: r.latitude ? parseFloat(r.latitude) : null,
        longitude: r.longitude ? parseFloat(r.longitude) : null,
        ingested_at: new Date().toISOString(),
      }));

      if (rows.length > 0) {
        await agent.insertKB("str_permits", rows);
        totalCount += rows.length;
      }
    }

    await agent.publish("data.ingested", { source: "str", recordCount: totalCount });
    console.log(`[${agent.name}] Complete. ${totalCount} STR licenses ingested.`);
  });
}

export { main };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
