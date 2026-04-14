/**
 * Ballotpedia scraper — ingests election preview pages for Louisiana races.
 *
 * Ballotpedia has free, scrapable HTML for election previews. We ingest each
 * page as a Document (docType: "html", sourceSystem: "ballotpedia"). The brain
 * then reads those documents and registers Election/Candidacy rows via the
 * create_election/create_candidacy/upsert_person_by_name tools.
 *
 * Scraper args:
 *   urls: string[] — explicit Ballotpedia URLs to ingest
 *
 * Example URLs:
 *   https://ballotpedia.org/Louisiana_elections,_2026
 *   https://ballotpedia.org/Orleans_Parish,_Louisiana,_elections,_2026
 *
 * Rate limit: 1 req/sec (Ballotpedia is generous but we're polite).
 */

import { retry, runScraper, type ScraperDefinition } from "@/lib/scraper/base";
import { ingestDocument } from "@/lib/ingest/document-pipeline";

interface BallotpediaArgs {
  urls?: string[];
}

const DEFAULT_URLS = [
  "https://ballotpedia.org/Louisiana_elections,_2026",
  "https://ballotpedia.org/Orleans_Parish,_Louisiana,_elections,_2026",
  "https://ballotpedia.org/Municipal_elections_in_New_Orleans,_Louisiana_(May_12,_2026)",
];

export const ballotpedia: ScraperDefinition<BallotpediaArgs> = {
  name: "scraper-ballotpedia",
  sourceSystem: "ballotpedia",
  rateLimitPerSec: 1,
  async run(args, ctx) {
    const urls = args.urls ?? DEFAULT_URLS;

    for (const url of urls) {
      try {
        await ctx.rateLimit.wait();
        const body = await retry(async () => {
          const response = await fetch(url, {
            headers: {
              "User-Agent": "DarkHorse/1.0 (political research)",
            },
            signal: AbortSignal.timeout(30_000),
          });
          if (response.status === 404) {
            throw new Error(`404 ${url}`);
          }
          if (!response.ok) {
            throw new Error(`Ballotpedia ${response.status}: ${url}`);
          }
          return response.text();
        });

        ctx.stats.recordsFetched++;

        const title = extractTitle(body) ?? url.split("/").pop() ?? url;
        const text = stripHtmlToText(body);
        if (text.length < 200) {
          ctx.logError(new Error(`too short (${text.length} chars)`), { url });
          continue;
        }

        await ctx.saveRaw(`${slug(url)}.html`, body);

        const result = await ingestDocument({
          sourceUrl: url,
          sourceSystem: "ballotpedia",
          docType: "html",
          title,
          textContent: `${title}\n\n${text}`,
          metadata: { scraper: "ballotpedia" },
        });

        if (!result.skipped) ctx.stats.recordsUpserted++;
      } catch (err) {
        ctx.logError(err, { url });
      }
    }
  },
};

function extractTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return undefined;
  return decodeEntities(m[1].replace(/ - Ballotpedia$/, "").trim());
}

/**
 * Minimal HTML-to-text extractor. We don't need perfect semantic extraction
 * for the brain to reason over the content — just reasonably clean text.
 */
function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .split("\n")
    .map((line) => decodeEntities(line).trim())
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function slug(url: string): string {
  return url.replace(/https?:\/\//, "").replace(/[^a-z0-9_-]+/gi, "-").slice(0, 80);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runScraper(ballotpedia, {}).then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  });
}
