import { Agent } from "../../shared/agent-sdk";
import { readFileSync } from "fs";
import { join } from "path";

const agent = new Agent({
  name: "analyst-story-finder",
  version: "1.0.0",
  type: "analyst",
});

function loadVoiceGuide(): string {
  try {
    return readFileSync(join(process.cwd(), "data", "voice.md"), "utf-8");
  } catch {
    return "Write in a direct, conversational tone. No jargon, no corporate speak.";
  }
}

async function findTodaysStory() {
  await agent.run(async () => {
    console.log(`[${agent.name}] Finding today's story...`);

    // Query recent data across all domains
    const recentCouncil = await agent.queryKB(`
      SELECT meeting_date, title, summary, key_decisions
      FROM nola_pulse_kb.council_meetings
      WHERE ingested_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
      ORDER BY meeting_date DESC
      LIMIT 5
    `);

    const recentOutages = await agent.queryKB(`
      SELECT recorded_at, neighborhood, customers_out, cause
      FROM nola_pulse_kb.outage_timeseries
      WHERE ingested_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
      ORDER BY customers_out DESC
      LIMIT 10
    `);

    const recentNews = await agent.queryKB(`
      SELECT title, source, summary, topics, published_date
      FROM nola_pulse_kb.news_articles
      WHERE ingested_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 3 DAY)
      ORDER BY published_date DESC
      LIMIT 10
    `);

    const recentHousing = await agent.queryKB(`
      SELECT address, neighborhood, sale_price, sale_date
      FROM nola_pulse_kb.property_sales
      WHERE ingested_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
      ORDER BY sale_date DESC
      LIMIT 10
    `);

    // Build context for Claude
    const dataContext = JSON.stringify(
      {
        council: recentCouncil,
        outages: recentOutages,
        news: recentNews,
        housing: recentHousing,
      },
      null,
      2
    );

    const hasData = recentCouncil.length > 0 || recentOutages.length > 0 || recentNews.length > 0 || recentHousing.length > 0;

    // Ask Claude to identify the most compelling story
    const analysis = await agent.think(
      `You are a civic data analyst for New Orleans. Your job is to identify the single most compelling, newsworthy, or important civic story from today's data. Think like a local journalist who actually lives in New Orleans and cares about the city.

Focus on: what affects residents most, what holds power accountable, what reveals a pattern nobody is talking about, or what's genuinely surprising.`,
      `Here is the latest data from across New Orleans civic systems:

${hasData ? dataContext : "No recent data in the knowledge base yet. Use your knowledge of current New Orleans civic issues — Entergy outages, housing displacement, infrastructure failures, city council decisions, drainage problems, education challenges, or whatever is most pressing right now."}

Based on this data, identify the SINGLE most compelling story. Return your analysis in this exact JSON format:

{
  "type": "story",
  "headline": "One-line headline (under 15 words)",
  "summary": "2-3 paragraph analysis of why this matters and what the data shows",
  "dataPoints": [
    {"label": "stat name", "value": "stat value", "source": "where this came from"}
  ],
  "relevance": 85,
  "topics": ["energy", "housing", "council", "infrastructure", "education"],
  "suggestedFormats": ["article", "infographic", "tweet"]
}

Return ONLY the JSON, no markdown fences.`,
      { maxTokens: 2000 }
    );

    // Parse Claude's response
    let insight;
    try {
      insight = JSON.parse(analysis);
    } catch {
      // Claude sometimes wraps in markdown — strip it
      const cleaned = analysis.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      insight = JSON.parse(cleaned);
    }

    // Submit the insight
    const insightId = await agent.submitInsight(insight);
    console.log(`[${agent.name}] Created insight: ${insightId} — "${insight.headline}"`);

    // If relevance is high enough, also trigger article creation
    if (insight.relevance >= 70) {
      const voiceGuide = loadVoiceGuide();

      const articleBody = await agent.think(
        `You are writing a daily civic article about New Orleans as Frank Kyazze. Follow this voice guide EXACTLY:\n\n${voiceGuide}`,
        `Write today's NOLA Pulse daily article based on this story:

Headline: ${insight.headline}
Analysis: ${insight.summary}
Key Data: ${JSON.stringify(insight.dataPoints)}

The article should be 500-800 words. Open with a specific moment or fact, not a thesis. Write like you're talking to a friend at a bar who cares about this city. Include the data points naturally. End on resonance, not resolution.`,
        { maxTokens: 2000 }
      );

      // Submit as content draft for Frank's review
      const draftId = await agent.submitDraft({
        type: "article",
        title: insight.headline,
        body: articleBody,
        insightId,
      });

      console.log(`[${agent.name}] Created article draft: ${draftId}`);
    }
  });
}

export { findTodaysStory };

if (require.main === module) {
  findTodaysStory().catch((err) => {
    console.error(`[analyst-story-finder] Fatal error:`, err);
    process.exit(1);
  });
}
