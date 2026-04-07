# NOLA Pulse — Reference Architecture

## System Overview

NOLA Pulse is an autonomous civic intelligence engine for New Orleans. It is not a website with a database — it is a team of AI agents that continuously discover, analyze, and publish civic intelligence, with a human operator (Frank) at the helm approving and steering output.

The system has four layers:

```
┌─────────────────────────────────────────────────────────────┐
│                    ADMIN COMMAND CENTER                      │
│    Frank's dashboard: approve, edit, steer, monitor          │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                     AGENT ORCHESTRATOR                       │
│    Central brain: assigns work, routes data, manages state   │
└──┬───────────┬───────────┬───────────┬──────────────────────┘
   │           │           │           │
┌──▼──┐   ┌───▼──┐   ┌────▼──┐   ┌───▼────┐
│SCOUT│   │ANALYST│  │CREATOR│   │PUBLISHER│
│AGENTS│  │AGENTS │  │AGENTS │   │AGENTS   │
└──┬──┘   └───┬──┘   └────┬──┘   └───┬────┘
   │          │            │          │
┌──▼──────────▼────────────▼──────────▼───────────────────────┐
│                     KNOWLEDGE BASE                           │
│    BigQuery + Vector Store + Cloud Storage + Cloud SQL        │
└─────────────────────────────────────────────────────────────┘
```

## Agent Architecture

### Agent Types

Each agent is a Cloud Run job or service that receives tasks, does work, and reports results. Agents communicate through Pub/Sub topics and store state in Firestore.

#### 1. Scout Agents — Data Discovery & Ingestion

Scouts find and ingest raw data from the world into the knowledge base. They run on schedules and can be triggered manually from the admin dashboard.

| Scout | Source | Schedule | Output |
|-------|--------|----------|--------|
| **Council Scout** | City council agendas, minutes, transcripts, voting records from nola.gov | Daily 6am CT | Raw transcripts → Cloud Storage, metadata → BigQuery |
| **Entergy Scout** | Entergy outage tracker, rate filings, public reports | Every 30min (storm season), daily (normal) | Outage records → BigQuery time-series |
| **Housing Scout** | STR permits, property sales (assessor), eviction filings, demolition permits | Weekly | Events → BigQuery, geocoded → Cloud SQL |
| **Budget Scout** | City adopted budget, CAFRs, contract awards from procurement portal | Monthly / on publication | Line items → BigQuery |
| **Flood Scout** | NOAA/NWS APIs, Sewerage & Water Board pump station data | Every 6hrs (hurricane season) | Predictions → BigQuery, alerts → Pub/Sub |
| **News Scout** | Local media RSS (NOLA.com, The Lens, Gambit, WWNO), city press releases | Every 2hrs | Articles → Cloud Storage, summaries → BigQuery |
| **Social Scout** | Twitter/X trending topics in New Orleans, Reddit r/NewOrleans | Every 4hrs | Trends → BigQuery |
| **Entity Scout** | City contracts, campaign finance, lobbying disclosures, corporate filings | Weekly | Entity graph → BigQuery |
| **Education Scout** | NOLA-PS school performance scores, enrollment, charter applications | Monthly / on release | Scores → BigQuery |

Each scout follows a common pattern:

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Fetch   │───▶│  Parse   │───▶│  Store   │───▶│  Notify  │
│  Source  │    │  & Clean │    │  in KB   │    │  via Pub/ │
│          │    │          │    │          │    │  Sub      │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

#### 2. Analyst Agents — Pattern Recognition & Insight Generation

Analysts read from the knowledge base, identify what's interesting, and produce structured insights that creators can turn into content.

