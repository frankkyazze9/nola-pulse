/**
 * Trend Scout — monitors what's trending in pop culture and memes
 *
 * Sources: Reddit r/NewOrleans, imgflip trending memes, Google Trends, RSS
 */

import { Agent } from "../../shared/agent-sdk";

const agent = new Agent({ name: "scout-trends", version: "1.0.0", type: "scout" });

interface Trend {
  source: string;
  topic: string;
  score: number;
  url: string | null;
  context: string | null;
  ingested_at: string;
}

async function fetchRedditTrending(): Promise<Trend[]> {
  try {
    const res = await fetch("https://www.reddit.com/r/NewOrleans/hot.json?limit=20", {
      headers: { "User-Agent": "NOLAPulse/1.0" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data.children.map((post: any) => ({
      source: "reddit-nola",
      topic: post.data.title,
      score: post.data.score,
      url: `https://reddit.com${post.data.permalink}`,
      context: post.data.selftext?.slice(0, 300) || null,
      ingested_at: new Date().toISOString(),
    }));
  } catch { return []; }
}

async function fetchImgflipTrending(): Promise<Trend[]> {
  try {
    const res = await fetch("https://api.imgflip.com/get_memes");
    if (!res.ok) return [];
    const data = await res.json();
    // imgflip returns memes sorted by popularity
    return data.data.memes.slice(0, 15).map((meme: any) => ({
      source: "imgflip",
      topic: meme.name,
      score: meme.box_count || 0,
      url: meme.url,
      context: `Template: ${meme.name} (${meme.width}x${meme.height})`,
      ingested_at: new Date().toISOString(),
    }));
  } catch { return []; }
}

async function fetchGoogleTrends(): Promise<Trend[]> {
  try {
    // Google Trends RSS for New Orleans related
    const res = await fetch("https://trends.google.com/trending/rss?geo=US-LA");
    if (!res.ok) return [];
    const text = await res.text();
    const titles = text.match(/<title>([^<]+)<\/title>/g)?.slice(1, 16) || [];
    return titles.map((t, i) => ({
      source: "google-trends",
      topic: t.replace(/<\/?title>/g, ""),
      score: 100 - i * 5,
      url: null,
      context: "Trending search in Louisiana",
      ingested_at: new Date().toISOString(),
    }));
  } catch { return []; }
}

async function main() {
  await agent.run(async () => {
    console.log(`[${agent.name}] Scanning trend sources...`);

    const [reddit, imgflip, google] = await Promise.all([
      fetchRedditTrending(),
      fetchImgflipTrending(),
      fetchGoogleTrends(),
    ]);

    const allTrends = [...reddit, ...imgflip, ...google];

    if (allTrends.length > 0) {
      await agent.insertKB("trends", allTrends);
    }

    await agent.publish("data.ingested", {
      source: "trends",
      reddit: reddit.length,
      imgflip: imgflip.length,
      google: google.length,
    });

    console.log(`[${agent.name}] Complete. Reddit: ${reddit.length}, imgflip: ${imgflip.length}, Google: ${google.length}`);
  });
}

export { main };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
