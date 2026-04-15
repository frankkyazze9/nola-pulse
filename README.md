# Dark Horse

Louisiana OSINT and political-intelligence platform. An agent-driven deep-research "brain" that reasons over a Louisiana / New Orleans political knowledge graph — campaign finance, court records, ethics filings, public hearings, news coverage, social feeds — and returns sourced synthesis, risk assessments, and comedy-edged observations.

**Live:** https://dark-horse-845570509325.us-south1.run.app

Dark Horse is a closed platform. Access is password-gated and restricted to a short allowlist.

## Product modes

| Mode | Path | What it's for |
|---|---|---|
| Research | `/research` | Quick agent chat. One-off questions, exploratory work. |
| Cases | `/cases` | Long-running investigations. Evidence, risk, location trails, drafts. |
| Projects | `/projects` | Campaign/brand monitoring. Recurring observations against a target. |
| Elections | `/elections` | Race dashboards with candidates, seats, countdowns. |
| Observations | `/observations` | Agent-surfaced patterns, absurdities, underreported angles. |
| Risks | `/risks` | Active risk assessments across cases/projects/entities. |
| Admin | `/admin/spend` | Month-to-date LLM spend against the $100 ceiling. |

## Architecture

- **Framework:** Next.js 16 (App Router, `proxy.ts`) + React 19 + TypeScript. See `.claude/skills/next16-quirks/SKILL.md` — this repo's conventions differ from training-data Next.js.
- **Database:** PostgreSQL 15 + pgvector + FTS + HNSW, managed by Prisma 7. Schema in `prisma/schema.prisma` uses a FollowTheMoney-inspired entity model (Person, Organization, Jurisdiction, Post, Term, Election, Candidacy, Donation, VendorPayment, CourtCase, LocationPing, …).
- **The Brain:** `lib/brain/*` — a single Claude Sonnet 4.6 tool-use loop with prompt caching. 35+ tools cover search, case/project management, elections, risk, voice drafting, observations, and location pings. SSE streaming for chat; synchronous for batch work.
- **Observation engine:** `lib/observation/*` — two-stage Haiku triage + Sonnet generation scoring pattern-deviation, absurdity, hidden-obvious, and underreported-angle signals. Voice-constrained output.
- **Voice:** `lib/voice/*` — every generated sentence is validated against 18 forbidden words + em-dash ban derived from `data/voice/`.
- **Relevance gate:** `lib/ingest/relevance.ts` — Haiku pre-ingest classifier filters non-political content before OCR/embedding spend. Gate is bypassed for structured sources (FEC, ethics, council, court, ads, elections).
- **Document pipeline:** `lib/ingest/document-pipeline.ts` — source URL → GCS → Document AI OCR → chunking → Haiku contextual prefix (Batch API) → BGE-small embedding → pgvector + FTS → claim extraction. Fully transactional — no orphan documents.
- **Scrapers:** `pipelines/scrapers/*` — one directory per source. Trigger via `POST /api/jobs/scrape/[name]` with `x-cron-secret` header; Cloud Scheduler calls this on a nightly cadence.
- **Entity resolution:** Splink + DuckDB in a Python Cloud Run Job. Cross-source record linkage.
- **Auth:** Password + HMAC-signed session cookie (`lib/auth.ts`). 7-day expiry. No user table.
- **Hosting:** Google Cloud Run (us-south1), Cloud SQL (`nola-pulse-db`), GCS (`dark-horse-docs`), Artifact Registry (`dark-horse-repo`). Self-hosted BGE-small-en-v1.5 embeddings on a small Cloud Run service.
- **Budget:** **$100/month LLM hard ceiling.** Every LLM call routes through `lib/claude/spend.ts`; month-to-date at `/admin/spend`. See `.claude/skills/cost-discipline/SKILL.md`.

## Scrapers