| Analyst | Purpose | Trigger |
|---------|---------|---------|
| **Pattern Detector** | Finds recurring patterns across time (e.g., outages spike in X neighborhood every summer) | Daily, after scouts complete |
| **Anomaly Detector** | Flags things that are statistically unusual (e.g., budget line item doubled, contract awarded to new entity) | On new data ingestion |
| **Trend Tracker** | Tracks metrics over time, generates trend summaries (e.g., displacement accelerating in Bywater) | Weekly |
| **Comparator** | Year-over-year, neighborhood-to-neighborhood, pre/post-policy comparisons | On demand / weekly |
| **Story Finder** | Uses Claude to read today's data and identify the most compelling narrative | Daily 7am CT |

Analyst output is a structured **Insight** object:

```typescript
interface Insight {
  id: string;
  type: "pattern" | "anomaly" | "trend" | "comparison" | "story";
  headline: string;          // One-line summary
  summary: string;           // 2-3 paragraph analysis
  dataPoints: DataPoint[];   // Supporting evidence with citations
  relevance: number;         // 0-100 score
  topics: string[];          // council, energy, housing, budget, etc.
  suggestedFormats: string[]; // article, infographic, white_paper, tweet
  createdAt: string;
}
```

#### 3. Creator Agents — Content Generation

Creators take insights and turn them into publishable content. All content goes to a review queue before publication.

| Creator | Output | Voice | Approval |
|---------|--------|-------|----------|
| **Article Writer** | 500-800 word daily articles | Frank's voice (data/voice.md) | Required for first 30 days, then auto-publish with review option |
| **Infographic Creator** | Data visualizations with comedic captions | Frank's voice, @lookatthisfuckinstreet energy | Required |
| **White Paper Writer** | 3,000-10,000 word deep dives on specific topics | Authoritative but accessible, still Frank | Required |
| **Tweet Composer** | Thread-ready tweets with data hooks | Frank's voice, punchy, shareable | Optional (can auto-post) |
| **Newsletter Writer** | Weekly digest of top insights | Frank's voice, curated | Required |

Content generation pipeline:

```
Insight ──▶ Creator Agent ──▶ Draft ──▶ Review Queue ──▶ Frank ──▶ Publish
                │                              │
                ▼                              ▼
          data/voice.md                  Admin Dashboard
          Knowledge Base                 (approve/edit/reject)
          (for context)
```

#### 4. Publisher Agents — Distribution

Publishers take approved content and distribute it to the right channels.

| Publisher | Channel | Trigger |
|-----------|---------|---------|
| **Website Publisher** | nola-pulse app (articles, infographics pages) | On approval |
| **Twitter Publisher** | @nolaailab Twitter/X account | On approval or scheduled |
| **Newsletter Publisher** | Email list (Resend or SendGrid) | Weekly on approval |

### Agent Communication

Agents communicate through **Pub/Sub topics**, not direct calls. This decouples agents and lets them scale independently.

```
Topics:
  nola-pulse.data.ingested     — Scout finished ingesting new data
  nola-pulse.insight.created   — Analyst found something interesting
  nola-pulse.content.drafted   — Creator produced a draft
  nola-pulse.content.approved  — Frank approved content for publication
  nola-pulse.content.published — Publisher distributed content
  nola-pulse.agent.status      — Agent health/progress updates
```

Message flow example — daily article:

```
1. Cloud Scheduler triggers Council Scout + Entergy Scout + News Scout
2. Scouts ingest data, publish to nola-pulse.data.ingested
3. Story Finder agent subscribes, reads today's data, produces Insight
4. Insight published to nola-pulse.insight.created
5. Article Writer subscribes, generates draft using Insight + voice.md + KB context
6. Draft published to nola-pulse.content.drafted
7. Admin dashboard shows draft in review queue
8. Frank approves (or edits and approves)
9. Approval published to nola-pulse.content.approved
10. Website Publisher + Twitter Publisher subscribe, distribute content
11. Published event sent to nola-pulse.content.published
```

### Agent Runtime

Each agent runs as a **Cloud Run Job** (for batch/scheduled work) or a **Cloud Run Service** (for event-driven work via Pub/Sub push subscriptions).

