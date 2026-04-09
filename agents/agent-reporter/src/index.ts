/**
 * Reporter Agent — finds scoops by crossing civic data with trends
 *
 * Generates 3-5 story pitches per run.
 * Output goes to the Editor Agent for quality gate.
 */

import { Agent } from "../../shared/agent-sdk";

const agent = new Agent({ name: "agent-reporter", version: "1.0.0", type: "analyst" });

export interface StoryPitch {
  headline: string;
  angle: string;
  dataPoints: { stat: string; source: string }[];
  format: "article" | "short_take" | "infographic" | "meme";
  trendConnection: string | null;
  confidence: number;
}

async function main() {
  await agent.run(async () => {
    console.log(`[${agent.name}] Finding scoops...`);

    // Gather civic data summaries
    const civicData = await Promise.all([
      agent.queryKB("SELECT request_type, COUNT(*) as c FROM nola_pulse_kb.service_requests_311 WHERE request_type IS NOT NULL GROUP BY request_type ORDER BY c DESC LIMIT 5"),
      agent.queryKB("SELECT neighborhood, COUNT(*) as c FROM nola_pulse_kb.str_permits WHERE neighborhood IS NOT NULL GROUP BY neighborhood ORDER BY c DESC LIMIT 5"),
      agent.queryKB("SELECT COUNT(*) as total FROM nola_pulse_kb.blight_cases"),
      agent.queryKB("SELECT COUNT(*) as total FROM nola_pulse_kb.demolitions"),
      agent.queryKB("SELECT force_type, COUNT(*) as c FROM nola_pulse_kb.use_of_force WHERE force_type IS NOT NULL GROUP BY force_type ORDER BY c DESC LIMIT 5"),
      agent.queryKB("SELECT signal_description, COUNT(*) as c FROM nola_pulse_kb.police_reports WHERE signal_description IS NOT NULL GROUP BY signal_description ORDER BY c DESC LIMIT 5"),
    ]);

    // Gather trends
    let trends: any[] = [];
    try {
      trends = await agent.queryKB("SELECT source, topic, score FROM nola_pulse_kb.trends ORDER BY ingested_at DESC LIMIT 20");
    } catch { /* trends table might be empty */ }

    // Ask Claude to find the scoops
    const pitchesRaw = await agent.think(
      `You are a reporter for NOLA Pulse, a New Orleans news outlet. Your job is to find 3-5 story pitches by analyzing civic data and current trends.

A good pitch:
- Has a specific, surprising angle (not "crime is bad" — that's obvious)
- Connects a data point to something people care about right now
- Could make someone say "wait, seriously?" or text it to a friend
- Has a clear format: full article, short take (2-3 paragraphs), infographic, or meme

A bad pitch:
- States the obvious
- Has no specific data to back it up
- Requires data we don't have
- Would bore someone at a bar`,
      `Here's what we have:

CIVIC DATA:
${JSON.stringify(civicData, null, 2)}

TRENDING TOPICS:
${JSON.stringify(trends.slice(0, 15), null, 2)}

Generate 3-5 story pitches. Return as a JSON array:
[
  {
    "headline": "Specific, compelling headline",
    "angle": "2-3 sentences explaining the angle and why it's interesting",
    "dataPoints": [{"stat": "the specific number", "source": "which table"}],
    "format": "article|short_take|infographic|meme",
    "trendConnection": "what trend this connects to, or null",
    "confidence": 85
  }
]

Return ONLY the JSON array.`,
      { maxTokens: 2000 }
    );

    let pitches: StoryPitch[];
    try {
      pitches = JSON.parse(pitchesRaw);
    } catch {
      pitches = JSON.parse(pitchesRaw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
    }

    // Store pitches for the editor
    for (const pitch of pitches) {
      await agent.submitInsight({
        type: "story",
        headline: pitch.headline,
        summary: `${pitch.angle}\n\nFormat: ${pitch.format}\nTrend: ${pitch.trendConnection || "none"}`,
        dataPoints: pitch.dataPoints.map((d) => ({ label: d.stat, value: d.stat, source: d.source })),
        relevance: pitch.confidence,
        topics: ["pitch"],
        suggestedFormats: [pitch.format],
      });
    }

    console.log(`[${agent.name}] Generated ${pitches.length} pitches:`);
    pitches.forEach((p, i) => console.log(`  ${i + 1}. [${p.format}] ${p.headline} (confidence: ${p.confidence})`));
  });
}

export { main };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
