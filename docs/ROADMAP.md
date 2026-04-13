# Dark Horse Roadmap

Last updated: 2026-04-13

Dark Horse is an OSINT intelligence platform for political research, investigations, and influencer identification. The "brain" is a Claude reasoning loop over a growing knowledge graph of people, organizations, documents, social media, and the connections between them.

---

## Vision

A digital private-investigator toolkit that the Dark Horse team can use to:

1. **Investigate individuals and organizations** — politicians, donors, PACs, lobbyists, judges, anyone in the Louisiana political ecosystem. Surface connections, contradictions, money flows, and patterns.
2. **Monitor the information landscape** — news, public hearings, court filings, social media. Know what's being said, by whom, and where sentiment is shifting.
3. **Identify influencers** — find the social media voices (Twitter/X, Instagram, TikTok, Facebook) with reach and alignment to help a political client win a race, whether that's a judicial seat, city council, or state rep.
4. **Generate deliverables** — sourced dossiers, influence maps, coverage gap reports, relationship graphs — all backed by citations, not hallucinations.

---

## Budget

| Category | Ceiling | Enforced by |
|---|---|---|
| LLM spend (Claude) | $100/mo hard cap | `lib/claude/spend.ts` — programmatic enforcement |
| Social media APIs | ~$100/mo target | `lib/spend.ts` — tracked in ApiSpendLog |
| Infrastructure | ~$25-30/mo | GCP billing alerts |
| **Total** | **~$220-230/mo max** | Cost dashboard at `/admin/spend` |

Full cost transparency is required. Every API call — LLM, social, OCR — logs to `ApiSpendLog` and surfaces on the admin spend dashboard.

---

## Social media API strategy

**Single vendor: SociaVault** — one REST API covering 25+ platforms (Twitter/X, Instagram, TikTok, Facebook, YouTube, Reddit, LinkedIn). Pay-as-you-go, ~$0.005/credit, credits never expire. ~$20-50/mo for Dark Horse's volume.

Supplemented by two free official APIs:
- **Facebook Ad Library API** — free, public, all political/issue ads. Highest-value free signal.
- **Bluesky AT Protocol** — free, no API key, no rate cliff. LA political class is migrating there.

Meta Content Library and TikTok Research APIs are off the table — both require nonprofit/academic affiliation that Dark Horse (for-profit consultancy) doesn't have.

**Priority order:** Instagram + Twitter/X first, then phase in TikTok + Facebook.

---

## Phase 0: Foundation (DONE)

*Commits: ca92cb1, a8ec9b9, 663b84e*

- [x] Strip Nola Pulse civic code
- [x] Cloud Build / Cloud Run infra config (`cloudbuild.yaml`, `docs/deploy.md`)
- [x] Prisma schema: FollowTheMoney entity model (Person, Organization, Jurisdiction, Post, Term, Election, Candidacy, Membership, Donation, VendorPayment, Ownership, CourtCase, Document, DocumentChunk, Claim, EntityMatch, ScraperRun, ApiSpendLog)
- [x] Initial migration with pgvector + FTS + HNSW/GIN indexes
- [x] Seed data: LA jurisdictions + Orleans Parish offices
- [x] Document ingest pipeline (OCR, chunking, contextual prefix, self-hosted embedding, claim extraction)
- [x] Brain reasoning loop (`lib/brain/runner.ts`) with Sonnet tool-use, prompt caching, Zod validation, spend cap enforcement
- [x] Brain API route (`POST /api/brain`) and CLI (`scripts/brain-cli.ts`)
- [x] 11 brain tools (search_people, get_person, search_documents, get_document, search_claims, get_donations, get_court_cases, get_news, get_hearings, get_public_opinion, web_search)
- [x] Scraper framework (`lib/scraper/base.ts`) with rate limiting, retry, GCS save, Wayback archival, ScraperRun observability
- [x] 4 working scrapers: nola-news-rss (10 LA outlets), fec, gdelt, la-ethics-bootstrap
- [x] 3 stub scrapers: bluesky, legiscan-la, nola-council-granicus
- [x] Entity resolution: Splink job + Dockerfile

## Phase 1: Go Live

*Goal: working system with real data flowing, accessible via CLI and API.*

