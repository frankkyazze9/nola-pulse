# Dark Horse Roadmap

Last updated: 2026-04-14

Dark Horse is a Louisiana OSINT & intelligence platform. New Orleans niche, statewide reach. Three product modes on one engine: **Cases** (investigations), **Projects** (campaigns/brands), and **Research** (quick questions).

---

## Vision

Dark Horse is the platform for doing the work:

1. **Cases — investigations** → "Is NOLA recycling real?" / "Who's funding PAC X?" → research, evidence, findings, investigative journalism piece in the user's voice
2. **Projects — campaigns & brands** → "Judge Smith is running for Section A" → brand analysis, influencer map, growth plan, outreach list
3. **Research — quick questions** → "What do we know about [person]?" → sourced answer or dossier

**Agent-driven.** Users describe what they want. The agent creates the Case or Project, runs the research, and produces the deliverables. No templates, no manual configuration.

## Use cases
- Political research (oppo-research, candidate vetting, dossiers)
- Private investigations / Digital PI (individuals, organizations, patterns)
- Investigative journalism (agent-assisted writing in the user's voice, backed by sourced evidence)
- Brand analysis & growth (for political candidates: perception, coverage, social presence, influencer outreach)

## Geographic focus
- **Ultra-niche:** New Orleans
- **Statewide:** Louisiana

---

## Budget

| Category | Ceiling | Enforced by |
|---|---|---|
| LLM spend (Claude) | $100/mo hard cap | `lib/claude/spend.ts` — programmatic enforcement |
| Social media APIs | ~$100/mo target | `lib/spend.ts` — tracked in ApiSpendLog |
| Infrastructure | ~$25-30/mo | GCP billing alerts |
| **Total** | **~$220-230/mo max** | Cost dashboard at `/admin/spend` |

Full cost transparency — every API call logs to `ApiSpendLog` and surfaces on the admin spend dashboard.

---

## Social media API strategy

**Single vendor: SociaVault** — one REST API covering 25+ platforms. Pay-as-you-go, ~$20-50/mo.

Free supplements:
- **Facebook Ad Library API** — political/issue ads
- **Bluesky AT Protocol** — no key, no rate cliff

Off-limits (for-profit exclusion): Meta Content Library API, TikTok Research API.

Priority: Instagram + Twitter/X first, TikTok + Facebook phased in later.

---

## Phase 0: Foundation (DONE)

- [x] Prisma schema: FollowTheMoney entity model (Person, Organization, Jurisdiction, Post, Term, Election, Candidacy, Membership, Donation, VendorPayment, Ownership, CourtCase, Document, DocumentChunk, Claim, EntityMatch, ScraperRun, ApiSpendLog)
- [x] Initial migration with pgvector + FTS + HNSW/GIN indexes
- [x] Seed data: LA jurisdictions + Orleans Parish offices
- [x] Document ingest pipeline (OCR, chunking, contextual prefix, self-hosted embedding, claim extraction)
- [x] Brain reasoning loop with Sonnet tool-use, prompt caching, Zod validation, spend cap enforcement
- [x] Brain API route and CLI
- [x] 11 brain tools (search_people, get_person, search_documents, get_document, search_claims, get_donations, get_court_cases, get_news, get_hearings, get_public_opinion, web_search)
- [x] Scraper framework with rate limiting, retry, GCS save, Wayback archival, ScraperRun observability
- [x] 4 working scrapers (nola-news-rss, fec, gdelt, la-ethics-bootstrap), 3 stubs
- [x] Entity resolution: Splink job + Dockerfile

## Phase 1: Go Live (DONE)

- [x] Artifact Registry `dark-horse-repo`
- [x] Cloud SQL Postgres 15 + pgvector + migration + seed
- [x] GCS bucket `dark-horse-docs`
- [x] Document AI OCR processor
- [x] `dark-horse` main app deployed
- [x] `dark-horse-embed` service deployed (BGE-small-en-v1.5)
- [x] Secrets in Secret Manager
- [x] Password auth + login page + session cookies
- [x] Cloud Run public (password auth protects)

## Phase 2: Cases & Projects data model (NEXT)

*Goal: formalize Cases and Projects as first-class entities. Everything the brain produces gets attached to one of them.*

- [ ] Prisma model: `Case` — id, title, brief, status, createdAt, ownerId?, findings (JSON), outputDraft (text), linked Documents/Claims/People/Orgs via CaseEvidence join
- [ ] Prisma model: `Project` — id, title, subjectPersonId?, subjectOrgId?, goals (JSON), brandAnalysis (JSON), influencerMap (JSON), growthPlan (JSON), createdAt, status
- [ ] Prisma model: `CaseEvidence` — join Case ↔ Document | Claim | Person | Organization with role (primary_source | supporting | contradicting)
- [ ] Migration + generated client
- [ ] Brain tools: `create_case`, `update_case`, `attach_evidence`, `create_project`, `update_project`
- [ ] Brain tool: `draft_journalism_piece` — given a Case's findings, produce a markdown investigative piece

**No new API cost.**

## Phase 3: Platform UI (replaces chat-only)

*Goal: users manage their work from a real platform, not just a chat.*

- [ ] `/` home becomes a dashboard — active Cases, active Projects, recent Research
- [ ] `/cases` list + `/cases/[id]` detail view — brief, evidence board, findings, journalism draft
- [ ] `/projects` list + `/projects/[id]` detail view — subject profile, brand analysis, influencer list, growth plan
- [ ] `/research` chat stays as a mode for quick questions (current UI)
- [ ] Global nav: Dashboard, Cases, Projects, Research, Admin
- [ ] "New Case" / "New Project" flows driven by agent conversation, not forms
- [ ] Mobile-responsive throughout

**No new API cost** — all UI over existing data.

## Phase 4: Agent-driven workflow

*Goal: the agent creates and populates Cases/Projects autonomously from user intent.*

- [ ] Intent router — when the user describes work, classify as Case | Project | Research and route to the right mode
- [ ] Case workflow: agent drafts brief → runs tools → attaches evidence → produces findings → drafts journalism piece (on request)
- [ ] Project workflow: agent identifies subject → runs brand analysis → queries influencer engine → generates growth plan
- [ ] Journalism voice calibration — users provide sample writing, the agent matches tone/structure
- [ ] Status tracking — each Case/Project shows what the agent is currently doing, what's done, what's pending

**Added cost:** more tool-use iterations per session. Stays within $100/mo LLM cap via prompt caching.

## Phase 5: Admin & Observability

- [ ] `/admin/spend` — month-to-date vs ceiling, per-service donut, daily trend
- [ ] `/admin/scrapers` — run history, success/fail, records fetched/upserted
- [ ] `/admin/documents` — ingest volume by source
- [ ] `/admin/entities` — Splink entity match review queue

## Phase 6: Free data sources

- [ ] Bluesky scraper (AT Protocol)
- [ ] Facebook Ad Library API
- [ ] LegiScan LA
- [ ] CourtListener (federal court records)
- [ ] NOLA Council Granicus (agendas + Whisper transcripts)

## Phase 7: Social media intelligence (SociaVault)

- [ ] `SocialAccount` Prisma model
- [ ] SociaVault integration + spend logging
- [ ] Instagram scraper (priority 1)
- [ ] Twitter/X scraper (priority 1, existing API keys available)
- [ ] `search_social` brain tool
- [ ] TikTok + Facebook (phase-in)

## Phase 8: Influencer engine

- [ ] Cross-platform influencer scoring (reach × engagement × geographic × topic)
- [ ] `find_influencers` brain tool — given a race/issue/candidate, return ranked influencers
- [ ] `analyze_influencer` brain tool — deep profile on a specific account
- [ ] Influencer list export

## Phase 9: Pattern detection & link analysis

- [ ] Relationship graph builder
- [ ] Money flow tracing
- [ ] Co-occurrence detection
- [ ] Anomaly flags
- [ ] `find_connections`, `trace_money` brain tools
- [ ] Visual relationship map UI

## Phase 10: Advanced OSINT

- [ ] Property records (Orleans Parish Assessor)
- [ ] Business filings (LA Secretary of State)
- [ ] Court records (Orleans Parish Criminal/Civil)
- [ ] Personal financial disclosures (LA Ethics PFDs)

---

## Budget summary (projected steady-state)

| Line | Monthly |
|---|---|
| Cloud SQL + Cloud Run + GCS | $25-30 |
| Claude LLM (brain + ingest) | $15-40 |
| SociaVault (4 platforms) | $20-50 |
| Document AI + Whisper | $3-8 |
| **Total** | **$63-128/mo** |

---

## Decision log

| Date | Decision | Outcome |
|---|---|---|
| 2026-04-13 | Social media API vendor | SociaVault — unified, pay-as-you-go |
| 2026-04-13 | Social priority | IG + Twitter/X first |
| 2026-04-13 | Research-grade APIs | Meta Content Library + TikTok Research both blocked (nonprofit-only) |
| 2026-04-13 | Auth (bridge) | Password auth; IAP deferred until custom domain |
| 2026-04-14 | Product model | Shift from chat to Cases + Projects + Research platform |
| 2026-04-14 | Identity | Dark Horse only — no personal or external company names |
