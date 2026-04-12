/**
 * New Orleans City Council Granicus scraper — STUB.
 *
 * Pulls agenda PDFs and meeting videos from the NOLA Council Granicus archive
 * at https://cityofno.granicus.com/ViewPublisher.php?view_id=7. Videos run
 * through a separate Whisper transcription Cloud Run Job
 * (`pipelines/transcribe/whisper_job.py`) before flowing into the document
 * pipeline as `hearing_transcript` documents.
 *
 * STATUS: not implemented. The Granicus archive is an HTML-scraped list of
 * meetings, each with one or more media artifacts. Full implementation needs:
 *   - Playwright/Crawlee-based list scrape + per-meeting detail scrape
 *   - Video URL extraction (MP4 or HLS) + enqueue to Whisper job
 *   - Agenda PDF download + ingestDocument() with docType:"pdf"
 *   - Rate limit: 1 req/sec, respect Granicus usage norms
 */

import { runScraper, type ScraperDefinition } from "@/lib/scraper/base";

export const nolaCouncilGranicus: ScraperDefinition = {
  name: "scraper-nola-council-granicus",
  sourceSystem: "nola_council",
  rateLimitPerSec: 1,
  async run(_args, ctx) {
    ctx.logError(
      "scraper-nola-council-granicus is not yet implemented. Needs Playwright + Whisper transcription wiring."
    );
  },
};

if (import.meta.url === `file://${process.argv[1]}`) {
  runScraper(nolaCouncilGranicus, {}).then(() => process.exit(1));
}
