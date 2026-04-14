# Dark Horse — Triage Log

Active bugs, deficiencies, and tech debt. Update status inline as items are worked.

Status legend: `[ ]` open, `[~]` in progress, `[x]` resolved, `[-]` wontfix/deferred.

Last updated: 2026-04-14

---

## P0 — Critical

### -1. [x] `DocumentChunk` missing `embedding vector(384)` + `tsv tsvector` columns

**Resolved:** applied the missing DDL directly to Cloud SQL:
`ALTER TABLE "DocumentChunk" ADD COLUMN IF NOT EXISTS embedding vector(384)` +
`tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED` + HNSW + GIN indexes.

**Problem:** The initial migration's raw SQL for pgvector + FTS columns never applied. Combined with bug #0, every scraper run silently produced orphan Documents because `UPDATE ... SET embedding = ...::vector` failed with `column "embedding" does not exist`.

**Lesson:** Hand-written migrations that mix Prisma's generated DDL with raw SQL need extra verification — either a post-migration check or a dedicated migration test.

### -0.5. [x] Ballotpedia CloudFront 403s bot user agents

**Resolved:** updated `pipelines/scrapers/ballotpedia/index.ts` to send a Chrome User-Agent + browser Accept headers. CloudFront returns 200 with these.

**Problem:** First run returned 3× "too short (0 chars)" errors because CloudFront served 403 HTML to our `DarkHorse/1.0` UA, and the HTML-to-text stripper reduced those to empty content.

### 0. [x] cloudbuild.yaml was missing EMBEDDING_SERVICE_URL / DOCUMENT_AI_PROCESSOR_ID

**Resolved:** both added to `--set-env-vars` in cloudbuild.yaml.

**Problem:** After the initial infra setup I ran `gcloud run services update --update-env-vars=EMBEDDING_SERVICE_URL=...` manually to wire the main app to the embed service. But cloudbuild.yaml only set `GCP_PROJECT_ID` and `GCS_BUCKET`. Every subsequent deploy (conversation memory, password auth, cases, projects, telegram bot) replaced the whole env var set, wiping EMBEDDING_SERVICE_URL and DOCUMENT_AI_PROCESSOR_ID. The ingest pipeline threw "EMBEDDING_SERVICE_URL not set" on every article silently (per-article catch in scrapers) — producing 70+ orphan Documents and zero chunks.

**Lesson:** Anything set via `gcloud run services update --set-env-vars` is authoritative for that revision only. Next deploy wipes it unless `cloudbuild.yaml` also sets it.


### 1. [x] Document pipeline creates orphan Documents when chunking/embedding fails

