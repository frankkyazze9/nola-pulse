/**
 * White Paper Writer Agent
 *
 * Produces 3,000-10,000 word deep dives on specific civic topics.
 * Uses the full knowledge base for context and data citations.
 * Content goes to admin review queue before publishing.
 *
 * Usage:
 *   npx tsx agents/creator-whitepaper/src/index.ts "short-term rentals"
 *   npx tsx agents/creator-whitepaper/src/index.ts "police use of force"
 *   npx tsx agents/creator-whitepaper/src/index.ts "blight crisis"
 */

import { Agent } from "../../shared/agent-sdk";
import { readFileSync } from "fs";
import { join } from "path";

const agent = new Agent({
  name: "creator-whitepaper",
  version: "1.0.0",
  type: "creator",
});

function loadVoiceGuide(): string {
  try {
    return readFileSync(join(process.cwd(), "data", "voice.md"), "utf-8");
  } catch {
    return "Direct, authoritative but accessible. Data-driven, no jargon.";
  }
}

const TOPIC_QUERIES: Record<string, string[]> = {
  "short-term rentals": [
    "SELECT neighborhood, COUNT(*) as count FROM nola_pulse_kb.str_permits WHERE neighborhood IS NOT NULL GROUP BY neighborhood ORDER BY count DESC LIMIT 20",
    "SELECT license_type, COUNT(*) as count FROM nola_pulse_kb.str_permits WHERE license_type IS NOT NULL GROUP BY license_type ORDER BY count DESC",
    "SELECT COUNT(*) as total FROM nola_pulse_kb.str_permits",
  ],
  "police use of force": [
    "SELECT force_type, COUNT(*) as count FROM nola_pulse_kb.use_of_force WHERE force_type IS NOT NULL GROUP BY force_type ORDER BY count DESC LIMIT 10",
    "SELECT force_reason, COUNT(*) as count FROM nola_pulse_kb.use_of_force WHERE force_reason IS NOT NULL GROUP BY force_reason ORDER BY count DESC LIMIT 10",
    "SELECT officer_race, COUNT(*) as count FROM nola_pulse_kb.use_of_force WHERE officer_race IS NOT NULL GROUP BY officer_race ORDER BY count DESC",
    "SELECT subject_race, COUNT(*) as count FROM nola_pulse_kb.use_of_force WHERE subject_race IS NOT NULL GROUP BY subject_race ORDER BY count DESC",
    "SELECT disposition, COUNT(*) as count FROM nola_pulse_kb.use_of_force WHERE disposition IS NOT NULL GROUP BY disposition ORDER BY count DESC LIMIT 10",
    "SELECT COUNT(*) as total FROM nola_pulse_kb.use_of_force",
  ],
  "blight crisis": [
    "SELECT stage, COUNT(*) as count FROM nola_pulse_kb.blight_cases WHERE stage IS NOT NULL GROUP BY stage ORDER BY count DESC",
    "SELECT status, COUNT(*) as count FROM nola_pulse_kb.blight_cases WHERE status IS NOT NULL GROUP BY status ORDER BY count DESC LIMIT 10",
    "SELECT COUNT(*) as total_cases FROM nola_pulse_kb.blight_cases",
    "SELECT COUNT(*) as total_violations FROM nola_pulse_kb.blight_violations",
    "SELECT COUNT(*) as total_demos FROM nola_pulse_kb.demolitions",
  ],
  "crime": [
    "SELECT signal_description, COUNT(*) as count FROM nola_pulse_kb.police_reports WHERE signal_description IS NOT NULL GROUP BY signal_description ORDER BY count DESC LIMIT 15",
    "SELECT district, COUNT(*) as count FROM nola_pulse_kb.police_reports WHERE district IS NOT NULL GROUP BY district ORDER BY count DESC",
    "SELECT COUNT(*) as total FROM nola_pulse_kb.police_reports",
  ],
  "infrastructure": [
    "SELECT request_type, COUNT(*) as count FROM nola_pulse_kb.service_requests_311 WHERE request_type IS NOT NULL GROUP BY request_type ORDER BY count DESC LIMIT 15",
    "SELECT status, COUNT(*) as count FROM nola_pulse_kb.service_requests_311 WHERE status IS NOT NULL GROUP BY status ORDER BY count DESC",
    "SELECT COUNT(*) as total FROM nola_pulse_kb.service_requests_311",
    "SELECT COUNT(*) as total_permits FROM nola_pulse_kb.building_permits",
  ],
};

