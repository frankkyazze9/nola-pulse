/**
 * Twitter/X Publisher Agent
 *
 * Generates and posts civic data tweets from the knowledge base.
 * Content types:
 *   - Daily data drops (interesting stats from BigQuery)
 *   - Article teasers (when new articles are published)
 *   - Infographic-style threads (multi-tweet breakdowns)
 *   - Hot takes on civic data (Frank's voice)
 *
 * Usage:
 *   npx tsx agents/publisher-twitter/src/index.ts           # Generate + post daily tweet
 *   npx tsx agents/publisher-twitter/src/index.ts draft      # Generate draft only (no post)
 *   npx tsx agents/publisher-twitter/src/index.ts thread      # Generate a data thread
 */

import { Agent } from "../../shared/agent-sdk";
import { TwitterApi } from "twitter-api-v2";
import { readFileSync } from "fs";
import { join } from "path";

const agent = new Agent({
  name: "publisher-twitter",
  version: "1.0.0",
  type: "publisher",
});

function getTwitterClient(): TwitterApi | null {
  const appKey = process.env.TWITTER_API_KEY;
  const appSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_SECRET;

  if (!appKey || !appSecret || !accessToken || !accessSecret) {
    console.log(`[${agent.name}] Twitter API keys not configured — draft mode only`);
    return null;
  }

  return new TwitterApi({
    appKey,
    appSecret,
    accessToken,
    accessSecret,
  });
}

function loadVoiceGuide(): string {
  try {
    return readFileSync(join(process.cwd(), "data", "voice.md"), "utf-8");
  } catch {
    return "Write in a direct, conversational, slightly irreverent tone. No corporate speak.";
  }
}

async function generateDailyTweet(): Promise<{ tweet: string; dataSource: string }> {
  // Pull interesting data points from BigQuery
  const queries = [
    {
      name: "311",
      sql: `SELECT request_type, COUNT(*) as count FROM nola_pulse_kb.service_requests_311
            WHERE request_type IS NOT NULL GROUP BY request_type ORDER BY count DESC LIMIT 3`,
    },
    {
      name: "str",
      sql: `SELECT COUNT(*) as total FROM nola_pulse_kb.str_permits`,
    },
    {
      name: "blight",
      sql: `SELECT COUNT(*) as total FROM nola_pulse_kb.blight_cases`,
    },
    {
      name: "crime",
      sql: `SELECT signal_description, COUNT(*) as count FROM nola_pulse_kb.police_reports
            WHERE signal_description IS NOT NULL GROUP BY signal_description ORDER BY count DESC LIMIT 3`,
    },
    {
      name: "demolitions",
      sql: `SELECT COUNT(*) as total FROM nola_pulse_kb.demolitions`,
    },
    {
      name: "uof",
      sql: `SELECT COUNT(*) as total FROM nola_pulse_kb.use_of_force`,
    },
  ];

  const results: Record<string, any> = {};
  for (const q of queries) {
    try {
      results[q.name] = await agent.queryKB(q.sql);
    } catch {
      results[q.name] = [];
    }
  }

  const voiceGuide = loadVoiceGuide();
  const dataContext = JSON.stringify(results, null, 2);

  const tweet = await agent.think(
    `You are writing a tweet for @nolapulse, a civic data account for New Orleans. Follow this voice guide:\n\n${voiceGuide}\n\nRules:\n- Max 280 characters\n- Include one specific data point\n- Make it shareable — funny, surprising, or outrage-inducing\n- No hashtags (they're corny)\n- No emojis unless absolutely necessary\n- Think @lookatthisfuckinstreet meets data journalism\n- End with a link to the dashboard: nolapulse.com (placeholder)`,
    `Write ONE tweet based on this New Orleans civic data:\n\n${dataContext}\n\nPick the most interesting, surprising, or infuriating data point. Make people want to share it. Return ONLY the tweet text, nothing else.`,
    { maxTokens: 200 }
  );

  return { tweet: tweet.trim(), dataSource: "BigQuery civic data" };
}

