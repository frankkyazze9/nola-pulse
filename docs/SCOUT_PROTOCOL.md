# Scout Protocol

## What is a Scout?

A scout is an information-gathering agent. It discovers, fetches, parses, and stores data from external sources into the NOLA Pulse knowledge base. Scouts are the eyes and ears of the system.

## Scout Types

| Type | Purpose | Example |
|------|---------|---------|
| **API Scout** | Pulls from structured APIs (Socrata, REST) | 311, STR, crime data |
| **Scraper Scout** | Parses HTML from websites | Council meetings, news articles |
| **RSS Scout** | Monitors RSS/Atom feeds | Local news outlets |
| **Document Scout** | Downloads and parses PDFs/Excel | Budget documents, reports |
| **Profile Scout** | Builds profiles from multiple sources | Politician backgrounds |

## Creating a New Scout

### 1. Directory Structure

```
agents/scout-{name}/
  src/
    index.ts      # Main entry point
```

### 2. Template

```typescript
import { Agent } from "../../shared/agent-sdk";
import { SocrataClient, DATASETS } from "../../shared/socrata";

const agent = new Agent({
  name: "scout-{name}",
  version: "1.0.0",
  type: "scout",
});

const socrata = new SocrataClient();

async function main() {
  await agent.run(async () => {
    // 1. Fetch data from source
    const data = await socrata.query(DATASETS.YOUR_DATASET, {
      order: "date DESC",
      limit: 1000,
    });

    // 2. Transform to KB schema
    const rows = data.map(record => ({
      // Map source fields to BigQuery table columns
    }));

    // 3. Store in knowledge base
    if (rows.length > 0) {
      await agent.insertKB("your_table", rows);
    }

    // 4. Optionally store raw docs in Cloud Storage
    // await agent.storeDocument("path/file.json", JSON.stringify(data));

    // 5. Notify other agents
    await agent.publish("data.ingested", {
      source: "your-source",
      recordCount: rows.length,
    });
  });
}

export { main };

if (require.main === module) {
  main().catch(err => {
    console.error("Fatal:", err);
    process.exit(1);
  });
}
```

### 3. BigQuery Table

Add a table to the `nola_pulse_kb` dataset:

```bash
bq mk --table nola_pulse_kb.your_table \
  'field1:STRING,field2:INTEGER,ingested_at:TIMESTAMP'
```

### 4. Schedule

Add to Cloud Scheduler or the orchestrator's cron config.

## Rules

1. **Always store raw data** — keep the original in Cloud Storage before transforming
2. **Idempotent** — running twice shouldn't create duplicates (use upsert logic or date windows)
3. **Rate limit** — respect source APIs (Socrata: 1000 req/hr without token)
4. **Report status** — call `agent.reportStatus()` so the admin dashboard stays current
5. **Publish events** — always `agent.publish("data.ingested", ...)` when done
6. **Log clearly** — prefix logs with agent name: `[scout-name] message`

## Data Flow

```
External Source → Scout → Cloud Storage (raw) → BigQuery (structured) → Pub/Sub event
```

## Adding New Agent Types

The scout/analyst/creator/publisher taxonomy handles most needs. If you need a new type:

1. Add the type to `AgentConfig.type` in `agent-sdk.ts`
2. Create its directory under `agents/`
3. Follow the same `agent.run()` lifecycle pattern
4. Document in this file

Potential future types:
- **Researcher** — multi-step investigation combining multiple scouts' data
- **Monitor** — watches for real-time changes (price alerts, outage spikes)
- **Validator** — cross-references data between sources for accuracy
