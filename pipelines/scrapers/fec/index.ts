/**
 * FEC (Federal Election Commission) scraper.
 *
 * Pulls Louisiana federal candidates, their committees, and itemized receipts
 * from api.open.fec.gov. Free, rate-limited to 1000 req/hr by default
 * (request 7200 req/hr by emailing APIinfo@fec.gov).
 *
 * Required env: FEC_API_KEY
 *
 * Run:
 *   npm run scraper:fec -- --state LA [--cycle 2024]
 *   npm run scraper:fec -- --candidateName "LaToya Cantrell"
 */

import { retry, runScraper, type ScraperContext, type ScraperDefinition } from "@/lib/scraper/base";
import { upsertOrganization, upsertPerson, upsertDonation } from "@/lib/ftm";

const FEC_BASE = "https://api.open.fec.gov/v1";
const API_KEY = process.env.FEC_API_KEY ?? "DEMO_KEY";

interface FecArgs {
  state?: string; // e.g. "LA"
  cycle?: number; // e.g. 2024
  candidateName?: string;
}

interface FecCandidate {
  candidate_id: string;
  name: string;
  party: string;
  party_full: string;
  office_full: string;
  state: string;
  district: string;
  cycles: number[];
  principal_committees?: Array<{ committee_id: string; name: string }>;
}

interface FecReceipt {
  contributor_id?: string;
  contributor_name?: string;
  contributor_employer?: string;
  contributor_occupation?: string;
  contributor_street_1?: string;
  contributor_city?: string;
  contributor_state?: string;
  contributor_zip?: string;
  committee_id: string;
  contribution_receipt_amount: number;
  contribution_receipt_date: string; // ISO
  sub_id: string;
}

async function fecFetch(path: string, params: Record<string, string | number>, ctx: ScraperContext): Promise<unknown> {
  await ctx.rateLimit.wait();
  return retry(async () => {
    const url = new URL(`${FEC_BASE}${path}`);
    url.searchParams.set("api_key", API_KEY);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`FEC ${response.status}: ${path} — ${await response.text().catch(() => "")}`);
    }
    return response.json();
  });
}

export const fec: ScraperDefinition<FecArgs> = {
  name: "scraper-fec",
  sourceSystem: "fec",
  rateLimitPerSec: 1,
  async run(args, ctx) {
    const state = args.state ?? "LA";
    const cycle = args.cycle ?? new Date().getFullYear();

    const candidatesPage = (await fecFetch(
      "/candidates/search",
      {
        state,
        cycle,
        per_page: 100,
        ...(args.candidateName ? { q: args.candidateName } : {}),
      },
      ctx
    )) as { results: FecCandidate[] };

    ctx.stats.recordsFetched += candidatesPage.results.length;
    await ctx.saveRaw("candidates.json", candidatesPage);

    for (const cand of candidatesPage.results) {
      try {
        const [givenName, ...rest] = cand.name.split(/[\s,]+/);
        const familyName = rest.join(" ").trim() || givenName;

        await upsertPerson({
          fecCandidateId: cand.candidate_id,
          givenName: givenName || cand.name,
          familyName,
          aliases: [cand.name],
          party: cand.party_full,
        });
        ctx.stats.recordsUpserted++;

        for (const committee of cand.principal_committees ?? []) {
          const org = await upsertOrganization({
            fecCommitteeId: committee.committee_id,
            name: committee.name,
            orgType: "committee",
          });
          ctx.stats.recordsUpserted++;

          const receiptsPage = (await fecFetch(
            `/schedules/schedule_a`,
            {
              committee_id: committee.committee_id,
              two_year_transaction_period: cycle,
              per_page: 100,
            },
            ctx
          )) as { results: FecReceipt[] };

          ctx.stats.recordsFetched += receiptsPage.results.length;
          await ctx.saveRaw(`receipts-${committee.committee_id}.json`, receiptsPage);

          for (const receipt of receiptsPage.results) {
            try {
              if (!receipt.contributor_name || !receipt.contribution_receipt_amount) continue;
              await upsertDonation({
                donorOrgId: undefined,
                recipientId: org.id,
                amount: receipt.contribution_receipt_amount,
                date: new Date(receipt.contribution_receipt_date),
                sourceFilingId: receipt.sub_id,
                employer: receipt.contributor_employer,
                occupation: receipt.contributor_occupation,
                address: [
                  receipt.contributor_street_1,
                  receipt.contributor_city,
                  receipt.contributor_state,
                  receipt.contributor_zip,
                ]
                  .filter(Boolean)
                  .join(", "),
              });
              ctx.stats.recordsUpserted++;
            } catch (err) {
              ctx.logError(err, { receipt_sub_id: receipt.sub_id });
            }
          }
        }
      } catch (err) {
        ctx.logError(err, { candidate_id: cand.candidate_id });
      }
    }
  },
};

// Entry point for direct `node ...` / `tsx` execution.
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs();
  runScraper(fec, args).then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  });
}

function parseArgs(): FecArgs {
  const args: Record<string, string> = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i]?.replace(/^--/, "");
    const value = process.argv[i + 1];
    if (key && value) args[key] = value;
  }
  return {
    state: args.state,
    cycle: args.cycle ? Number(args.cycle) : undefined,
    candidateName: args.candidateName,
  };
}
