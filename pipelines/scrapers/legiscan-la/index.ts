/**
 * LegiScan Louisiana scraper — STUB.
 *
 * LegiScan's free API (30K queries/month) covers LA Legislature bills, votes,
 * committee assignments, and member profiles. API docs at
 * https://legiscan.com/legiscan.
 *
 * STATUS: not implemented. Full implementation should:
 *   - Fetch the current LA session via `getSessionList`
 *   - For each active session, walk `getMasterList` → `getBill` for every bill
 *   - Upsert bill sponsors as Person / Membership rows
 *   - Upsert roll call votes as structured Claims (`voted_for` / `voted_against`)
 *   - Cache the `masterlist_change_hash` between runs so we only refetch bills
 *     whose hash changed
 *
 * Required env: LEGISCAN_API_KEY
 */

import { runScraper, type ScraperDefinition } from "@/lib/scraper/base";

export const legiscanLa: ScraperDefinition = {
  name: "scraper-legiscan-la",
  sourceSystem: "legiscan",
  rateLimitPerSec: 2,
  async run(_args, ctx) {
    ctx.logError("scraper-legiscan-la is not yet implemented. Needs LEGISCAN_API_KEY and bill-walk logic.");
  },
};

if (import.meta.url === `file://${process.argv[1]}`) {
  runScraper(legiscanLa, {}).then(() => process.exit(1));
}
