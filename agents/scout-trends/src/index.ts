/**
 * Trend Scout — monitors what's trending in pop culture, memes, and NOLA
 *
 * Sources (all free, no auth unless noted):
 * - Reddit r/NewOrleans, r/memes, r/MemeEconomy (hot + rising)
 * - imgflip top meme templates
 * - memegen.link open source meme templates
 * - Google Trends RSS (daily trending searches)
 * - Giphy trending GIFs (free key required)
 * - Tenor trending search terms (free key)
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

const REDDIT_SUBS = [
  { sub: "NewOrleans", sort: "hot", limit: 20 },
  { sub: "memes", sort: "hot", limit: 15 },
  { sub: "MemeEconomy", sort: "rising", limit: 10 },
  { sub: "dankmemes", sort: "hot", limit: 10 },
];

async function fetchReddit(): Promise<Trend[]> {
  const trends: Trend[] = [];
  for (const { sub, sort, limit } of REDDIT_SUBS) {
    try {
      const res = await fetch(`https://www.reddit.com/r/${sub}/${sort}.json?limit=${limit}`, {
        headers: { "User-Agent": "NOLAPulse/1.0" },
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const post of data.data.children) {
        trends.push({
          source: `reddit-${sub}`,
          topic: post.data.title,
          score: post.data.score,
          url: `https://reddit.com${post.data.permalink}`,
          context: post.data.selftext?.slice(0, 200) || null,
          ingested_at: new Date().toISOString(),
        });
      }
    } catch { /* skip failed subs */ }
  }
  return trends;
}

async function fetchImgflip(): Promise<Trend[]> {
  try {
    const res = await fetch("https://api.imgflip.com/get_memes");
    if (!res.ok) return [];
    const data = await res.json();
    return data.data.memes.slice(0, 20).map((meme: any, i: number) => ({
      source: "imgflip",
      topic: meme.name,
      score: 100 - i,
      url: meme.url,
      context: `Meme template: ${meme.name} (${meme.box_count} text boxes)`,
      ingested_at: new Date().toISOString(),
    }));
  } catch { return []; }
}

async function fetchMemegen(): Promise<Trend[]> {
  try {
    const res = await fetch("https://api.memegen.link/templates");
    if (!res.ok) return [];
    const data = await res.json();
    return data.slice(0, 15).map((t: any, i: number) => ({
      source: "memegen",
      topic: t.name,
      score: 50 - i,
      url: t.example?.url || null,
      context: `Open source meme template: ${t.id}`,
      ingested_at: new Date().toISOString(),
    }));
  } catch { return []; }
}

async function fetchGoogleTrends(): Promise<Trend[]> {
  try {
    const res = await fetch("https://trends.google.com/trending/rss?geo=US");
    if (!res.ok) return [];
    const text = await res.text();
    const items = text.match(/<item>[\s\S]*?<\/item>/g) || [];
    return items.slice(0, 15).map((item, i) => {
      const title = item.match(/<title>([^<]+)<\/title>/)?.[1] || "Unknown";
      const traffic = item.match(/<ht:approx_traffic>([^<]+)<\/ht:approx_traffic>/)?.[1] || "";
      return {
        source: "google-trends",
        topic: title,
        score: 100 - i * 5,
        url: null,
        context: traffic ? `~${traffic} searches` : "Trending search US",
        ingested_at: new Date().toISOString(),
      };
    });
  } catch { return []; }
}

async function fetchGiphy(): Promise<Trend[]> {
  const key = process.env.GIPHY_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${key}&limit=15`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.data.map((gif: any, i: number) => ({
      source: "giphy",
      topic: gif.title || "Trending GIF",
      score: 80 - i * 3,
      url: gif.url,
      context: `Trending GIF: ${gif.title}`,
      ingested_at: new Date().toISOString(),
    }));
  } catch { return []; }
}

async function main() {
  await agent.run(async () => {
    console.log(`[${agent.name}] Scanning trend sources...`);

    const [reddit, imgflip, memegen, google, giphy] = await Promise.all([
      fetchReddit(),
      fetchImgflip(),
      fetchMemegen(),
      fetchGoogleTrends(),
      fetchGiphy(),
    ]);

    const allTrends = [...reddit, ...imgflip, ...memegen, ...google, ...giphy];

    if (allTrends.length > 0) {
      await agent.insertKB("trends", allTrends);
    }

    console.log(`[${agent.name}] Complete:`);
    console.log(`  Reddit: ${reddit.length} (${REDDIT_SUBS.map(s => s.sub).join(", ")})`);
    console.log(`  imgflip: ${imgflip.length} meme templates`);
    console.log(`  memegen: ${memegen.length} templates`);
    console.log(`  Google Trends: ${google.length} trending searches`);
    console.log(`  Giphy: ${giphy.length} trending GIFs`);
    console.log(`  Total: ${allTrends.length} trends ingested`);

    await agent.publish("data.ingested", {
      source: "trends",
      total: allTrends.length,
    });
  });
}

export { main };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
