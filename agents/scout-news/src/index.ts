import { Agent } from "../../shared/agent-sdk";
import * as cheerio from "cheerio";

const agent = new Agent({ name: "scout-news", version: "1.0.0", type: "scout" });

// New Orleans local news RSS feeds
const RSS_FEEDS = [
  { name: "NOLA.com", url: "https://www.nola.com/search/?f=rss&t=article&c=news&l=50&s=start_time&sd=desc" },
  { name: "WWNO", url: "https://www.wwno.org/rss.xml" },
  { name: "The Lens", url: "https://thelensnola.org/feed/" },
  { name: "Gambit", url: "https://www.nola.com/gambit/search/?f=rss&t=article&l=25&s=start_time&sd=desc" },
];

interface NewsArticle {
  source: string;
  url: string;
  title: string;
  published_date: string;
  summary: string;
  full_text: string | null;
  topics: string | null;
}

async function parseRSSFeed(feedUrl: string, sourceName: string): Promise<NewsArticle[]> {
  try {
    const response = await fetch(feedUrl, {
      headers: { "User-Agent": "NOLAPulse/1.0 (civic-data-platform)" },
    });

    if (!response.ok) {
      console.log(`[${agent.name}] Failed to fetch ${sourceName}: ${response.status}`);
      return [];
    }

    const xml = await response.text();
    const $ = cheerio.load(xml, { xml: true });
    const articles: NewsArticle[] = [];

    $("item").each((_, item) => {
      const title = $(item).find("title").text().trim();
      const link = $(item).find("link").text().trim();
      const pubDate = $(item).find("pubDate").text().trim();
      const description = $(item).find("description").text().trim();

      if (title && link) {
        articles.push({
          source: sourceName,
          url: link,
          title,
          published_date: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
          summary: description.replace(/<[^>]*>/g, "").slice(0, 500),
          full_text: null,
          topics: null,
        });
      }
    });

    return articles;
  } catch (err) {
    console.log(`[${agent.name}] Error fetching ${sourceName}:`, err);
    return [];
  }
}

async function main() {
  await agent.run(async () => {
    console.log(`[${agent.name}] Scanning ${RSS_FEEDS.length} news sources...`);

    let totalCount = 0;

    for (const feed of RSS_FEEDS) {
      const articles = await parseRSSFeed(feed.url, feed.name);

      if (articles.length > 0) {
        const rows = articles.map((a) => ({
          ...a,
          ingested_at: new Date().toISOString(),
        }));
        await agent.insertKB("news_articles", rows);
        totalCount += rows.length;
        console.log(`[${agent.name}] ${feed.name}: ${articles.length} articles`);
      }
    }

    await agent.publish("data.ingested", { source: "news", recordCount: totalCount });
    console.log(`[${agent.name}] Complete. ${totalCount} articles ingested.`);
  });
}

export { main };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
