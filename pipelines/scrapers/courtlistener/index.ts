/**
 * CourtListener scraper.
 *
 * Pulls opinions and dockets for a named person from CourtListener's free v4
 * API, scoped to Louisiana federal courts (Eastern, Middle, Western District)
 * plus the 5th Circuit (covers LA, MS, TX appeals). Optional API key raises
 * the rate limit from 5,000 to 50,000 req/day.
 *
 * Docs: https://www.courtlistener.com/help/api/rest/
 *
 * Run:
 *   npm run scraper:courtlistener -- --personName "Jeff Landry"
 *   npm run scraper:courtlistener -- --personName "Latoya Cantrell" --courtFilter laed
 */

import { prisma } from "@/lib/db";
import { retry, runScraper, type ScraperDefinition } from "@/lib/scraper/base";
import { upsertPerson } from "@/lib/ftm";
import { ingestDocument } from "@/lib/ingest/document-pipeline";

const CL_BASE = "https://www.courtlistener.com/api/rest/v4";

/** LA federal courts. ca5 covers LA/MS/TX appeals. */
const DEFAULT_COURT_IDS = ["lamd", "laed", "lawd", "ca5"];

/** CourtListener court IDs → OCD-ID for CourtCase.courtOcdId. */
const COURT_OCD_IDS: Record<string, string> = {
  lamd: "ocd-court/country:us/subdivision:la/federal_district:middle",
  laed: "ocd-court/country:us/subdivision:la/federal_district:eastern",
  lawd: "ocd-court/country:us/subdivision:la/federal_district:western",
  ca5: "ocd-court/country:us/federal_circuit:5th",
};

interface CourtListenerArgs {
  /** Person name to search for. If omitted, scraper does nothing meaningful. */
  personName?: string;
  /** Comma-separated court IDs, e.g. "lamd,laed". Default: LA federal + ca5. */
  courtFilter?: string;
}

interface OpinionResult {
  id: number;
  absolute_url?: string;
  cluster_id?: number;
  author_id?: number | null;
  type?: string;
  sha1?: string;
  plain_text?: string;
  html_lawbox?: string;
  html?: string;
  html_with_citations?: string;
  date_created?: string;
  date_modified?: string;
  download_url?: string;
}

interface SearchResult {
  id?: number | string;
  cluster_id?: number;
  docket_id?: number;
  caseName?: string;
  caseNameFull?: string;
  absolute_url?: string;
  court_id?: string;
  court?: string;
  dateFiled?: string;
  docketNumber?: string;
  type?: string;
  snippet?: string;
  opinion_text?: string;
  party?: string[];
  author_id?: number | null;
}

interface SearchResponse {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: SearchResult[];
  detail?: string;
}

function splitName(full: string): { givenName: string; familyName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { givenName: parts[0], familyName: parts[0] };
  return {
    givenName: parts[0],
    familyName: parts.slice(1).join(" "),
  };
}

export const courtlistener: ScraperDefinition<CourtListenerArgs> = {
  name: "scraper-courtlistener",
  sourceSystem: "courtlistener",
  // 5 req/sec without key, 50 with. Base sets the per-scraper cap.
  rateLimitPerSec: process.env.COURTLISTENER_API_KEY ? 50 : 5,
  async run(args, ctx) {
    if (!args.personName) {
      ctx.logError("personName arg is required.");
      return;
    }

    const courts =
      args.courtFilter?.split(",").map((s) => s.trim()).filter(Boolean) ??
      DEFAULT_COURT_IDS;

    const headers: Record<string, string> = {
      "User-Agent": "DarkHorse/1.0 (political research)",
    };
    if (process.env.COURTLISTENER_API_KEY) {
      headers.Authorization = `Token ${process.env.COURTLISTENER_API_KEY}`;
    }

    const person = await upsertPerson({
      ...splitName(args.personName),
      aliases: [args.personName],
    });

    // Two search passes: opinions (type=o) and RECAP dockets (type=r).
    await searchAndIngest({
      type: "o",
      personName: args.personName,
      personId: person.id,
      courts,
      headers,
      ctx,
    });
    await searchAndIngest({
      type: "r",
      personName: args.personName,
      personId: person.id,
      courts,
      headers,
      ctx,
    });
  },
};