```
Agent Structure:
  agents/
    scout-council/
      src/index.ts          # Agent entry point
      src/scraper.ts         # Source-specific scraping logic
      Dockerfile
      cloudbuild.yaml
    scout-entergy/
      ...
    analyst-story-finder/
      src/index.ts
      src/prompts/           # Claude prompt templates
      Dockerfile
    creator-article-writer/
      src/index.ts
      src/prompts/
      Dockerfile
    ...
```

Common agent SDK (shared library):

```typescript
// agents/shared/agent-sdk.ts

interface AgentConfig {
  name: string;
  version: string;
  topics: {
    subscribe: string[];
    publish: string[];
  };
}

class Agent {
  constructor(config: AgentConfig) { ... }

  // Read from knowledge base
  async queryKB(query: string): Promise<KBResult[]> { ... }

  // Store in knowledge base
  async storeInKB(data: KBRecord): Promise<void> { ... }

  // Publish event
  async publish(topic: string, message: any): Promise<void> { ... }

  // Call Claude
  async think(prompt: string, context?: string): Promise<string> { ... }

  // Report status to orchestrator
  async reportStatus(status: AgentStatus): Promise<void> { ... }
}
```

## GCP Service Map

```
┌──────────────────────────────────────────────────────────┐
│                    GCP: nola-ai-innovation                │
│                    Region: us-south1                      │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐ │
│  │  Cloud Run   │  │  Cloud Run   │  │   Cloud Run      │ │
│  │  Service:    │  │  Jobs:       │  │   Service:       │ │
│  │  nola-pulse  │  │  scout-*     │  │   orchestrator   │ │
│  │  (web app)   │  │  analyst-*   │  │   (agent brain)  │ │
│  │              │  │  creator-*   │  │                  │ │
│  └──────┬───────┘  └──────┬──────┘  └────────┬─────────┘ │
│         │                 │                   │           │
│  ┌──────▼─────────────────▼───────────────────▼─────────┐│
│  │                    Pub/Sub                            ││
│  │  nola-pulse.data.ingested                             ││
│  │  nola-pulse.insight.created                           ││
│  │  nola-pulse.content.drafted                           ││
│  │  nola-pulse.content.approved                          ││
│  │  nola-pulse.content.published                         ││
│  │  nola-pulse.agent.status                              ││
│  └──────┬────────────────────────────────────────────────┘│
│         │                                                 │
│  ┌──────▼──────┐  ┌─────────────┐  ┌──────────────────┐ │
│  │  Cloud SQL   │  │  BigQuery    │  │  Cloud Storage   │ │
│  │  PostgreSQL  │  │  (Knowledge  │  │  (raw docs,      │ │
│  │  (app data,  │  │   Base:      │  │   media,         │ │
│  │   content,   │  │   30yr NOLA  │  │   transcripts,   │ │
│  │   forum)     │  │   data)      │  │   generated      │ │
│  │              │  │              │  │   images)         │ │
│  └──────────────┘  └─────────────┘  └──────────────────┘ │
│                                                          │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────────┐ │
│  │  Firestore    │  │  Vertex AI   │  │  Secret Manager  │ │
│  │  (agent state,│  │  (embeddings,│  │  (API keys,      │ │
│  │   real-time   │  │   vector     │  │   DB creds)      │ │
│  │   dashboard)  │  │   search)    │  │                  │ │
│  └──────────────┘  └─────────────┘  └──────────────────┘ │
│                                                          │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────────┐ │
│  │  Cloud        │  │  Cloud Build │  │  Cloud Armor     │ │
│  │  Scheduler    │  │  (CI/CD)     │  │  (DDoS, WAF)     │ │
│  │  (cron jobs)  │  │              │  │                  │ │
│  └──────────────┘  └─────────────┘  └──────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### Service Roles

| Service | Purpose | Cost Tier |
|---------|---------|-----------|
| **Cloud Run (nola-pulse)** | Next.js web app — public dashboard, admin panel, API | Pay-per-request, ~$5-20/mo |
| **Cloud Run (orchestrator)** | Agent orchestrator — receives Pub/Sub events, assigns work | Pay-per-request, ~$5/mo |
| **Cloud Run Jobs (agents)** | Individual agent executions — scouts, analysts, creators | Pay-per-execution, ~$10-30/mo |
| **Pub/Sub** | Agent-to-agent messaging, event bus | ~$2/mo at moderate volume |
| **Cloud SQL (PostgreSQL)** | Structured app data — articles, forum posts, content queue | db-f1-micro, ~$7/mo |
| **BigQuery** | Knowledge base — 30 years of NOLA civic data, analytics | Free tier covers Phase 1, ~$5-20/mo at scale |
| **Cloud Storage** | Raw documents, generated images, media assets | ~$1-5/mo |
| **Firestore** | Real-time agent state, admin dashboard live updates | Free tier covers Phase 1 |
| **Vertex AI** | Text embeddings for semantic search over KB | ~$5-15/mo |
| **Cloud Scheduler** | Cron triggers for scouts and daily content generation | ~$0.30/mo |
| **Secret Manager** | API keys, database credentials | ~$0 (free tier) |
| **Cloud Armor** | DDoS protection, rate limiting on public endpoints | ~$5/mo (standard tier) |

**Estimated total: $45-120/month** scaling with data volume and agent activity.

## Knowledge Base Architecture

The knowledge base is the foundation everything else builds on. It's not a single database — it's a layered system optimized for different access patterns.

### Layer 1: Raw Document Store (Cloud Storage)

Everything ingested gets stored in its original form.

```
gs://nola-pulse-kb/
  council/
    transcripts/
      2024-01-15-regular-session.pdf
      2024-01-15-regular-session.txt    # OCR/extracted text
    agendas/
    minutes/
    ordinances/
  budget/
    adopted/
      FY2024-adopted-budget.pdf
      FY2024-adopted-budget.csv         # Parsed structured data
    cafr/
    contracts/
  energy/
    outage-snapshots/
      2024-01-15T14:30:00.json
    rate-filings/
  housing/
    str-permits/
    property-sales/
    evictions/
  news/
    articles/
      2024-01-15-nola-com-entergy-outage.json
  education/
    school-performance/
    enrollment/
