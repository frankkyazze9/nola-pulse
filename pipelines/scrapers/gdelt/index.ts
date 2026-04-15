/**
 * GDELT 2.0 DOC API scraper.
 *
 * Free 15-minute-delayed news firehose covering most online outlets globally.
 * Used to catch LA/NOLA political coverage from outlets not in the nola-news-rss
 * list and to pick up national coverage of LA figures.
 *
 * Docs: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
 */

import { runScraper, type ScraperDefinition } from "@/lib/scraper/base";
import { ingestDocument } from "@/lib/ingest/document-pipeline";

const GDELT_DOC_URL = "https://api.gdeltproject.org/api/v2/doc/doc";

interface GdeltArgs {
  /** Keyword or phrase query. Defaults to a Louisiana political sweep. */
  query?: string;
  /** Time window in hours (default 24). */
  hours?: number;
  /** Max articles to pull per run. Default 250. */
  maxRecords?: number;
}

interface GdeltArticle {
  url: string;
  title: string;
  seendate: string; // YYYYMMDDHHMMSS
  sourcecountry: string;
  language: string;
  domain: string;
}

const DEFAULT_QUERY =
  '(Louisiana OR "New Orleans" OR NOLA OR "Baton Rouge") AND (mayor OR council OR judge OR senator OR representative OR election OR candidate OR indictment OR "district attorney")';

export const gdelt: ScraperDefinition<GdeltArgs> = {
  name: "scraper-gdelt",
  sourceSystem: "gdelt",
  // GDELT explicitly asks for no more than 1 request per 5 seconds.
  // 0.2 req/sec = 5s between calls.
  rateLimitPerSec: 0.2,
  async run(args, ctx) {
    const query = args.query ?? DEFAULT_QUERY;
    const hours = args.hours ?? 24;
    const maxRecords = args.maxRecords ?? 250;

    await ctx.rateLimit.wait();
    const url = new URL(GDELT_DOC_URL);
    url.searchParams.set("query", query);
    url.searchParams.set("mode", "ArtList");
    url.searchParams.set("format", "JSON");
    url.searchParams.set("timespan", `${hours}h`);
    url.searchParams.set("maxrecords", String(maxRecords));
    url.searchParams.set("sort", "DateDesc");

    // GDELT enforces 1-req-per-5-sec globally per client. A fast retry on 429
    // digs us deeper — wait 15s and try once more, then give up (cron fires
    // again next hour).
    const data = await fetchGdelt(url.toString());

    const articles = data.articles ?? [];
    ctx.stats.recordsFetched += articles.length;
    await ctx.saveRaw("articles.json", data);

    for (const article of articles) {
      try {
        // GDELT returns URL + title only; fetch the article body separately.
        const body = await fetchArticleBody(article.url);
        if (!body || body.length < 200) continue;

        const result = await ingestDocument({
          sourceUrl: article.url,
          sourceSystem: "gdelt",
          docType: "html",
          title: article.title,
          publishedAt: parseGdeltDate(article.seendate),
          textContent: `${article.title}\n\n${body}`,
          metadata: {
            domain: article.domain,
            language: article.language,
            country: article.sourcecountry,
          },
        });

        if (!result.skipped) ctx.stats.recordsUpserted++;
      } catch (err) {
        ctx.logError(err, { url: article.url });
      }
    }
  },
};

async function fetchGdelt(url: string): Promise<{ articles?: GdeltArticle[] }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(url);
    if (response.ok) {
      return response.json() as Promise<{ articles?: GdeltArticle[] }>;
    }
    const body = await response.text().catch(() => "");
    if (response.status === 429 && attempt === 0) {
      // Honour the published rate limit — wait well past 5s before retrying.
      await new Promise((r) => setTimeout(r, 15_000));
      continue;
    }
    throw new Error(`GDELT ${response.status}: ${body}`);
  }
  throw new Error("GDELT: unreachable");
}

async function fetchArticleBody(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "DarkHorse/1.0 (political research)" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return null;
    const html = await response.text();
    // Very simple body extraction — strip HTML, collapse whitespace.
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return null;
  }
}

function parseGdeltDate(s: string): Date | undefined {
  if (!s || s.length < 14) return undefined;
  const year = Number(s.slice(0, 4));
  const month = Number(s.slice(4, 6)) - 1;
  const day = Number(s.slice(6, 8));
  const hour = Number(s.slice(8, 10));
  const minute = Number(s.slice(10, 12));
  const second = Number(s.slice(12, 14));
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    year < 1900 ||
    year > 2200
  ) {
    return undefined;
  }
  const d = new Date(Date.UTC(year, month, day, hour, minute, second));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runScraper(gdelt, {}).then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  });
}