**Resolved:** commit pending — deferred `Document.create` until after chunks + embeddings are ready, wrapped Document + chunk inserts in a `prisma.$transaction`. Claim extraction now runs outside the transaction with its own error handling (claim failures don't rollback the document).

**Labels:** `bug`, `scraper`

**Problem:** When `ingestDocument()` in `lib/ingest/document-pipeline.ts` fails during chunking, contextual-prefix generation, embedding, or chunk persistence, the `Document` row has already been created (step 5). Per-article try/catch in scrapers logs the error, but the orphan Document stays in the DB with no DocumentChunks.

**Impact:**
- Orphan documents silently accumulate (47 of them in the first production RSS run)
- Hybrid search returns matches pointing at documents with no chunks
- Content-hash dedupe blocks retrying the same URL
- Data integrity: a Document row doesn't indicate ingest success

**Proposed fix:** Defer `Document.create` until after chunks + embeddings succeed. Pseudo-code:
```ts
// 1-4 unchanged (dedupe, Wayback, GCS, text extract)
const chunks = chunkText(textContent, ...);
const prefixes = await generateContextualPrefixes(...);
const embeddings = await embedBatch(...);
// NOW create Document + chunks in a transaction
await prisma.$transaction(async (tx) => {
  const document = await tx.document.create({...});
  for (const {chunk, prefix, embedding} of ...) {
    await persistChunk(tx, {...});
  }
});
```

**Cleanup:** `DELETE FROM "Document" WHERE id NOT IN (SELECT DISTINCT "documentId" FROM "DocumentChunk")`

---

### 2. Embed service is publicly reachable (quick fix, not the real solution)

**Labels:** `infra`, `auth`

**Problem:** The `dark-horse-embed` Cloud Run service is deployed with `--allow-unauthenticated` so the main app can call it. Main app uses plain `fetch()` with no identity token. Workable but the service is reachable from anywhere on the internet.

**Risk:** Low — the service only exposes `POST /embed` (text → vector) and `GET /health`. No data access, no compute exhaustion risk beyond cost.

**Proper fix:** Use `google-auth-library` in `lib/ingest/embed.ts` to fetch a Google-signed ID token for the embed service URL, send as `Authorization: Bearer <token>`. Remove the `allUsers` IAM binding on `dark-horse-embed`.

```ts
import { GoogleAuth } from "google-auth-library";
const auth = new GoogleAuth();
const client = await auth.getIdTokenClient(EMBED_URL);
const headers = await client.getRequestHeaders();
await fetch(`${EMBED_URL}/embed`, { headers, ... });
```

---

### 3. [x] `--allow-unauthenticated` in cloudbuild.yaml doesn't actually apply `allUsers` binding

**Resolved:** added explicit `gcloud run services add-iam-policy-binding allUsers` step to cloudbuild.yaml so every deploy enforces public access. Also fixed EMBEDDING_SERVICE_URL + DOCUMENT_AI_PROCESSOR_ID env vars (which were getting wiped by deploys because they weren't in cloudbuild.yaml), and added `--timeout=3600 --memory=1Gi` while we're at it.

**Labels:** `bug`, `infra`

**Problem:** `cloudbuild.yaml` uses `--allow-unauthenticated` on `gcloud run deploy`, but Cloud Build's service account doesn't have permission to set IAM policy on the Cloud Run service. After first deploy, the IAM policy only contained the deployer, not `allUsers`. A phone browser hitting the URL got 403 until I manually ran:

```
gcloud run services add-iam-policy-binding dark-horse \
  --region=us-south1 --member=allUsers --role=roles/run.invoker
```

**Proposed fix:** Grant Cloud Build's service account `roles/run.admin` or set up a Cloud Deploy pipeline that handles IAM separately. Alternatively, run a `gcloud beta run services add-iam-policy-binding allUsers` step in cloudbuild.yaml.

---

## P1 — High priority

### 4. [x] Cloud Run request timeout must be set via cloudbuild.yaml, not defaults

**Resolved:** rolled into the cloudbuild.yaml fix (#3). `--timeout=3600 --memory=1Gi --cpu=1 --concurrency=40 --max-instances=10` now in the deploy step.

**Labels:** `infra`

**Problem:** Default Cloud Run timeout (300s) killed the RSS scraper mid-run. Fixed manually via `gcloud run services update dark-horse --timeout=3600`, but this isn't in `cloudbuild.yaml` — next fresh deploy resets to 300s.

**Fix:** Add `--timeout=3600 --memory=1Gi` to the `gcloud run deploy` args in `cloudbuild.yaml`.

---

### 5. Admin UI pages are placeholders

**Labels:** `ui`, `enhancement`

**Problem:** `/admin` renders four dashed-border placeholder cards. No spend dashboard, no scraper run history, no entity review queue, no document volume chart. You have to query Postgres directly to see what happened.

**Needed:**
- `/admin/spend` — MTD total vs $100 cap, donut by service, daily trend line
- `/admin/scrapers` — run history from `ScraperRun`, status, records fetched/upserted, expandable errors
- `/admin/documents` — count by `sourceSystem`, daily ingest chart
- `/admin/entities` — `EntityMatch` needs_review queue, approve/reject actions

---

### 6. No Cloud Scheduler crons set up

**Labels:** `infra`, `scraper`, `enhancement`

**Problem:** Scrapers must be triggered manually via `POST /api/jobs/scrape/[name]`. No nightly automation yet.

**Needed:** Create Cloud Scheduler jobs for:
- `nola-news-rss` — every 6 hours
- `gdelt` — daily
- `fec` — weekly
- `bluesky` — every 2 hours
- `fb-ad-library` — daily (once token provisioned)
- `courtlistener` — daily (per tracked person)

Each job hits `POST /api/jobs/scrape/<name>` with `x-cron-secret: $CRON_SECRET` header.

---

### 7. Stub scrapers still unimplemented

**Labels:** `scraper`, `enhancement`

**Problem:** Two scrapers are still stubs:
- `pipelines/scrapers/legiscan-la/index.ts` — needs `LEGISCAN_API_KEY` and bill-walk logic
- `pipelines/scrapers/nola-council-granicus/index.ts` — needs Playwright/Crawlee + Whisper transcription job

**Needed:** Implement both following the `nola-news-rss` pattern.

---

### 8. FB Ad Library & CourtListener API keys not configured

**Labels:** `infra`, `scraper`

**Problem:** Scrapers are deployed but missing env vars:
- `FACEBOOK_ACCESS_TOKEN` — required for FB Ad Library
- `COURTLISTENER_API_KEY` — optional but improves rate limits

**Needed:** Add both to Secret Manager, wire into `cloudbuild.yaml` `--set-secrets`.

---

### 9. Bluesky handles list is placeholder

**Labels:** `scraper`, `documentation`

**Problem:** `pipelines/scrapers/bluesky/handles.json` contains 10 made-up handles (e.g. `gov-landry.bsky.social`). Scraper will log 404s for each non-existent handle.

**Needed:** Replace with real verified handles of LA political figures, journalists, and orgs.

---

## P2 — Medium priority

### 10. Telegram bot has no progress feedback on long calls

**Labels:** `bot`, `enhancement`

**Problem:** Brain calls take 30-90s. Bot sends one `typing...` action at the start, then goes silent until the final answer. User has no idea if it's working.

**Fix:** Send `sendChatAction("typing")` every 4s until the brain returns. Or post a placeholder "🧠 Researching..." message and edit it via `editMessageText` as tool calls fire.

---

### 11. Web chat doesn't persist across sessions

**Labels:** `ui`, `enhancement`

**Problem:** Only the Telegram bot uses `Conversation`/`ConversationMessage`. The web `/research` chat keeps history in browser state only — refreshing the page loses context.

**Fix:** Generate a session-stable ID (cookie or password-bound UUID), pass to the stream endpoint, read/write `Conversation` rows with `channel="web"`.

---

### 12. No rate limiting on Telegram bot

**Labels:** `bot`, `infra`

**Problem:** An authorized user can spam messages. Each message triggers a Sonnet brain call ($0.05-0.15). A rapid-fire 100 messages would burn ~$10 and hit the spend cap.

**Fix:** Per-user concurrency lock (one active brain call per userId). Queue subsequent messages or reject with "still working on the last one". Track in a Redis/Postgres table with TTL.

---

### 13. No intent-based model routing

**Labels:** `brain`, `enhancement`

**Problem:** Every brain call uses Sonnet 4.6 regardless of complexity. Simple lookups ("what's Judge Smith's party?") cost the same as deep analysis. With prompt caching this is ~$0.02 for simple and ~$0.15 for complex, but a classifier could cut simple lookups to ~$0.01.

**Fix:** Two-stage routing:
1. Haiku classifies the query: `lookup | analysis | dossier`
2. Route `lookup` to Haiku-powered answer, others to Sonnet

Cost of classifier ~$0.002 per query. Break-even at ~15% of queries being lookups.

---

### 14. Brain output schema validation falls back to raw JSON silently

**Labels:** `brain`, `bug`

**Problem:** In `lib/brain/runner.ts::parseAndValidate`, if both attempts fail validation but the text is valid JSON, the brain returns the unvalidated JSON. Downstream UI/Telegram assumes `BrainAnswer` shape and may crash on missing fields.

**Fix:** Surface a real error — throw with the validation errors. Log to `ApiSpendLog` metadata for debugging.

---

### 15. search_documents RRF weights hardcoded 50/50

**Labels:** `brain`, `enhancement`

**Problem:** In `lib/brain/handlers.ts::searchDocuments`, hybrid score is `vector_score * 0.5 + fts_score * 0.5`. No way to tune for domain-specific retrieval.

**Fix:** Add optional `weights: { vector: number; fts: number }` arg. Or implement true reciprocal rank fusion instead of score averaging.

---

## P3 — Low priority / tech debt

### 16. Replace password auth with IAP + custom domain

**Labels:** `auth`, `infra`

**Problem:** Password auth in `proxy.ts` is a bridge. Proper production auth is IAP in front of Cloud Run behind a Load Balancer with a custom domain. Currently deferred — requires a domain and Load Balancer setup.

**Needed:**
- Acquire domain (e.g. `darkhorse.xyz`)
- Serverless NEG (already created: `dark-horse-neg`)
- Backend service + URL map (already created: `dark-horse-backend` + `dark-horse-url-map`)
- Managed SSL cert for domain
- HTTPS forwarding rule
- Enable IAP on backend service
- Remove password auth code

---

### 17. Bake BGE model into embed Docker image (tried, Cloud Build timed out)

**Labels:** `infra`, `scraper`

**Problem:** First-request cold start on `dark-horse-embed` downloads the model (~130MB + torch init ~3s). Adds latency to the first ingest after scale-to-zero.

**Previous attempt:** Adding `RUN python -c "SentenceTransformer('BAAI/bge-small-en-v1.5')"` to Dockerfile timed out at Cloud Build's 60-min limit on the e2-standard-1 machine, even after switching to CPU-only torch.

**Options:**
- Use a higher-CPU Cloud Build machine (`--machine-type=e2-highcpu-8`)
- Pre-download the model to GCS, copy into image at build time
- Accept cold-start latency; set `min-instances=1` ($2/mo extra)

---

### 18. No tests

**Labels:** `enhancement`

**Problem:** No unit or integration tests anywhere. Relying on typecheck + runtime.

**Needed:** Start with integration tests for the brain tool-use loop and the scraper framework. Vitest or Jest.

---

### 19. Stale Nola Pulse tables were hand-dropped from Cloud SQL

**Labels:** `infra`, `documentation`

**Problem:** 8 old tables (`articles`, `budget_line_items`, `council_meetings`, `displacement_events`, `flood_predictions`, `forum_posts`, `infographics`, `outage_records`) were left in the DB after the Nola Pulse → Dark Horse rebuild. First Prisma `migrate dev` failed with drift detection. Manually dropped them + removed the stale `20260407063119_init` migration record.

**Fix:** Document the one-time cleanup in `docs/deploy.md` or add a bootstrap migration that runs it.

---

### 20. `keychain failed to get/store` warning on git push

**Labels:** `documentation`

**Problem:** Every `git push` logs two lines:
```
failed to get: -25308
failed to store: -25308
```

Benign — macOS keychain issue with `osxkeychain` credential helper for the PAT. Push still succeeds.

**Fix:** Either switch to SSH remote or configure `git config --global credential.helper store` with a different backend. Low priority — cosmetic.

---

### 21. No dead-letter queue for failed document ingests

**Labels:** `scraper`, `enhancement`

**Problem:** When `ingestDocument` throws, the scraper logs via `ctx.logError` but there's no retry queue. The URL is marked attempted (via ScraperRun errorDetails) but not tracked in a retriable table.

**Fix:** Optional `FailedIngest` table: `{ url, sourceSystem, errorMessage, attemptCount, lastAttemptAt, givenUp }`. Nightly job re-tries.

---

### 22. Web UI doesn't show "thinking..." tool progress like /research does

**Labels:** `ui`

Wait — `/research` does stream tool progress. This is fine. (Skip.)

---

### 23. Dossier mode has no UI

**Labels:** `brain`, `ui`, `enhancement`

**Problem:** `generateDossier()` in `lib/brain/runner.ts` is implemented and reachable via `POST /api/brain` with `{ mode: "dossier", personId }`, but no UI button. Users can't trigger it from the platform.

**Fix:** Add "Generate Dossier" button on person detail (when that page exists) or on case detail. Show loading state, render dossier JSON in a structured template.

---

### 24. No person detail page

**Labels:** `ui`, `enhancement`

**Problem:** Brain tools can resolve persons, but the platform has no `/people/[id]` page. Dossier link would land on a 404.

**Fix:** Build `/people/[id]` showing demographics, terms held, recent claims, recent news mentions, attached cases/projects.

---

### 25. Telegram error messages leak internal details

**Labels:** `bot`

**Problem:** In the error handler:
```ts
await sendMessage(chatId, `Error: ${message.slice(0, 500)}`);
```

Errors like database connection failures, stack traces, or API keys in URLs could leak.

**Fix:** Log full error server-side, send a generic "Something went wrong, I've logged it" to the user.

---

### 26. Conversation history char budget is static

**Labels:** `brain`, `bot`

**Problem:** `lib/conversation.ts` trims to `MAX_HISTORY=12` messages or `MAX_HISTORY_CHARS=12_000` chars. Both static. A long sourced brain answer can eat the whole budget with one message.

**Fix:** Token-based budget using `@anthropic-ai/tokenizer`. Keep the most recent ~4K tokens of context.

---

### 27. /cases and /projects list pages don't show evidence count / last activity

**Labels:** `ui`

**Problem:** Case/project list rows show title + status + updatedAt. Would be more useful to see "14 pieces of evidence, last active 2h ago" or "Brand analysis complete, influencer map 60%".

**Fix:** Compute summary stats in `listCases`/`listProjects` query (or add cached columns).

---

### 28. No export functionality

**Labels:** `ui`, `enhancement`

**Problem:** Can't export a case's journalism draft, a project's influencer list, or a person's dossier. Everything lives in the DB/UI.

**Fix:** Export buttons → server-side rendering → `.md` / `.pdf` / `.csv` files. PDF is deferred per memory.

---

## Process notes

- When filing real issues on GitHub, use these titles/bodies as-is. Labels map to the existing repo labels (bug, documentation, enhancement).
- If you create `priority:p0`..`p3` labels later, add them too.
- Each issue should be a single focused problem, not bundled.
- P0 items should not sit on the backlog — they risk data loss or security.