```

### Layer 2: Structured Data (BigQuery)

Parsed, cleaned, queryable data organized by domain.

```sql
-- Dataset: nola_pulse_kb

-- Council data
nola_pulse_kb.council_meetings     -- date, type, attendance, agenda_items
nola_pulse_kb.council_votes        -- meeting_id, item, member, vote, result
nola_pulse_kb.ordinances           -- number, title, sponsor, status, effective_date

-- Energy data
nola_pulse_kb.outage_timeseries    -- timestamp, zip, neighborhood, customers_out, cause
nola_pulse_kb.entergy_rates        -- year, rate_type, amount, change_pct

-- Housing data
nola_pulse_kb.str_permits          -- address, neighborhood, type, status, issue_date
nola_pulse_kb.property_sales       -- address, neighborhood, sale_price, date, buyer, seller
nola_pulse_kb.eviction_filings     -- address, neighborhood, date, outcome
nola_pulse_kb.demolition_permits   -- address, neighborhood, date, reason

-- Budget data
nola_pulse_kb.budget_line_items    -- fiscal_year, department, fund, category, amount
nola_pulse_kb.contracts_awarded    -- vendor, amount, department, date, description

-- Education data
nola_pulse_kb.school_scores        -- school, year, letter_grade, sps_score, growth_score
nola_pulse_kb.enrollment           -- school, year, grade, count

-- Infrastructure
nola_pulse_kb.pothole_requests     -- address, reported_date, resolved_date, days_open
nola_pulse_kb.pump_stations        -- station_id, status, capacity, last_maintenance

-- News & social
nola_pulse_kb.news_articles        -- source, url, title, date, summary, topics
nola_pulse_kb.social_trends        -- platform, topic, volume, sentiment, date

