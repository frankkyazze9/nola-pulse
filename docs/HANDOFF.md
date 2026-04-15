# Handoff — broken pipeline, next session

Snapshot: 2026-04-15. MTD spend: $6.10 / $100. Live: https://dark-horse-845570509325.us-south1.run.app

## What's broken (ordered by damage)

### 1. Ballotpedia scraper — dead for weeks

**Symptom:** `scraper-ballotpedia`, 19h since last run, partial, 3 fetched / **0 upserted** / 3 errors.

**Root cause:** Ballotpedia is behind CloudFront. It returns reduced content or 403s to Cloud Run egress IPs even with a Chrome UA. Known since the initial build — we pivoted to the Wikipedia-elections scraper as an alternative but never killed Ballotpedia or documented it as abandoned.

**Fix options:**
- (A) Delete the scraper entirely, mark dead in docs. Wikipedia-elections + news corpus covers candidate lists.
- (B) Route the scraper through a residential-IP proxy (Scrapfly, Bright Data, ScraperAPI). Adds ~$20–50/mo. Only worth it if Wikipedia coverage has specific gaps.
- **Recommendation:** (A). We already have `pipelines/scrapers/wikipedia-elections/` as the working replacement.

**Files:** `pipelines/scrapers/ballotpedia/index.ts`, registration in `app/api/jobs/scrape/[name]/route.ts`.

---

### 2. GDELT scraper — failing entirely

**Symptom:** `scraper-gdelt`, 6h since last run, **failed**, 0/0/1 error.

**Root cause:** Previously hit 429 rate limits; we dropped `rateLimitPerSec` to 0.2 (one req per 5 sec). Now failing entirely — likely a different error (date parsing, auth, or schema change on GDELT side). Need to read the latest error details from the ScraperRun row.

**Fix:** SSH into the database (or add a view on `/admin`) and inspect `errorDetails` JSON. Likely an API format change or network issue.

**Files:** `pipelines/scrapers/gdelt/index.ts`.

---

### 3. Bluesky scraper — all placeholder handles

**Symptom:** `scraper-bluesky`, 10 errors, 0 upserts. Every handle in `pipelines/scrapers/bluesky/handles.json` returns "Profile not found" — `gov-landry.bsky.social`, `nola-mayor.bsky.social`, `orleans-da.bsky.social`, etc.

**Root cause:** `handles.json` was seeded with plausible-looking but unverified handles. None of those accounts exist on Bluesky.

**Fix:** Curate a real list. Sources: LA politicians' official websites, linked social profiles in our news corpus, Bluesky's own search. Need ~30–50 real handles for LA elected officials, candidates, journalists, and advocacy orgs.

**Files:** `pipelines/scrapers/bluesky/handles.json`.

---

### 4. NOLA news RSS — relevance gate too aggressive

**Symptom:** `scraper-nola-news-rss`, 270 articles fetched, **only 6 upserted**. A 98% drop rate on feeds we curated specifically for LA political coverage.

**Root cause:** The Haiku pre-ingest relevance classifier (`lib/ingest/relevance.ts`, threshold 0.5) is miscalibrated. Either the system prompt is too strict, the threshold is too high, or Haiku is under-scoring ambiguous local politics.

**Fix:**
- Sample 30 dropped articles — is the classifier right (actual noise like weather/crime/sports) or wrong (real political coverage misclassified)?
- If miscalibrated: lower threshold to 0.3, relax the prompt, or bypass the gate for known-political feeds (Illuminator, The Lens, Verite, Bayou Brief).

**Files:** `lib/ingest/relevance.ts`, `lib/ingest/document-pipeline.ts` (the `BYPASS_RELEVANCE` set).

---

### 5. Zero candidacies for May 12, 2026 election

**Symptom:** `Election` row exists for 2026-05-12 New Orleans. `Candidacy` count: 0.

**Root cause:** Ballotpedia (intended candidate-list source) is dead. Wikipedia-elections ingested 5 pages but none were parsed into structured candidacies.

**Fix:** Manually trigger a targeted brain task: give it the Election ID and ask it to register candidates from the news corpus using `upsert_person_by_name` + `create_candidacy` tools. We have 314 political docs from the last 7 days — should have the coverage.

---

## What Frank does on the MacBook Air

**Nothing required — you can hand off to the new chat and say "read docs/HANDOFF.md and pick it up."**

Optional, if you want to help unblock:
- **Bluesky handles:** send the new chat a list of 10–20 LA Bluesky accounts you know exist (politicians, journalists, orgs). That's the fastest unblock for #3.
- **LegiScan API key** (still outstanding per `docs/DATA_GAPS.md`): if you have one, drop it in Secret Manager as `LEGISCAN_API_KEY`.
- **FB Ad Library access token:** same, as `FB_AD_LIBRARY_TOKEN`.

Everything else the new chat can do autonomously — it has `gcloud` creds, push access, and the brain endpoint.

## Suggested order for the next chat

1. **#4 — relevance gate calibration** (biggest impact: unblocks most news ingest)
2. **#1 — kill Ballotpedia** (cleanup, removes a perpetual error row)
3. **#2 — diagnose GDELT** (inspect errorDetails, decide fix vs. kill)
4. **#3 — Bluesky handles** (only if Frank drops a starter list, else defer)
5. **#5 — populate May 12 candidacies** via brain tool-use against existing corpus
6. Then: pattern detection / dark horse analysis on the populated election

## Live system state (read on demand)

- Admin dashboard: https://dark-horse-845570509325.us-south1.run.app/admin (password auth)
- Cloud Build console: https://console.cloud.google.com/cloud-build/builds?project=845570509325
- Cloud Run logs: `gcloud run services logs read dark-horse --region=us-south1 --project=nola-ai-innovation --limit=50`
- Deploys are manual: `gcloud builds submit --config=cloudbuild.yaml --project=nola-ai-innovation`

## Push auth gotcha

The shell env has `GH_TOKEN` set to a read-only PAT. `git push` fails with 403. Workaround in the session: `unset GH_TOKEN GITHUB_TOKEN && git push` — the `gh` credential helper then uses the write-capable token.