async function gatherData(topic: string): Promise<string> {
  // Find matching queries or use a general approach
  const key = Object.keys(TOPIC_QUERIES).find((k) =>
    topic.toLowerCase().includes(k)
  );
  const queries = key ? TOPIC_QUERIES[key] : TOPIC_QUERIES["infrastructure"];

  const results: Record<string, unknown> = {};
  for (const sql of queries) {
    try {
      const tableName = sql.match(/FROM nola_pulse_kb\.(\w+)/)?.[1] || "unknown";
      results[tableName] = await agent.queryKB(sql);
    } catch (err) {
      // Skip failed queries
    }
  }

  return JSON.stringify(results, null, 2);
}

async function generateWhitePaper(topic: string): Promise<{ title: string; body: string }> {
  const voiceGuide = loadVoiceGuide();
  const data = await gatherData(topic);

  // Step 1: Generate outline
  const outline = await agent.think(
    "You are a civic research writer. Create a detailed outline for a white paper.",
    `Create a detailed outline for a white paper about "${topic}" in New Orleans.

The outline should have:
- A compelling title
- Executive summary section
- 4-6 main sections with sub-points
- Each section should reference specific data points
- A conclusion with recommendations

Available data:\n${data}\n\nReturn the outline as plain text.`,
    { maxTokens: 1000 }
  );

  // Step 2: Generate the full paper section by section
  const fullPaper = await agent.think(
    `You are writing a comprehensive white paper about New Orleans civic issues. Follow this voice guide:\n\n${voiceGuide}\n\nRules:
- Authoritative but accessible — a smart friend explaining complex data
- Every claim backed by a specific number from the data
- No jargon, no consultant-speak
- 3,000-5,000 words
- Include an executive summary at the top
- End with specific, actionable recommendations
- Format in Markdown`,
    `Write a complete white paper based on this outline:\n\n${outline}\n\nData to cite:\n${data}\n\nTopic: "${topic}" in New Orleans.\n\nWrite the full paper now. Be thorough, data-driven, and specific.`,
    { model: "claude-sonnet-4-20250514", maxTokens: 8000 }
  );

  const titleMatch = fullPaper.match(/^#\s+(.+)/m);
  const title = titleMatch ? titleMatch[1] : `White Paper: ${topic}`;

  return { title, body: fullPaper };
}

async function main() {
  const topic = process.argv[2] || "short-term rentals and displacement";

  await agent.run(async () => {
    console.log(`[${agent.name}] Generating white paper on "${topic}"...`);

    const { title, body } = await generateWhitePaper(topic);

    // Store in Cloud Storage
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
    await agent.storeDocument(`whitepapers/${slug}.md`, body);

    // Submit to content queue
    const draftId = await agent.submitDraft({
      type: "white_paper",
      title,
      body,
      insightId: null,
    });

    console.log(`[${agent.name}] White paper draft created: ${draftId}`);
    console.log(`[${agent.name}] Title: ${title}`);
    console.log(`[${agent.name}] Length: ${body.length} characters (~${Math.round(body.split(/\s+/).length)} words)`);
  });
}

export { main, generateWhitePaper };

if (require.main === module) {
  main().catch((err) => {
    console.error(`[creator-whitepaper] Fatal:`, err);
    process.exit(1);
  });
}