-- Generated content
nola_pulse_kb.insights             -- analyst output, scored and categorized
nola_pulse_kb.published_content    -- everything published, for self-reference
```

### Layer 3: Vector Store (Vertex AI + BigQuery)

Semantic search across all text content. Every document, article, transcript, and insight gets embedded.

```
Embedding pipeline:
  1. Text extracted from raw document (Cloud Storage)
  2. Chunked into ~500 token segments with overlap
  3. Embedded via Vertex AI text-embedding model
  4. Stored in BigQuery with vector index

Query flow:
  Agent asks: "What has the council said about Entergy rate increases?"
  1. Query embedded via same model
  2. Vector similarity search in BigQuery
  3. Top-K chunks returned with source citations
  4. Agent uses chunks as context for Claude prompt
```

### Layer 4: Agent Memory (Firestore)

Real-time operational state — what agents are doing, what they've seen, what's in the queue.

```
firestore:
  agents/
    {agent-id}/
      status: "running" | "idle" | "error"
      lastRun: timestamp
      lastResult: { ... }
      config: { ... }

  content-queue/
    {content-id}/
      type: "article" | "infographic" | "white_paper" | "tweet"
      status: "draft" | "pending_review" | "approved" | "published" | "rejected"
      insight_id: string
      body: string
      created_by: string (agent name)
      reviewed_by: string | null
      created_at: timestamp

  insights/
    {insight-id}/
      type: "pattern" | "anomaly" | "trend" | "story"
      headline: string
      relevance: number
      consumed_by: string[] (which creators used this)
```

## Admin Command Center

The admin dashboard is Frank's cockpit. It's a section of the Next.js app that shows real-time agent status, content review queues, and system controls.

### Dashboard Sections

#### Mission Control (/)
- Agent status grid — which agents are running, idle, errored
- Today's stats — data ingested, insights found, content generated, content published
- Alert feed — anomalies, errors, things needing attention

#### Content Queue (/admin/content)
- **Drafts** — AI-generated content awaiting review
  - Preview card with title, summary, source insight
  - Approve / Edit / Reject buttons
  - Inline editor for quick edits before publishing
- **Scheduled** — Approved content waiting for publish time
- **Published** — Archive of everything that went live
- **Rejected** — Content that didn't make the cut (agents learn from this)

#### Knowledge Base (/admin/kb)
- Data source status — last ingestion time, record counts, error rates
- Browse data by domain (council, energy, housing, budget, education)
- Manual data upload (paste a transcript, upload a PDF)
- Search the knowledge base (full-text + semantic)

#### Agent Management (/admin/agents)
- Per-agent config — schedules, prompts, parameters
- Trigger manual runs
- View logs and execution history
- Pause/resume individual agents

#### Analytics (/admin/analytics)
- Content performance — which articles get traffic, which tweets get engagement
- Data coverage — gaps in the knowledge base, periods with missing data
- Agent efficiency — execution times, error rates, cost per run

### Real-Time Updates

The admin dashboard uses **Firestore real-time listeners** for live updates. When an agent produces a draft, it appears in the content queue instantly without polling.

```typescript
// Admin dashboard — real-time content queue
onSnapshot(collection(db, "content-queue"), (snapshot) => {
  snapshot.docChanges().forEach((change) => {
    if (change.type === "added") {
      // New draft appeared — show notification
    }
    if (change.type === "modified") {
      // Status changed (approved, published, etc.)
    }
  });
});
```

## Content Pipeline Detail

### Daily Article Pipeline

```
05:00 CT  Cloud Scheduler triggers scout agents
          ├── Council Scout checks for new meetings/votes
          ├── Entergy Scout pulls latest outage data
          ├── News Scout scans local media
          └── Social Scout checks trending topics

06:00 CT  Story Finder agent runs
          ├── Queries BigQuery for today's new data
          ├── Calls Claude to identify most compelling narrative
          └── Produces ranked list of Insights