async function generateThread(): Promise<string[]> {
  const voiceGuide = loadVoiceGuide();

  // Get comprehensive data for a thread
  const [str, blight, demos, uof] = await Promise.all([
    agent.queryKB("SELECT COUNT(*) as total FROM nola_pulse_kb.str_permits"),
    agent.queryKB("SELECT COUNT(*) as total FROM nola_pulse_kb.blight_cases"),
    agent.queryKB("SELECT COUNT(*) as total FROM nola_pulse_kb.demolitions"),
    agent.queryKB("SELECT COUNT(*) as total FROM nola_pulse_kb.use_of_force"),
  ]);

  const threadText = await agent.think(
    `You are writing a Twitter/X thread for @nolapulse. Follow this voice guide:\n\n${voiceGuide}\n\nRules:\n- 4-6 tweets in the thread\n- Each tweet is max 280 characters\n- Start with a hook that makes people stop scrolling\n- Each tweet builds on the last\n- Include specific numbers\n- End with a call to action or a mic-drop line\n- Separate tweets with ---\n- No hashtags, minimal emojis`,
    `Write a Twitter thread about New Orleans civic data. Here are the facts:\n- ${(str[0] as any)?.total || 0} active short-term rental licenses\n- ${(blight[0] as any)?.total || 0} active blight cases\n- ${(demos[0] as any)?.total || 0} properties demolished\n- ${(uof[0] as any)?.total || 0} documented use-of-force incidents by NOPD\n\nMake it compelling. Return ONLY the tweets separated by ---`,
    { maxTokens: 1000 }
  );

  return threadText.split("---").map((t) => t.trim()).filter((t) => t.length > 0);
}

async function postTweet(text: string): Promise<string | null> {
  const client = getTwitterClient();
  if (!client) {
    console.log(`[${agent.name}] DRAFT (not posted):\n\n${text}\n`);
    return null;
  }

  const result = await client.v2.tweet(text);
  const tweetId = result.data.id;
  console.log(`[${agent.name}] Posted tweet: https://x.com/nolapulse/status/${tweetId}`);
  return tweetId;
}

async function postThread(tweets: string[]): Promise<string[]> {
  const client = getTwitterClient();
  if (!client) {
    console.log(`[${agent.name}] DRAFT THREAD (not posted):\n`);
    tweets.forEach((t, i) => console.log(`  ${i + 1}. ${t}\n`));
    return [];
  }

  const ids: string[] = [];
  let replyTo: string | undefined;

  for (const tweet of tweets) {
    const result = await client.v2.tweet(tweet, replyTo ? { reply: { in_reply_to_tweet_id: replyTo } } : undefined);
    ids.push(result.data.id);
    replyTo = result.data.id;
  }

  console.log(`[${agent.name}] Posted thread: https://x.com/nolapulse/status/${ids[0]}`);
  return ids;
}

async function main() {
  const command: string = process.argv[2] || "draft";

  await agent.run(async () => {
    if (command === "thread") {
      console.log(`[${agent.name}] Generating data thread...`);
      const tweets = await generateThread();

      // Store draft
      await agent.submitDraft({
        type: "tweet",
        title: `Twitter Thread — ${new Date().toISOString().split("T")[0]}`,
        body: tweets.join("\n\n---\n\n"),
        insightId: null,
      });

      console.log(`\nDRAFT THREAD:\n`);
      tweets.forEach((t, i) => console.log(`${i + 1}. ${t}\n`));
    } else {
      console.log(`[${agent.name}] Generating daily tweet...`);
      const { tweet } = await generateDailyTweet();

      // Store draft
      await agent.submitDraft({
        type: "tweet",
        title: `Daily Tweet — ${new Date().toISOString().split("T")[0]}`,
        body: tweet,
        insightId: null,
      });

      if (command === "post") {
        await postTweet(tweet);
      } else {
        console.log(`\nDRAFT TWEET:\n${tweet}\n`);
      }
    }
  });
}

export { main, generateDailyTweet, generateThread, postTweet, postThread };

if (require.main === module) {
  main().catch((err) => {
    console.error(`[publisher-twitter] Fatal:`, err);
    process.exit(1);
  });
}
