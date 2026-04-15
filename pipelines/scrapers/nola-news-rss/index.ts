/**
 * Louisiana / New Orleans news RSS aggregator.
 *
 * Fetches RSS feeds from the core LA political news outlets, ingests each new
 * article through the document pipeline (text → chunks → embeddings → claims),
 * and deduplicates by URL hash so rerunning doesn't double-ingest.
 *
 * This is Dark Horse's news backbone — runs nightly via Cloud Scheduler.
 */

import { retry, runScraper, type ScraperDefinition } from "@/lib/scraper/base";
import { ingestDocument } from "@/lib/ingest/document-pipeline";

// Curated to political / policy / investigative outlets. The previous list
// included local TV stations (WDSU, WWL-TV, Fox 8) which flooded the corpus
// with weather, sports, and non-policy crime — useful to drop before the
// Haiku relevance filter even runs. WWNO stays because NPR affiliates lean
// civic/policy. NOLA.com and Gambit stay but have the broadest surface; the
// relevance filter will still prune their non-political coverage.
export const FEEDS: Array<{ sourceSystem: string; url: string; label: string }> = [
  {
    sourceSystem: "louisiana_illuminator",
    url: "https://lailluminator.com/feed/",
    label: "Louisiana Illuminator",
  },
  {
    sourceSystem: "the_lens_nola",
    url: "https://thelensnola.org/feed/",
    label: "The Lens NOLA",
  },
  {
    sourceSystem: "verite_news",
    url: "https://veritenews.org/feed/",
    label: "Verite News",
  },
  {
    sourceSystem: "nola_com",
    url: "https://www.nola.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc",
    label: "NOLA.com / Times-Picayune",
  },
  {
    sourceSystem: "gambit",
    url: "https://www.nola.com/gambit/search/?f=rss&t=article&l=50&s=start_time&sd=desc",
    label: "Gambit",
  },
  {
    sourceSystem: "wwno",
    url: "https://www.wwno.org/rss/news",
    label: "WWNO (NPR / New Orleans)",
  },
  {
    sourceSystem: "louisiana_weekly",
    url: "https://www.louisianaweekly.com/feed/",
    label: "Louisiana Weekly",
  },
  {
    sourceSystem: "bayoubrief",
    url: "https://www.bayoubrief.com/feed",
    label: "Bayou Brief",
  },
];

interface RssItem {
  title: string;
  link: string;
  pubDate?: string;
  description?: string;
  contentEncoded?: string;
}

async function fetchFeed(url: string): Promise<RssItem[]> {
  const response = await fetch(url, {
    headers: { "User-Agent": "DarkHorse/1.0 (political research)" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`RSS ${response.status}: ${url}`);
  }
  const xml = await response.text();
  return parseRssItems(xml);
}

/**
 * Minimal RSS 2.0 / Atom parser — good enough for the feeds above without
 * adding an rss-parser dependency. Extracts <item>/<entry> blocks and pulls
 * title, link, pubDate/published, description/summary, and content:encoded.
 */
function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRegex = /<(item|entry)[^>]*>([\s\S]*?)<\/\1>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[2];
    const title = extractTag(block, "title");
    const link = extractLink(block);
    const pubDate = extractTag(block, "pubDate") ?? extractTag(block, "published");
    const description = extractTag(block, "description") ?? extractTag(block, "summary");
    const contentEncoded = extractTag(block, "content:encoded") ?? extractTag(block, "content");
    if (title && link) {
      items.push({ title, link, pubDate, description, contentEncoded });
    }
  }
  return items;
}

function extractTag(block: string, tag: string): string | undefined {
  const escaped = tag.replace(":", "\\:");
  const re = new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)</${escaped}>`, "i");
  const m = block.match(re);
  if (!m) return undefined;
  return stripCdataAndHtml(m[1]);
}

function extractLink(block: string): string | undefined {
  const inline = block.match(/<link[^>]*>([^<]+)<\/link>/i);
  if (inline) return inline[1].trim();
  const hrefAttr = block.match(/<link[^>]*href=["']([^"']+)["']/i);
  if (hrefAttr) return hrefAttr[1].trim();
  return undefined;
}

function stripCdataAndHtml(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export const nolaNewsRss: ScraperDefinition = {
  name: "scraper-nola-news-rss",
  sourceSystem: "rss",
  rateLimitPerSec: 2,
  async run(_args, ctx) {
    for (const feed of FEEDS) {
      try {
        await ctx.rateLimit.wait();
        const items = await retry(() => fetchFeed(feed.url));
        ctx.stats.recordsFetched += items.length;
        await ctx.saveRaw(`${feed.sourceSystem}.json`, items);

        for (const item of items) {
          try {
            const body = (item.contentEncoded ?? item.description ?? "").trim();
            if (!body || body.length < 100) continue;

            const result = await ingestDocument({
              sourceUrl: item.link,
              sourceSystem: feed.sourceSystem,
              docType: "rss_article",
              title: item.title,
              publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
              textContent: `${item.title}\n\n${body}`,
              metadata: { feed: feed.label },
            });

            if (!result.skipped) ctx.stats.recordsUpserted++;
          } catch (err) {
            ctx.logError(err, { feed: feed.sourceSystem, url: item.link });
          }
        }
      } catch (err) {
        ctx.logError(err, { feed: feed.sourceSystem, url: feed.url });
      }
    }
  },
};

if (import.meta.url === `file://${process.argv[1]}`) {
  runScraper(nolaNewsRss, {}).then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  });
}