**Infra (manual — can't be automated):**
- [x] Create `dark-horse-repo` Artifact Registry (us-south1)
- [x] Provision Cloud SQL (db-f1-micro, instance: `nola-pulse-db`) + apply migration + run seed
- [x] Create GCS bucket (`dark-horse-docs`)
- [x] Create Document AI OCR processor (`projects/845570509325/locations/us/processors/5af64dddbe7314c0`)
- [x] Deploy `dark-horse` Cloud Run service (`https://dark-horse-lo7wkq5zya-vp.a.run.app`)
- [ ] Deploy `dark-horse-embed` Cloud Run service (BGE-small-en-v1.5) — deploying
- [ ] Set up IAP on Cloud Run service
- [x] Set secrets in Secret Manager (DATABASE_URL, ANTHROPIC_API_KEY, CRON_SECRET)
- [ ] Push 3 local commits to origin, verify Cloud Build triggers
- [ ] Register for FEC API key (free, email APIinfo@fec.gov for 7200 req/hr)
- [ ] Clean up stale Nola Pulse secrets (see docs/deploy.md step 7)

**Code:**
- [ ] Cloud Scheduler cron jobs: nightly RSS + GDELT scraper triggers
- [ ] FEC scraper: initial LA federal candidates pull
- [ ] LA Ethics bootstrap: download Accountability Project CSV, run import
- [ ] Verify brain works end-to-end: ask a question, get a sourced answer
- [ ] Basic smoke test script (`scripts/smoke-test.ts`)

**Estimated cost:** ~$30/mo (Cloud SQL $12, Cloud Run $5, GCS $5, Haiku ingest $5, Sonnet brain $3)

## Phase 2: Brain Chat UI

*Goal: users can ask the brain questions from a browser.*

**Sprint 2.1 — Research chat interface (3-4 days)**
- [ ] `/research` page — conversational chat with the brain
- [ ] Streaming responses (SSE from `/api/brain/stream`) so users see progress, not a 60s spinner
- [ ] Rendered markdown answers with clickable source citations (documentId links to source URL)
- [ ] Conversation history — `Conversation` + `Message` Prisma models, sidebar list
- [ ] Person quick-search bar — typeahead against `search_people`, selecting a person pre-fills context

**Sprint 2.2 — Dossier UI (2-3 days)**
- [ ] "Generate Dossier" button from person search or conversation
- [ ] Dossier viewer — tabbed sections, sourced claims, coverage gaps highlighted
- [ ] Dossier list page — all generated dossiers, searchable by person name
- [ ] Mobile-responsive (users may be on mobile)

**No new API cost** — just UI over the existing brain.

## Phase 3: Admin & Observability

*Goal: admins can monitor system health and costs without SSH.*

**Sprint 3.1 — Spend dashboard (1-2 days)**
- [ ] `/admin/spend` — month-to-date total vs ceiling, donut chart by service (Claude, SociaVault, DocumentAI, etc.)
- [ ] Daily spend trend line (last 30 days)
- [ ] Per-operation breakdown table (brain_interactive, brain_dossier, ingest_*, scraper_social_*)
- [ ] Alert banner when MTD > 80% of ceiling

**Sprint 3.2 — Scraper & data health (1-2 days)**
- [ ] `/admin/scrapers` — run history table, success/fail/partial, records fetched/upserted, expandable error details
- [ ] `/admin/documents` — document count by sourceSystem, chart of daily ingest volume
- [ ] `/admin/entities` — entity match review queue (Splink needs_review matches), approve/reject UI

**No new API cost.**

## Phase 4: Free Data Sources

*Goal: fill the biggest data gaps at zero API cost.*

**Sprint 4.1 — Bluesky (1-2 days)**
- [ ] `@atproto/api` dep, no API key needed
- [ ] `pipelines/scrapers/bluesky/handles.json` — seed list of LA political handles
- [ ] Fetch `getAuthorFeed` for each handle, ingest posts as Documents
- [ ] Track replies + quote posts in metadata
- [ ] Link posts to Person by handle → personId mapping

**Sprint 4.2 — Facebook Ad Library (1-2 days)**
- [ ] `pipelines/scrapers/fb-ad-library/` — free, no API key for political ads
- [ ] Track political ad spend for LA races, ingest ads as Documents
- [ ] Extract advertiser, spend amount, impressions, targeting into metadata + claims

**Sprint 4.3 — LegiScan + CourtListener (2-3 days)**
- [ ] LegiScan LA — bills, votes, sponsors, committee assignments. Requires `LEGISCAN_API_KEY`.
- [ ] CourtListener — federal court records for LA-based figures. Free API, no key.

**Sprint 4.4 — NOLA Council Granicus (3-4 days)**
- [ ] HTML scrape of meeting list + agenda PDFs + video URLs
- [ ] Agenda PDF → document pipeline with `docType: "pdf"`
- [ ] Video URL → Whisper transcription Cloud Run Job → `hearing_transcript` Documents

**New env vars:** LEGISCAN_API_KEY
**Estimated added cost:** ~$3/mo (Whisper transcription)

## Phase 5: Social Media Intelligence (SociaVault)

*Goal: Instagram + Twitter/X data flowing into the knowledge graph.*

**Sprint 5.1 — SociaVault integration + data model (2-3 days)**
- [ ] New Prisma model: `SocialAccount` (platform, handle, personId?, displayName, followerCount, followingCount, engagementRate, bio, profileUrl, avatarUrl, lastScrapedAt, metadata)
- [ ] `lib/social/sociavault.ts` — SociaVault API client with spend logging to `ApiSpendLog` (service: "sociavault")
- [ ] Spend cap enforcement for social APIs (separate from LLM cap, tracked together on dashboard)
- [ ] `SocialAccount` ↔ `Person` linking (manual seed initially, brain-assisted discovery later)

**Sprint 5.2 — Instagram scraper (2-3 days)**
- [ ] `pipelines/scrapers/instagram/` using SociaVault
- [ ] Tracked accounts: seed list of LA political IG handles
- [ ] Ingest posts as Documents (`docType: "social_post"`, `sourceSystem: "instagram"`)
- [ ] Extract captions, hashtags, likes, comments count, engagement rate into metadata
- [ ] Profile stats snapshot on each run → SocialAccount update

**Sprint 5.3 — Twitter/X scraper (2-3 days)**
- [ ] `pipelines/scrapers/twitter-x/` using SociaVault
- [ ] Tracked accounts: seed list of LA political Twitter handles
- [ ] Ingest tweets as Documents (`docType: "social_post"`, `sourceSystem: "twitter"`)
- [ ] Extract mentions, hashtags, retweets, likes, replies into metadata
- [ ] `search_social` brain tool — unified social media search across all platforms

**New env vars:** `SOCIAVAULT_API_KEY`
**Estimated added cost:** $20-50/mo (SociaVault) + $2/mo (Haiku ingest)

## Phase 6: TikTok + Facebook (phase-in)

*Goal: expand social coverage to remaining platforms, still via SociaVault.*

**Sprint 6.1 — TikTok (2-3 days)**
- [ ] `pipelines/scrapers/tiktok/` using SociaVault
- [ ] Track politically-relevant creators and hashtags
- [ ] Ingest video metadata + captions as Documents
- [ ] High-value video transcription via Whisper (budget-gated: only if video has >10K views)

**Sprint 6.2 — Facebook pages (1-2 days)**
- [ ] `pipelines/scrapers/facebook/` using SociaVault
- [ ] Track LA political figure public pages
- [ ] Ingest posts as Documents

**Estimated added cost:** $5-15/mo (SociaVault credits for two more platforms) + $3/mo (selective Whisper)

## Phase 7: Influencer Engine

*Goal: identify and score influencers who can help a political client.*

- [ ] Cross-platform influencer scoring: reach x engagement x geographic relevance (NOLA/LA) x topic alignment
- [ ] Brain tool: `find_influencers` — given a race/issue/candidate, return ranked influencer candidates with reasoning
- [ ] Brain tool: `analyze_influencer` — deep profile on a specific social account: content themes, audience demographics (inferred), engagement patterns, political lean
- [ ] `/research/influencers` UI — browse, filter, and compare influencers by race/district/issue
- [ ] Export influencer lists (CSV initially, formatted report later)

**No new API cost** — uses data already flowing from Phases 4-6.

## Phase 8: Pattern Detection & Link Analysis

*Goal: surface non-obvious connections between people, organizations, and money.*

- [ ] Relationship graph builder — edges from donations, memberships, court cases, shared organizations, co-mentions in documents
- [ ] Money flow analysis — trace donation chains (donor → committee → vendor payments → beneficiaries)
- [ ] Co-occurrence detection — which names appear together across documents, hearings, social media
- [ ] Anomaly flags — sudden donation spikes, new associations, court filings
- [ ] Brain tool: `find_connections` — given two entities, find all paths connecting them
- [ ] Brain tool: `trace_money` — follow the money from a person or org
- [ ] `/research/graph` UI — visual relationship map (D3 or similar)

**No new API cost** — pure analysis over existing data.

## Phase 9: Advanced OSINT

*Goal: deeper investigative capabilities.*

- [ ] Property records — Orleans Parish Assessor scraper
- [ ] Business filings — LA Secretary of State business entity search
- [ ] Court records — Orleans Parish Criminal (Clerk Connect), Orleans Civil
- [ ] Personal financial disclosures — LA Ethics Board PFDs
- [ ] Reverse image search integration (for identifying individuals in photos)
- [ ] Domain/WHOIS lookup for websites associated with candidates/PACs

**Cost varies** — some sources are free, some have per-query fees. Evaluate per source.

---

## Budget summary (projected steady-state at full build-out)

| Line | Monthly |
|---|---|
| Cloud SQL (db-f1-micro) | $12 |
| Cloud Run (main + embed + jobs) | $8 |
| GCS | $5 |
| Claude Haiku (ingest, Batch API) | $5-10 |
| Claude Sonnet (brain) | $5-15 |
| SociaVault (IG + Twitter + TikTok + FB) | $20-50 |
| FB Ad Library API | $0 |
| Bluesky AT Protocol | $0 |
| Document AI | $1-3 |
| Whisper transcription | $3-5 |
| **Total** | **$59-108/mo** |

---

## Decision log

| Date | Decision | Outcome |
|---|---|---|
| 2026-04-13 | Social media API vendor | **SociaVault** — unified API, pay-as-you-go, all platforms |
| 2026-04-13 | Social priority order | Instagram + Twitter/X first, TikTok + Facebook phased in later |
| 2026-04-13 | Meta Content Library | Not eligible (requires nonprofit/academic) |
| 2026-04-13 | TikTok Research API | Not eligible (requires non-commercial research) |
| 2026-04-13 | Budget ceiling | ~$100/mo LLM + ~$100/mo social + ~$30/mo infra = ~$230/mo max |
| | Push to origin? | Pending |
