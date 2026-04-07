/**
 * Infographic Creator Agent
 *
 * Generates shareable data visualizations with comedic copy.
 * Outputs: HTML/SVG infographic + tweet-ready caption.
 * Content goes to admin review queue before publishing.
 */

import { Agent } from "../../shared/agent-sdk";
import { readFileSync } from "fs";
import { join } from "path";

const agent = new Agent({
  name: "creator-infographic",
  version: "1.0.0",
  type: "creator",
});

function loadVoiceGuide(): string {
  try {
    return readFileSync(join(process.cwd(), "data", "voice.md"), "utf-8");
  } catch {
    return "Direct, funny, data-driven. No corporate speak.";
  }
}

interface InfographicData {
  headline: string;
  subtitle: string;
  stats: { label: string; value: string; context: string }[];
  caption: string;
  tweetText: string;
  svgMarkup: string;
}

async function findBestDataPoint(): Promise<{ topic: string; data: string }> {
  const queries = [
    {
      topic: "311 complaints",
      sql: `SELECT request_type, COUNT(*) as count FROM nola_pulse_kb.service_requests_311
            WHERE request_type IS NOT NULL GROUP BY request_type ORDER BY count DESC LIMIT 5`,
    },
    {
      topic: "STR displacement",
      sql: `SELECT neighborhood, COUNT(*) as count FROM nola_pulse_kb.str_permits
            WHERE neighborhood IS NOT NULL GROUP BY neighborhood ORDER BY count DESC LIMIT 5`,
    },
    {
      topic: "blight crisis",
      sql: `SELECT COUNT(*) as total_cases FROM nola_pulse_kb.blight_cases`,
    },
    {
      topic: "police use of force",
      sql: `SELECT force_type, COUNT(*) as count FROM nola_pulse_kb.use_of_force
            WHERE force_type IS NOT NULL GROUP BY force_type ORDER BY count DESC LIMIT 5`,
    },
    {
      topic: "demolitions",
      sql: `SELECT program, COUNT(*) as count FROM nola_pulse_kb.demolitions
            WHERE program IS NOT NULL GROUP BY program ORDER BY count DESC LIMIT 5`,
    },
  ];

  // Pick a random topic for variety
  const q = queries[Math.floor(Math.random() * queries.length)];
  const results = await agent.queryKB(q.sql);
  return { topic: q.topic, data: JSON.stringify(results) };
}

async function generateInfographic(): Promise<InfographicData> {
  const voiceGuide = loadVoiceGuide();
  const { topic, data } = await findBestDataPoint();

  const response = await agent.think(
    `You are creating a shareable data infographic for @nolapulse about New Orleans civic data.

Voice guide: ${voiceGuide}

You create infographics that are:
- Visually striking (dark background, gold accent color #c8a951, white text)
- Funny in a "laugh so you don't cry" way
- Based on real data with specific numbers
- Shareable — people screenshot these and post them

Output a JSON object with these fields:
- headline: punchy headline (under 8 words)
- subtitle: comedic one-liner that adds context
- stats: array of 2-4 stats, each with label, value, and context (one sentence)
- caption: 2-3 sentence Instagram/social caption
- tweetText: tweet-ready text (under 280 chars)
- svgMarkup: a complete SVG infographic (800x1000px, dark bg #0f1117, gold accent #c8a951, white text, clean modern typography)

Return ONLY valid JSON, no markdown fences.`,
    `Create an infographic about "${topic}" using this data:\n\n${data}\n\nMake it funny, shareable, and based on the actual numbers.`,
    { maxTokens: 3000 }
  );

  try {
    return JSON.parse(response);
  } catch {
    const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  }
}

async function main() {
  await agent.run(async () => {
    console.log(`[${agent.name}] Generating infographic...`);

    const infographic = await generateInfographic();

    // Store SVG in Cloud Storage
    if (infographic.svgMarkup) {
      await agent.storeDocument(
        `infographics/${new Date().toISOString().split("T")[0]}.svg`,
        infographic.svgMarkup
      );
    }

    // Submit to content queue
    const body = [
      `# ${infographic.headline}`,
      `*${infographic.subtitle}*`,
      "",
      ...infographic.stats.map((s) => `**${s.label}:** ${s.value} — ${s.context}`),
      "",
      `---`,
      `**Caption:** ${infographic.caption}`,
      `**Tweet:** ${infographic.tweetText}`,
    ].join("\n");

    const draftId = await agent.submitDraft({
      type: "infographic",
      title: infographic.headline,
      body,
      insightId: null,
    });

    console.log(`[${agent.name}] Created infographic draft: ${draftId}`);
    console.log(`[${agent.name}] Headline: ${infographic.headline}`);
    console.log(`[${agent.name}] Tweet: ${infographic.tweetText}`);
  });
}

export { main, generateInfographic };

if (require.main === module) {
  main().catch((err) => {
    console.error(`[creator-infographic] Fatal:`, err);
    process.exit(1);
  });
}
