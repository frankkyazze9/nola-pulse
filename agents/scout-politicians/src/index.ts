import { Agent } from "../../shared/agent-sdk";
import { SocrataClient, DATASETS } from "../../shared/socrata";

const agent = new Agent({ name: "scout-politicians", version: "1.0.0", type: "scout" });
const socrata = new SocrataClient();

// Current New Orleans elected officials (manually maintained + enriched by AI)
const ELECTED_OFFICIALS = [
  // Mayor
  { name: "Helena Moreno", office: "Mayor", level: "city", district: null, took_office: "2026-01-06", party: "Democrat", email: null },

  // City Council
  { name: "Jean-Paul Morrell", office: "City Council At-Large", level: "city", district: "At-Large", took_office: "2022-05-02", party: "Democrat", email: "JP.Morrell@nola.gov" },
  { name: "Matthew Willard", office: "City Council At-Large", level: "city", district: "At-Large", took_office: null, party: "Democrat", email: "Matthew.Willard@nola.gov" },
  { name: "Aimee McCarron", office: "City Council District A", level: "city", district: "A", took_office: null, party: null, email: "Aimee.McCarron@nola.gov" },
  { name: "Lesli Harris", office: "City Council District B", level: "city", district: "B", took_office: "2022-05-02", party: "Democrat", email: "Lesli.Harris@nola.gov" },
  { name: "Freddie King III", office: "City Council District C", level: "city", district: "C", took_office: "2022-05-02", party: "Democrat", email: "Freddie.King@nola.gov" },
  { name: "Eugene J. Green", office: "City Council District D", level: "city", district: "D", took_office: "2022-05-02", party: "Democrat", email: "eugene.green@nola.gov" },
  { name: "Jason Hughes", office: "City Council District E", level: "city", district: "E", took_office: null, party: null, email: "Jason.Hughes@nola.gov" },

  // Orleans Parish officials
  { name: "Jason Williams", office: "District Attorney", level: "parish", district: null, took_office: "2021-01-11", party: "Democrat", email: null },
  { name: "Susan Hutson", office: "Sheriff", level: "parish", district: null, took_office: "2022-05-02", party: "Democrat", email: null },
  { name: "Erroll Williams", office: "Assessor", level: "parish", district: null, took_office: null, party: "Democrat", email: null },

  // State representatives (Orleans Parish)
  { name: "Mandie Landry", office: "State Senator District 18", level: "state", district: "18", took_office: null, party: "Democrat", email: null },
  { name: "Jimmy Harris", office: "State Senator District 4", level: "state", district: "4", took_office: null, party: "Democrat", email: null },
];

async function main() {
  await agent.run(async () => {
    console.log(`[${agent.name}] Building elected officials database...`);

    // Store basic official profiles
    const rows = ELECTED_OFFICIALS.map((official) => ({
      name: official.name,
      office: official.office,
      level: official.level,
      district: official.district,
      party: official.party,
      email: official.email,
      took_office: official.took_office,
      ingested_at: new Date().toISOString(),
    }));

    await agent.insertKB("elected_officials", rows);
    console.log(`[${agent.name}] Stored ${rows.length} official profiles`);

    // Enrich with council district demographics
    const demographics = await socrata.query(DATASETS.COUNCIL_DEMOGRAPHICS);
    if (demographics.length > 0) {
      await agent.insertKB("council_demographics", demographics.map((d) => ({
        ...d,
        ingested_at: new Date().toISOString(),
      })));
      console.log(`[${agent.name}] Stored ${demographics.length} district demographic records`);
    }

    // Use Claude to build deeper profiles from public information
    for (const official of ELECTED_OFFICIALS.filter((o) => o.level === "city")) {
      const profile = await agent.think(
        "You are a civic researcher building factual profiles of New Orleans elected officials from publicly available information. Be factual. No speculation. Include: career background, key policy positions, notable votes or actions, any controversies. Cite what you know from public record.",
        `Build a brief factual profile (3-5 paragraphs) of ${official.name}, who holds the office of ${official.office} in New Orleans. Include their professional background, key policy positions, notable actions in office, and any publicly reported controversies. Only include information you are confident about.`
      );

      await agent.storeDocument(
        `politicians/profiles/${official.name.toLowerCase().replace(/\s+/g, "-")}.md`,
        `# ${official.name}\n**${official.office}**\n\n${profile}`
      );
      console.log(`[${agent.name}] Built profile: ${official.name}`);
    }

    await agent.publish("data.ingested", {
      source: "politicians",
      officials: rows.length,
    });
    console.log(`[${agent.name}] Complete.`);
  });
}

export { main };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
