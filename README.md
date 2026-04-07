# NOLA Pulse

AI-powered civic intelligence platform for New Orleans. Data that holds power accountable, predictions that keep people safe, and tools that make government accessible.

Built by [Frank Kyazze](https://github.com/frankkyazze9) — for the people who actually live here.

## Features

- **NOLA Pulse Dashboard** — Real-time civic data and city KPIs
- **Council Whisperer** — AI-generated city council meeting summaries
- **Blackout Prediction** — Power outage predictions using Entergy data
- **Flood Predictions** — Neighborhood-level flood risk from NOAA data
- **Displacement Tracker** — Housing displacement mapping (STRs, evictions, demolitions)
- **Entity Predictions** — Organization and contract tracking
- **Budget Explorer** — Interactive city budget visualization
- **Daily Article** — AI-generated civic analysis in Frank's voice
- **Community Forum** — Suggest new AI projects for New Orleans
- **Comedic Infographics** — Shareable civic data for Twitter/X

## Tech Stack

- **Framework**: Next.js 16 (App Router, TypeScript)
- **Styling**: Tailwind CSS 4
- **Database**: PostgreSQL via Prisma ORM
- **AI**: Anthropic Claude API
- **Deploy**: Google Cloud Run (us-south1)
- **CI/CD**: GitHub Actions + Cloud Build

## Local Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Set up environment variables
cp .env.example .env
# Edit .env with your values

# Start dev server
npm run dev
```

## Deployment

```bash
# First-time GCP setup
./deploy/setup.sh

# Deploy via Cloud Build
gcloud builds submit --config=cloudbuild.yaml --project=nola-ai-innovation
```

## Project Structure

```
app/           Next.js App Router pages and API routes
components/    Shared React components
lib/           Database client, Claude client, auth
pipelines/     Data ingestion and AI generation scripts
data/          Voice guide, neighborhood data, static datasets
prisma/        Database schema and migrations
deploy/        GCP infrastructure setup scripts
```

## License

Open source. Public code, public data, public APIs.
