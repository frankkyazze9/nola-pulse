import { Agent } from "../../shared/agent-sdk";
import { SocrataClient, DATASETS } from "../../shared/socrata";

const agent = new Agent({ name: "scout-crime", version: "1.0.0", type: "scout" });
const socrata = new SocrataClient();

async function main() {
  await agent.run(async () => {
    console.log(`[${agent.name}] Fetching police reports and calls for service...`);

    // --- 2025 Police Reports ---
    let reportCount = 0;
    for await (const batch of socrata.paginate(DATASETS.POLICE_REPORTS_2025, {
      order: "occurred_date_time DESC",
    })) {
      const rows = batch.map((r: any) => ({
        item_number: r.item_number || null,
        district: r.district || null,
        location: r.location || null,
        signal_type: r.signal_type || null,
        signal_description: r.signal_description || null,
        occurred_date: r.occurred_date_time || null,
        charge_description: r.charge_description || null,
        disposition: r.disposition || null,
        victim_fatal_status: r.victim_fatal_status || null,
        ingested_at: new Date().toISOString(),
      }));

      if (rows.length > 0) {
        await agent.insertKB("police_reports", rows);
        reportCount += rows.length;
      }
    }

    // --- 2025 Calls for Service ---
    let callCount = 0;
    for await (const batch of socrata.paginate(DATASETS.CALLS_FOR_SERVICE_2025, {
      order: "timecreate DESC",
      where: `timecreate >= '${daysAgo(90)}'`,
    })) {
      const rows = batch.map((r: any) => ({
        nopd_item: r.nopd_item || null,
        type_text: r.typetext || null,
        priority: r.priority || null,
        time_create: r.timecreate || null,
        time_dispatch: r.timedispatch || null,
        time_arrive: r.timearrive || null,
        time_closed: r.timeclosed || null,
        disposition: r.dispositiontext || null,
        beat: r.beat || null,
        block_address: r.block_address || null,
        zip: r.zip || null,
        police_district: r.policedistrict || null,
        ingested_at: new Date().toISOString(),
      }));

      if (rows.length > 0) {
        await agent.insertKB("calls_for_service", rows);
        callCount += rows.length;
      }
    }

    // --- Use of Force ---
    let uofCount = 0;
    for await (const batch of socrata.paginate(DATASETS.USE_OF_FORCE)) {
      const rows = batch.map((r: any) => ({
        pib_file_number: r.pib_file_number || null,
        date_occurred: r.date_occurred || null,
        division: r.division || null,
        force_type: r.use_of_force_type || null,
        force_level: r.use_of_force_level || null,
        force_reason: r.use_of_force_reason || null,
        disposition: r.disposition || null,
        officer_race: r.officer_race_ethnicity || null,
        officer_years: r.officer_years_of_service || null,
        subject_race: r.subject_ethnicity || null,
        subject_injured: r.subject_injured || null,
        subject_arrested: r.subject_arrested || null,
        ingested_at: new Date().toISOString(),
      }));

      if (rows.length > 0) {
        await agent.insertKB("use_of_force", rows);
        uofCount += rows.length;
      }
    }

    await agent.publish("data.ingested", {
      source: "crime",
      policeReports: reportCount,
      callsForService: callCount,
      useOfForce: uofCount,
    });
    console.log(`[${agent.name}] Complete. ${reportCount} reports, ${callCount} CFS, ${uofCount} UOF.`);
  });
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

export { main };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
