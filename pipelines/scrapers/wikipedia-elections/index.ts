/**
 * Wikipedia elections scraper.
 *
 * Ballotpedia's CloudFront blocks Cloud Run IPs. Wikipedia has equivalent
 * election pages (usually more concise, sometimes less complete) and does
 * NOT block anything. Uses Wikipedia's API directly for clean text
 * extraction — no HTML scraping regex gymnastics.
 *
 * Returns page wikitext converted to plain prose via action=query&prop=extracts&explaintext=1.
 *
 * Default URLs cover Louisiana 2026 election pages. Override with args.urls.
 */

import { retry, runScraper, type ScraperDefinition } from "@/lib/scraper/base";
import { ingestDocument } from "@/lib/ingest/document-pipeline";

interface WikipediaArgs {
  /** Page titles on en.wikipedia.org. e.g. "2026 New Orleans mayoral election" */
  titles?: string[];
}

const DEFAULT_TITLES = [
  "2026 Louisiana elections",
  "2026 New Orleans mayoral election",
  "2026 Louisiana gubernatorial election",
  "Louisiana Secretary of State",
  "List of mayors of New Orleans",
  "Louisiana State Legislature",
  "New Orleans City Council",
  "Orleans Parish Criminal District Court",
  "Orleans Parish Civil District Court",
];

export const wikipediaElections: ScraperDefinition<WikipediaArgs> = {
  name: "scraper-wikipedia-elections",
  sourceSystem: "wikipedia_elections",
  rateLimitPerSec: 5,
  async run(args, ctx) {
    const titles = args.titles ?? DEFAULT_TITLES;

    for (const title of titles) {
      try {
        await ctx.rateLimit.wait();
        const body = await retry(() => fetchWikipediaExtract(title));
        ctx.stats.recordsFetched++;

        if (!body || body.text.length < 300) {
          ctx.logError(new Error(`too short (${body?.text.length ?? 0} chars)`), { title });
          continue;
        }

        await ctx.saveRaw(`${slug(title)}.json`, body);

        const sourceUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

        const result = await ingestDocument({
          sourceUrl,
          sourceSystem: "wikipedia_elections",
          docType: "html",
          title: body.title,
          textContent: `${body.title}\n\n${body.text}`,
          metadata: {
            scraper: "wikipedia-elections",
            pageId: body.pageId,
          },
        });

        if (!result.skipped) ctx.stats.recordsUpserted++;
      } catch (err) {
        ctx.logError(err, { title });
      }
    }
  },
};

interface WikipediaExtract {
  title: string;
  pageId: number;
  text: string;
}

async function fetchWikipediaExtract(title: string): Promise<WikipediaExtract | null> {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("prop", "extracts");
  url.searchParams.set("explaintext", "1");
  url.searchParams.set("redirects", "1");
  url.searchParams.set("titles", title);
  url.searchParams.set("origin", "*");

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "DarkHorse/1.0 (political OSINT research; contact via repo)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Wikipedia ${response.status}: ${title}`);
  }
  const data = (await response.json()) as {
    query?: {
      pages?: Record<
        string,
        { pageid?: number; title?: string; extract?: string; missing?: "" }
      >;
    };
  };
  const pages = data.query?.pages;
  if (!pages) return null;
  const firstKey = Object.keys(pages)[0];
  if (!firstKey) return null;
  const page = pages[firstKey];
  if (!page || page.missing !== undefined) return null;
  return {
    title: page.title ?? title,
    pageId: page.pageid ?? 0,
    text: page.extract ?? "",
  };
}

function slug(s: string): string {
  return s.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 80);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runScraper(wikipediaElections, {}).then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  });
}
