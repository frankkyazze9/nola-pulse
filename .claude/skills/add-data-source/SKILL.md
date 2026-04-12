---
name: add-data-source
description: Checklist for wiring up a new Dark Horse scraper end-to-end — from picking a source through Cloud Scheduler deployment, entity normalization, and exposing the data to the brain.
---

# Adding a new data source to Dark Horse

Dark Horse's data freshness is only as good as its scrapers. Use this checklist whenever you add a new source (a new LA parish court portal, a new NOLA news outlet, a new social platform, etc.).

## 0 — Before you start

- **Check `reference_political_osint_sources.md` memory** for the source's current status. Some APIs have died (OpenSecrets, ProPublica Congress, CrowdTangle); don't design around corpses.
- **Respect robots.txt** and terms of service. Dark Horse is a political research tool — we have broad public-interest cover, but we still play fair.
- **Check Wayback first** for any historical snapshots before scraping.

## 1 — Source recon

Document these before you write code:

| Question | Example answer |
|---|---|
| Direct URL | `https://api.open.fec.gov/v1/` |
| Access method | REST API / HTML scrape / CSV download / RSS |
| Auth | API key (where stored?) / token / anonymous / session cookie |
| Rate limit | e.g. 1K req/hr, 7.2K/hr with email |
| Data format | JSON / CSV / HTML / PDF |
| Freshness | live / hourly / daily / weekly / monthly |
| License / ToS | free / attribution required / non-commercial |
| Louisiana coverage | national with LA data / LA-specific / NOLA-only |
| Known gotchas | e.g. "pagination cursor resets after 100 pages" |

Write this into `docs/data-sources.md` as a block for the source.

## 2 — Implement the scraper

Create `pipelines/scrapers/<name>/index.ts` extending the shared base:

```typescript
import { createScraper } from "@/lib/scraper/base";
import { upsertPerson, upsertOrganization, upsertDonation } from "@/lib/ftm";

export const scraper = createScraper({
  name: "<name>",
  sourceSystem: "<unique-identifier>",  // used in Document.sourceSystem
  async run(args, ctx) {
    // ctx provides: logRun, rateLimit, retry, saveRaw, saveWayback, spendLog
    // args are CLI flags passed via npm run scraper:<name> -- --arg value

    const data = await ctx.retry(() =>
      ctx.rateLimit(() => fetch("<url>"))
    );

    await ctx.saveRaw("raw.json", data);
    await ctx.saveWayback("<url>");  // triggers SavePageNow

    for (const item of data.results) {
      const person = await upsertPerson({
        fecCandidateId: item.id,
        givenName: item.first_name,
        familyName: item.last_name,
        // ...
      });
      // upsert downstream relations
    }
  },
});
```

The base handles:
- `ctx.logRun` — start/finish `ScraperRun` rows, record counts, error tally.
- `ctx.rateLimit` — enforces per-scraper req/sec.
- `ctx.retry` — exponential backoff on transient failures.
- `ctx.saveRaw` — writes to `gs://dark-horse-docs/raw/<name>/<date>/`.
- `ctx.saveWayback` — triggers Wayback SavePageNow for each visited URL.
- `ctx.spendLog` — records any API cost (Document AI, etc.) in `ApiSpendLog`.

## 3 — Normalize to FollowTheMoney entities

Use `lib/ftm.ts` helpers to upsert:
- `upsertPerson({ fecCandidateId, wikidataQid, laEthicsId, ... })`
- `upsertOrganization({ fecCommitteeId, einNumber, ... })`
- `upsertDonation({ donorPersonId, recipientId, amount, date, sourceDocumentId })`
- `upsertCourtCase(...)`, `upsertOwnership(...)`

Known IDs are the ground truth for entity resolution — always populate them when the source provides them.

## 4 — Route documents through the ingest pipeline

Any PDF, scanned image, news article, hearing transcript, or long text should flow through the document pipeline:

```typescript
import { ingestDocument } from "@/lib/ingest/document-pipeline";

await ingestDocument({
  sourceUrl,
  sourceSystem: "<name>",
  title,
  publishedAt,
  buffer: pdfBuffer,    // if scraped directly
  // OR
  textContent: article, // if plain text
});
```

This triggers: GCS raw write → OCR if needed → chunking → contextual prefix → self-hosted embedding → pgvector + FTS → claim extraction.

## 5 — Local test

```bash
npm run scraper:<name> -- --arg value
```

Verify:
- `ScraperRun` row created with `success` status.
- New/updated `Person`, `Organization`, `Donation`, `Document` rows.
- Re-running produces zero duplicates (idempotent).
- `ApiSpendLog` shows any API costs.

## 6 — Deploy as a Cloud Run Job

Add to `cloudbuild-scrapers.yaml`:

```yaml
- name: 'gcr.io/cloud-builders/gcloud'
  args: ['run', 'jobs', 'deploy', 'scraper-<name>',
         '--image', '...',
         '--region', 'us-south1',
         '--set-secrets', 'DATABASE_URL=DATABASE_URL:latest,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest',
         '--command', 'node', '--args', 'dist/pipelines/scrapers/<name>/index.js']
```

Add a Cloud Scheduler job pointing at it (nightly cron):

```bash
gcloud scheduler jobs create http scraper-<name>-nightly \
  --schedule="0 3 * * *" \
  --http-method=POST \
  --uri="https://<region>-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/<project>/jobs/scraper-<name>:run" \
  --oauth-service-account-email=<sa>@<project>.iam.gserviceaccount.com \
  --location=us-south1
```

## 7 — If the scraper exposes a new query type, add a brain tool

If the new source enables queries Christine can't already ask (e.g. "who was at this hearing" becomes answerable only after adding `scraper-hearings-attendance`), add a matching tool to `lib/brain/tools.ts`:

```typescript
get_hearing_attendees: {
  description: "Who attended a specific public hearing",
  params: z.object({ hearingId: z.string() }),
  handler: lib/brain/handlers.ts — getHearingAttendees,
},
```

Otherwise the data sits unused.

## 8 — Document

Update `docs/data-sources.md` with the completed row. Future-you will thank you.
