/**
 * LA Ethics bootstrap importer — one-shot bulk import of the Accountability
 * Project's cleaned Louisiana campaign finance CSVs (1997–2021 contributions,
 * 2000–2022 expenditures). ~5M donation rows get mapped onto Person /
 * Organization / Donation entities.
 *
 * The LA Ethics Board has no API, so this is how we backfill the pre-2022
 * history. The live scraper-la-ethics-live (still to be implemented) picks
 * up 2022-present.
 *
 * Data source:
 *   https://publicaccountability.org/datasets/406/new-louisiana-ca/
 *
 * Expected CSV columns (subject to change — check at download time):
 *   date, donor_name, donor_address, donor_employer, donor_occupation,
 *   recipient_name, amount, filing_id
 */

import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { runScraper, type ScraperDefinition } from "@/lib/scraper/base";
import { upsertOrganization, upsertPerson, upsertDonation } from "@/lib/ftm";

interface BootstrapArgs {
  /** Path to the downloaded contributions CSV. */
  contributionsCsv?: string;
}

export const laEthicsBootstrap: ScraperDefinition<BootstrapArgs> = {
  name: "scraper-la-ethics-bootstrap",
  sourceSystem: "la_ethics_bootstrap",
  rateLimitPerSec: 10_000, // local file, no network rate limit
  async run(args, ctx) {
    const csvPath = args.contributionsCsv;
    if (!csvPath) {
      ctx.logError(
        "Missing --contributionsCsv flag. Download the CSV from https://publicaccountability.org/datasets/406/new-louisiana-ca/ and pass the local path."
      );
      return;
    }

    const stream = createReadStream(csvPath, { encoding: "utf8" });
    const reader = createInterface({ input: stream });

    let header: string[] | null = null;
    let rowCount = 0;

    for await (const line of reader) {
      if (!header) {
        header = parseCsvRow(line);
        continue;
      }
      const row = parseCsvRow(line);
      if (row.length !== header.length) continue;
      const record = Object.fromEntries(header.map((k, i) => [k.toLowerCase(), row[i]])) as Record<
        string,
        string
      >;

      try {
        ctx.stats.recordsFetched++;
        rowCount++;

        const donorName = (record.donor_name ?? record.contributor_name ?? "").trim();
        const recipientName = (
          record.recipient_name ??
          record.committee_name ??
          record.filer_name ??
          ""
        ).trim();
        const amount = Number(record.amount ?? record.contribution_amount ?? 0);
        const date = new Date(record.date ?? record.contribution_date ?? "");

        if (!donorName || !recipientName || !amount || Number.isNaN(date.getTime())) continue;

        const [givenName, ...rest] = donorName.split(/[\s,]+/).filter(Boolean);
        const familyName = rest.join(" ").trim() || givenName;

        const donor = await upsertPerson({
          givenName: givenName || donorName,
          familyName: familyName || donorName,
          aliases: [donorName],
        });

        const recipient = await upsertOrganization({
          name: recipientName,
          orgType: "committee",
        });

        await upsertDonation({
          donorPersonId: donor.id,
          recipientId: recipient.id,
          amount,
          date,
          sourceFilingId: record.filing_id,
          employer: record.donor_employer,
          occupation: record.donor_occupation,
          address: record.donor_address,
        });
        ctx.stats.recordsUpserted++;

        if (rowCount % 10_000 === 0) {
          console.log(
            `[la-ethics-bootstrap] processed ${rowCount} rows, upserted ${ctx.stats.recordsUpserted}`
          );
        }
      } catch (err) {
        ctx.logError(err, { rowCount });
      }
    }
  },
};

/** Minimal CSV row parser (handles quoted fields with commas). */
function parseCsvRow(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.map((s) => s.trim());
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args: BootstrapArgs = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i]?.replace(/^--/, "");
    const value = process.argv[i + 1];
    if (key === "contributionsCsv" && value) args.contributionsCsv = value;
  }
  runScraper(laEthicsBootstrap, args).then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  });
}