async function searchAndIngest(params: {
  type: "o" | "r";
  personName: string;
  personId: string;
  courts: string[];
  headers: Record<string, string>;
  ctx: Parameters<typeof courtlistener.run>[1];
}): Promise<void> {
  const { type, personName, personId, courts, headers, ctx } = params;

  // Per CourtListener search docs, the `court` filter accepts a pipe-delimited
  // list of court IDs. Combined with the quoted person name as free text.
  const query = `"${personName}"`;
  const courtParam = courts.join(" OR ");

  let cursor: string | null = null;
  let pageIndex = 0;
  const MAX_PAGES = 10;

  do {
    await ctx.rateLimit.wait();

    const url: URL = cursor
      ? new URL(cursor)
      : (() => {
          const u = new URL(`${CL_BASE}/search/`);
          u.searchParams.set("type", type);
          u.searchParams.set("q", query);
          u.searchParams.set("court", courtParam);
          u.searchParams.set("order_by", "score desc");
          return u;
        })();

    let data: SearchResponse;
    try {
      data = await retry(async () => {
        const response = await fetch(url.toString(), {
          headers,
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) {
          throw new Error(
            `CourtListener ${response.status}: ${await response.text().catch(() => "")}`
          );
        }
        return (await response.json()) as SearchResponse;
      });
    } catch (err) {
      ctx.logError(err, { type, page: pageIndex });
      break;
    }

    if (data.detail) {
      ctx.logError(new Error(data.detail), { type, page: pageIndex });
      break;
    }

    const results = data.results ?? [];
    ctx.stats.recordsFetched += results.length;
    await ctx.saveRaw(`search-${type}-page-${pageIndex}.json`, data);

    for (const result of results) {
      try {
        if (type === "o") {
          await ingestOpinion({ result, personId, headers, ctx });
        } else {
          await ingestDocket({ result, personId, personName, headers, ctx });
        }
      } catch (err) {
        ctx.logError(err, { type, id: result.id });
      }
    }

    cursor = data.next ?? null;
    pageIndex++;
  } while (cursor && pageIndex < MAX_PAGES);
}

async function ingestOpinion(params: {
  result: SearchResult;
  personId: string;
  headers: Record<string, string>;
  ctx: Parameters<typeof courtlistener.run>[1];
}): Promise<void> {
  const { result, personId, headers, ctx } = params;

  const clusterId = result.cluster_id ?? (typeof result.id === "number" ? result.id : undefined);
  if (!clusterId) return;

  // Fetch the full opinion text via /opinion/ endpoint — search only returns a snippet.
  await ctx.rateLimit.wait();
  const opinionUrl = `${CL_BASE}/opinions/?cluster=${clusterId}&page_size=10`;
  let opinionData: { results?: OpinionResult[] };
  try {
    opinionData = await retry(async () => {
      const response = await fetch(opinionUrl, {
        headers,
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        throw new Error(
          `CourtListener opinions ${response.status}: ${await response.text().catch(() => "")}`
        );
      }
      return (await response.json()) as { results?: OpinionResult[] };
    });
  } catch (err) {
    ctx.logError(err, { clusterId });
    return;
  }

  const opinions = opinionData.results ?? [];
  for (const op of opinions) {
    const text = op.plain_text?.trim() ?? stripHtml(op.html_with_citations ?? op.html_lawbox ?? op.html ?? "");
    if (!text || text.length < 100) continue;

    const absoluteUrl = op.absolute_url
      ? `https://www.courtlistener.com${op.absolute_url}`
      : result.absolute_url
        ? `https://www.courtlistener.com${result.absolute_url}`
        : `https://www.courtlistener.com/opinion/${clusterId}/`;

    const docResult = await ingestDocument({
      sourceUrl: absoluteUrl,
      sourceSystem: "courtlistener",
      docType: "html",
      title: result.caseName ?? result.caseNameFull ?? `Opinion ${clusterId}`,
      publishedAt: result.dateFiled ? new Date(result.dateFiled) : undefined,
      textContent: text,
      metadata: {
        opinionId: op.id,
        clusterId,
        courtId: result.court_id,
        court: result.court,
        docketNumber: result.docketNumber,
        type: op.type ?? result.type,
        authorId: op.author_id,
      },
    });

    if (!docResult.skipped) ctx.stats.recordsUpserted++;

    // Upsert CourtCase + party link.
    if (result.docketNumber && result.court_id) {
      await upsertCourtCaseAndParty({
        docketNumber: result.docketNumber,
        courtId: result.court_id,
        caseName: result.caseName ?? result.caseNameFull,
        dateFiled: result.dateFiled,
        personId,
        documentId: docResult.documentId,
      });
    }
  }
}

async function ingestDocket(params: {
  result: SearchResult;
  personId: string;
  personName: string;
  headers: Record<string, string>;
  ctx: Parameters<typeof courtlistener.run>[1];
}): Promise<void> {
  const { result, personId, ctx } = params;

  if (!result.docketNumber || !result.court_id) return;

  const absoluteUrl = result.absolute_url
    ? `https://www.courtlistener.com${result.absolute_url}`
    : `https://www.courtlistener.com/docket/${result.id}/`;

  const snippet = result.snippet ?? result.opinion_text ?? "";
  const textContent = [result.caseName ?? result.caseNameFull, snippet]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  let documentId: string | undefined;
  if (textContent && textContent.length > 50) {
    const docResult = await ingestDocument({
      sourceUrl: absoluteUrl,
      sourceSystem: "courtlistener",
      docType: "html",
      title: result.caseName ?? result.caseNameFull ?? `Docket ${result.docketNumber}`,
      publishedAt: result.dateFiled ? new Date(result.dateFiled) : undefined,
      textContent,
      metadata: {
        docketId: result.id,
        docketNumber: result.docketNumber,
        courtId: result.court_id,
        court: result.court,
        parties: result.party,
      },
    });

    if (!docResult.skipped) ctx.stats.recordsUpserted++;
    documentId = docResult.documentId;
  }

  await upsertCourtCaseAndParty({
    docketNumber: result.docketNumber,
    courtId: result.court_id,
    caseName: result.caseName ?? result.caseNameFull,
    dateFiled: result.dateFiled,
    personId,
    documentId,
  });
}

async function upsertCourtCaseAndParty(params: {
  docketNumber: string;
  courtId: string;
  caseName?: string;
  dateFiled?: string;
  personId: string;
  documentId?: string;
}): Promise<void> {
  const courtOcdId = COURT_OCD_IDS[params.courtId] ?? `ocd-court/${params.courtId}`;

  const existing = await prisma.courtCase.findUnique({
    where: {
      docketNumber_courtOcdId: {
        docketNumber: params.docketNumber,
        courtOcdId,
      },
    },
    select: { id: true },
  });

  const caseRow = existing
    ? await prisma.courtCase.update({
        where: { id: existing.id },
        data: {
          caption: params.caseName ?? undefined,
          filedAt: params.dateFiled ? new Date(params.dateFiled) : undefined,
          sourceDocuments: params.documentId
            ? { connect: { id: params.documentId } }
            : undefined,
        },
        select: { id: true },
      })
    : await prisma.courtCase.create({
        data: {
          docketNumber: params.docketNumber,
          courtOcdId,
          caseType: inferCaseType(params.courtId),
          caption: params.caseName,
          filedAt: params.dateFiled ? new Date(params.dateFiled) : undefined,
          sourceDocuments: params.documentId
            ? { connect: { id: params.documentId } }
            : undefined,
        },
        select: { id: true },
      });

  // Ensure a party row exists for this person on this case.
  const existingParty = await prisma.courtCaseParty.findFirst({
    where: { caseId: caseRow.id, personId: params.personId },
    select: { id: true },
  });
  if (!existingParty) {
    await prisma.courtCaseParty.create({
      data: {
        caseId: caseRow.id,
        personId: params.personId,
        // We don't know the specific role from a name match alone — mark
        // "named_party" and let a later pass refine it from docket parties.
        role: "named_party",
      },
    });
  }
}

function inferCaseType(courtId: string): string {
  if (courtId === "ca5") return "appellate";
  return "federal";
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
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

function parseArgs(): CourtListenerArgs {
  const parsed: Record<string, string> = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i]?.replace(/^--/, "");
    const value = process.argv[i + 1];
    if (key && value) parsed[key] = value;
  }
  return {
    personName: parsed.personName,
    courtFilter: parsed.courtFilter,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runScraper(courtlistener, parseArgs()).then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  });
}
