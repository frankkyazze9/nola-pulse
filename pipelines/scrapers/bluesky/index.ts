/**
 * Bluesky scraper — STUB.
 *
 * Pulls public posts from Louisiana political figures on Bluesky via the AT
 * Protocol. Free, no API key, no rate cliff. Bluesky is the single best-kept
 * free secret in 2026 political OSINT — the LA political class is actively
 * migrating there.
 *
 * STATUS: not implemented. Needs @atproto/api integration. Full implementation:
 *   - Maintain a list of tracked handles in pipelines/scrapers/bluesky/handles.json
 *     (or seeded in the DB via a new TrackedAccount model later)
 *   - For each handle, fetch the post feed via the AT Protocol `getAuthorFeed`
 *     endpoint — no auth required for public posts
 *   - Upsert each post as a Document with docType:"social_post", linked by
 *     fingerprint to the handle's Person
 *   - Track replies + quote posts in metadata
 */

import { runScraper, type ScraperDefinition } from "@/lib/scraper/base";

export const bluesky: ScraperDefinition = {
  name: "scraper-bluesky",
  sourceSystem: "bluesky",
  rateLimitPerSec: 5,
  async run(_args, ctx) {
    ctx.logError("scraper-bluesky is not yet implemented. Needs @atproto/api + tracked-handles list.");
  },
};

if (import.meta.url === `file://${process.argv[1]}`) {
  runScraper(bluesky, {}).then(() => process.exit(1));
}
