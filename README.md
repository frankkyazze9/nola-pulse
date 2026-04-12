# Dark Horse

Internal political research tool for [Last Word Strategies](https://lastwordstrategies.com). Deep-research "brain" that reasons over a Louisiana / New Orleans political knowledge graph — campaign finance, court records, public hearings, news coverage, public opinion — and returns sourced analytical synthesis for candidates and seat-holders at every level (judges, city council, state reps, DAs, sheriffs, mayors).

**This is an internal tool.** There is no public site, no marketing page, and no anonymous access. Every page is gated behind Google IAP and restricted to a short allowlist of Last Word staff.

Built on top of the former "Nola Pulse" civic-intelligence platform — see git history prior to the rename for the earlier product.

## Architecture at a glance

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript. See `.claude/skills/next16-quirks/SKILL.md` for this repo's non-standard conventions.
- **Database:** PostgreSQL with pgvector + FTS, managed by Prisma 7. Schema in `prisma/schema.prisma` follows a FollowTheMoney-inspired political-entity model.
- **The Brain:** `lib/brain/*` — a single Claude Sonnet tool-use loop that interactive research and dossier generation both share. Tools expose structured queries into the knowledge graph.
- **Document pipeline:** `lib/ingest/*` — source URL → GCS → Google Document AI OCR → chunking → Haiku contextual prefix (Batch API) → self-hosted embedding → pgvector + FTS → claim extraction.
- **Scrapers:** `pipelines/scrapers/*` — one per source, deployed as Cloud Run Jobs on a nightly Cloud Scheduler cron. Priority 1 sources are news, public hearings, and public opinion.
- **Entity resolution:** Splink + DuckDB in a Python Cloud Run Job. Cross-source record linkage of persons and organizations.
- **Auth:** Google IAP in front of the Cloud Run service. No app-layer auth.
- **Hosting:** Google Cloud Run (us-south1). Cloud SQL for Postgres. GCS for documents. Cloud Run Jobs for scrapers + entity resolution + Whisper transcription. Self-hosted embeddings via a small BGE-small Cloud Run service.
- **Budget:** `$100/month hard ceiling`. All LLM calls route through `lib/claude/spend.ts`; month-to-date is visible at `/admin/spend`. See `.claude/skills/cost-discipline/SKILL.md`.

## Local development

```bash
# Install dependencies
npm install

# Copy env and edit
cp .env.example .env

# Apply the schema to your local Postgres (make sure pgvector is installed)
npx prisma migrate dev

# Seed jurisdictions and posts
npx prisma db seed

# Start the dev server
npm run dev
```

## Deploy

Cloud Build watches the `main` branch on GitHub. Pushing triggers a build of the image, a push to Artifact Registry, and a deploy to Cloud Run.

```bash
# Manual deploy
gcloud builds submit --config=cloudbuild.yaml --project=nola-ai-innovation
```

## Granting access to a new Last Word staffer

```bash
gcloud iap web add-iam-policy-binding \
  --resource-type=cloud-run \
  --service=dark-horse \
  --region=us-south1 \
  --member=user:<email> \
  --role=roles/iap.httpsResourceAccessor
```

That's the entire auth model. No user table, no sign-up flow, no password reset — IAP handles it.

## Secrets

Production secrets live in Google Secret Manager in the `nola-ai-innovation` GCP project. Cloud Build injects them at deploy time via `--set-secrets` in `cloudbuild.yaml`:

- `DATABASE_URL` — Cloud SQL connection string
- `ANTHROPIC_API_KEY` — Anthropic API key
- `CRON_SECRET` — shared secret for Cloud Scheduler calls

IAP, Document AI, GCS, Cloud SQL, and the embedding service all use the Cloud Run service account for authentication — no API-key secrets for them.

## Project structure

```
app/               Next.js App Router pages and API routes
components/        Shared React components (populated in Phase 8)
lib/
  brain/           The Claude tool-use loop + tool implementations
  claude/          Batch API wrapper, prompt caching, spend logging
  ingest/          Document pipeline
  scraper/         Shared scraper base
  db.ts            Prisma client singleton
  spend.ts         ApiSpendLog helper
  ocd.ts           Open Civic Data ID helpers
  ftm.ts           FollowTheMoney serialization helpers
pipelines/
  scrapers/        One directory per scraper
  entity-resolution/  Splink + DuckDB Python job
  transcribe/      Whisper transcription job
prisma/            Schema, migrations, seed data
scripts/           CLI scripts (brain-cli, test-dossier, seed-sanity)
.claude/skills/    Project-specific Claude Code skills
```

## Skills

The `.claude/skills/` directory holds project-specific Claude Code skills that encode design decisions so future sessions don't rediscover them. Read the relevant skill before working in a given area:

- `next16-quirks` — non-standard Next.js 16 conventions in this repo
- `brain-prompt` — the Brain's system-prompt contract and model-selection rules
- `osint-candidate` — end-to-end workflow for adding a new political candidate
- `add-data-source` — checklist for wiring up a new scraper
- `ingest-document` — the document ingest pipeline
- `cost-discipline` — $100/mo budget rules and cost levers

## License

Private / internal use only. No public distribution.