07:00 CT  Article Writer agent runs
          ├── Takes top Insight from Story Finder
          ├── Queries KB for supporting context (vector search)
          ├── Loads data/voice.md for style guide
          ├── Calls Claude to generate 500-800 word article
          └── Stores draft in content-queue (Firestore)

07:01 CT  Admin dashboard shows notification
          └── Frank reviews, edits if needed, approves

On approval:
          ├── Website Publisher adds to /articles
          ├── Twitter Publisher posts thread
          └── Article stored in KB for future reference
```

### White Paper Pipeline

```
Trigger: Manual (Frank requests) or Analyst detects major pattern

1. Frank selects topic or Analyst produces high-relevance Insight
2. White Paper Writer agent:
   a. Deep KB query — pulls all relevant data across domains
   b. Builds outline via Claude
   c. Generates each section with data citations
   d. Produces 3,000-10,000 word document
   e. Generates executive summary
3. Draft → content queue → Frank reviews
4. On approval → published to /reports on website
```

### Infographic Pipeline

```
Trigger: Daily, or on high-relevance Insight

1. Infographic Creator agent:
   a. Selects data point (from Insights or direct from KB)
   b. Generates comedic copy in Frank's voice via Claude
   c. Produces infographic layout spec (JSON)
   d. Renders image (template-based or Vertex AI Imagen)
   e. Generates tweet text
2. Draft → content queue → Frank reviews
3. On approval → Twitter Publisher posts
```

## Security Architecture

### Authentication & Authorization

- **Public site**: No auth required. All civic data is public by design.
- **Admin panel**: NextAuth with Google OAuth, restricted to Frank's email.
- **Agent-to-agent**: Service account authentication via GCP IAM.
- **Cron endpoints**: Bearer token (CRON_SECRET) verification.
- **Pub/Sub**: GCP-native authentication, no external access.

### Data Security

- All secrets in Secret Manager, never in code or env files.
- Cloud SQL encrypted at rest and in transit.
- BigQuery access controlled via IAM — agents have read/write, public has no access.
- Cloud Storage buckets are private — content served through the app, not direct URLs.
- Cloud Armor on the Cloud Run service for DDoS and rate limiting.

### Content Safety

- All AI-generated content goes through review queue before publication.
- Article Writer agent has guardrails in system prompt: factual, cited, no speculation.
- Infographic Creator has voice.md constraints — comedy, not cruelty.
- Published content includes "AI-generated, reviewed by Frank Kyazze" attribution.

## Implementation Phases

### Phase 1: Agent Engine Foundation (Current Sprint)
- [ ] Set up Pub/Sub topics
- [ ] Build agent SDK (shared library)
- [ ] Build Orchestrator service
- [ ] Implement 1 scout (Council Scout) end-to-end
- [ ] Implement Story Finder analyst
- [ ] Implement Article Writer creator
- [ ] Wire content queue to admin dashboard
- [ ] End-to-end test: scout → analyst → creator → review → publish

### Phase 2: Scale Scouts + Admin Dashboard
- [ ] Add remaining scouts (Entergy, Housing, Budget, News, Social)
- [ ] Build full admin command center
- [ ] Set up BigQuery knowledge base tables
- [ ] Implement vector search with Vertex AI embeddings
- [ ] Add Infographic Creator
- [ ] Add Twitter Publisher

### Phase 3: Knowledge Base Deep Build
- [ ] Agents backfill 30 years of council records
- [ ] Agents ingest historical Entergy data
- [ ] Agents process property sales / STR history
- [ ] Agents build entity relationship graph
- [ ] Pattern Detector and Anomaly Detector go live
- [ ] White Paper Writer goes live

### Phase 4: Autonomous Operations
- [ ] Auto-publish pipeline (articles after 30-day review period)
- [ ] Newsletter Writer + Publisher
- [ ] Agent self-monitoring and auto-recovery
- [ ] Content performance feedback loop (agents learn what performs well)
- [ ] Public API for civic data access