| Name | Source | Notes |
|---|---|---|
| `nola-news-rss` | LA political news RSS | Curated LA-focused list: Illuminator, The Lens, Verite, NOLA.com, Gambit, WWNO, LA Weekly, Bayou Brief. |
| `gdelt` | GDELT 2.0 | Rate-limited to 0.2 req/sec. LA political filter. |
| `fec` | FEC bulk | LA federal candidates + committees. |
| `la-ethics-bootstrap` | Louisiana Ethics Board | Initial backfill. |
| `bluesky` | Bluesky AT Protocol | Handles tracked in `pipelines/scrapers/bluesky/handles.json`. |
| `ballotpedia` | Ballotpedia | CloudFront blocks Cloud Run IPs — reduced reliability. |
| `wikipedia-elections` | MediaWiki extracts API | Alternative to Ballotpedia for LA election pages. |

## Local development

```bash
npm install
cp .env.example .env     # edit with local Postgres + Anthropic key
npx prisma migrate dev
npx prisma db seed
npm run dev
```

## Deploy

Cloud Build watches `main` on GitHub. Pushing triggers image build → Artifact Registry → Cloud Run.

```bash
gcloud builds submit --config=cloudbuild.yaml --project=nola-ai-innovation
```

## Secrets

Production secrets live in Google Secret Manager (`nola-ai-innovation`, 845570509325). Injected at deploy via `cloudbuild.yaml`:

- `DATABASE_URL` — Cloud SQL (`nola-pulse-db` / `nolapulse` / `nolapulse`)
- `ANTHROPIC_API_KEY` — Anthropic
- `CRON_SECRET` — shared secret for Cloud Scheduler / manual scraper triggers
- `AUTH_SECRET` — HMAC key for session cookies
- `ADMIN_PASSWORD` — platform password
- `EMBEDDING_SERVICE_URL` — BGE embedding Cloud Run URL
- `DOCUMENT_AI_PROCESSOR_ID` — Document AI OCR processor
- `TWITTER_API_KEY` / `TWITTER_API_SECRET` / `TWITTER_ACCESS_TOKEN` / `TWITTER_ACCESS_SECRET` — legacy; migrating to SociaVault.

Document AI, GCS, Cloud SQL, and the embedding service authenticate via the Cloud Run service account.

## Project structure

```
app/                Next.js App Router pages + API routes
  research/         Quick agent chat
  cases/            Investigations (detail page includes map)
  projects/         Campaign/brand monitoring
  elections/        Race dashboards
  observations/    Agent-surfaced insights
  risks/            Active risk assessments
  admin/spend/      LLM spend dashboard
  api/              Route handlers (brain SSE, pings, jobs, auth, telegram)
components/
  cases/CaseMap.tsx       Leaflet map + add-point form
  elections/              Countdown badges
data/voice/         VOICE.md + voice-analysis.md (vendored from writing-voice)
deploy/             Infra setup scripts
lib/
  brain/            Tool-use loop, tools, handlers, SSE streaming
  claude/           Batch API, prompt caching, spend logging
  ingest/           Document pipeline + relevance gate
  observation/      Two-stage observation pipeline
  voice/            Voice prompt + validator
  conversation/     Conversation memory
  telegram/         Telegram Bot API client (deprioritized)
  scraper/          Shared scraper base
  auth.ts           Password + HMAC session
pipelines/
  embed/            BGE-small embedding service
  entity-resolution/  Splink + DuckDB Python job
  scrapers/         One directory per source
prisma/             Schema, migrations, seed
scripts/            CLI (brain-cli)
docs/
  ROADMAP.md        Phased build plan
  TRIAGE.md         Active bug/tech-debt log
  DATA_GAPS.md      Outstanding manual unlocks (API keys, handles)
  ISSUES.md         Known deficiencies
  deploy.md         Deploy runbook
.claude/skills/     Project-specific Claude Code skills
proxy.ts            Next 16 proxy (route auth)
```

## Skills

Read the relevant skill before working in a given area:

- `next16-quirks` — non-standard Next.js 16 conventions
- `brain-prompt` — the Brain's system-prompt contract and model-selection rules
- `osint-candidate` — end-to-end workflow for adding a political candidate
- `add-data-source` — checklist for wiring a new scraper
- `ingest-document` — document ingest pipeline
- `cost-discipline` — $100/mo budget rules

## License

Private / internal use only. No public distribution.
