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
      `You are a data journalist for NOLA Pulse, a New Orleans news outlet. Your job is to find the most interesting, surprising, or revealing data point from today's civic records.

Look for: things that are absurd when you actually look at the numbers, patterns nobody is talking about, comparisons that reveal priorities, or stats that tell a bigger story. The goal is to find scoops — things that make people say "wait, seriously?"

You're not trying to be funny. You're finding real stories in real data. If the story happens to be absurd, that's because reality is absurd.`,
      `Here is the latest data from across New Orleans civic systems:

${hasData ? dataContext : "No recent data in the knowledge base yet. Use your knowledge of current New Orleans civic issues — Entergy outages, housing displacement, infrastructure failures, city council decisions, drainage problems, education challenges, or whatever is most pressing right now."}

Based on this data, find the SINGLE most interesting story. Write a headline that's compelling and specific — a real headline, not a joke. Return in this exact JSON format:

{
  "type": "story",
  "headline": "Compelling, specific headline (under 15 words, reads like real news)",
  "summary": "2-3 paragraph story setup explaining why this matters and what the data shows",
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
        `You are writing an article for NOLA Pulse, a New Orleans news outlet. Follow this voice guide EXACTLY:\n\n${voiceGuide}\n\nYou're a journalist who lives in New Orleans and writes about the city with the same energy you'd use telling a friend about something wild you just found out. You take the reporting seriously — every number is real, every fact is sourced — but your voice is distinctly human. Sarcasm when it's earned. Metaphors that land. The kind of writing that makes someone text the link to their group chat.`,
        `Write an article based on this:

Headline: ${insight.headline}
Context: ${insight.summary}
Data: ${JSON.stringify(insight.dataPoints)}

500-700 words. Lead with the most striking fact. Write it straight — the absurdity of the data speaks for itself. Use Frank's voice: direct, conversational, occasionally devastating. Every stat cited must be the real number. No fake quotes. End with something that sits with the reader.`,
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
