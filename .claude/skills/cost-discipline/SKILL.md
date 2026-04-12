---
name: cost-discipline
description: The $100/month Dark Horse budget rules — how to keep LLM and infrastructure spend under the ceiling. Read before adding any feature that calls the Anthropic API, OCR, or embedding service, or before provisioning new GCP resources.
---

# Dark Horse cost discipline

Dark Horse has a **$100/month hard ceiling** on total spend. This isn't a soft target — it's a design constraint that changes what features can ship.

## The rules (non-negotiable)

1. **Haiku-first for ingest.** Every LLM call in the document pipeline (contextual prefix, claim extraction, deduplication, summarization) uses **Haiku**. Sonnet in the ingest path is a bug.
2. **Sonnet only for the brain.** The brain's reasoning loop is the one place Sonnet is justified — multi-hop tool use needs the reasoning depth. Dossier generation is also Sonnet (same loop).
3. **Opus is off-limits.** Not in the budget. If a feature *requires* Opus, the feature doesn't ship until we re-negotiate the ceiling.
4. **Batch API (50% off) for all non-interactive LLM calls.** Contextual prefix, claim extraction, bulk summarization. Only brain interactive and dossier generation skip Batch (they're realtime).
5. **Prompt caching everywhere.** Cache any shared input > 2K tokens: system prompts, tool definitions, document corpora, context briefs. Cache reads cost ~10% of input price — this is the single biggest lever.
6. **Self-hosted embeddings.** Never pay for an embedding API. The `dark-horse-embed` Cloud Run service runs BGE-small-en-v1.5 (384 dim) at ~$2/mo. Zero API cost.
7. **Google Document AI with GCS cache.** OCR output cached by content hash so re-ingesting a document is free.
8. **Every LLM call logs to `ApiSpendLog`.** Via `lib/claude/spend.ts` wrapper. Never call `anthropic.messages.create` directly from application code.
9. **Hard cap at $95 MTD.** `lib/claude/spend.ts` reads month-to-date spend before each call. At >$95, new Sonnet calls force-downgrade to Haiku and surface a warning banner. At >$100, all non-essential LLM calls are rejected.
10. **Live spend meter in the admin UI.** `/admin/spend` shows month-to-date vs $100 and a per-service breakdown. Check it weekly.

## Target budget ($42–79/mo typical)

| Line | Monthly |
|---|---|
| Claude Haiku (ingest via Batch API) | $3–8 |
| Claude Sonnet (brain interactive) | $4–10 |
| Claude Sonnet (dossier generation ~10/mo) | $3–10 |
| Cloud SQL db-f1-micro | $10–15 |
| Cloud Run main service | $3–8 |
| Cloud Run `dark-horse-embed` | $2 |
| Google Document AI | $1–3 |
| GCS | $5–10 |
| Cloud Run Jobs + Cloud Scheduler | $1–3 |
| IAP | $0 |
| Buffer | $10 |
| **Total target** | **$42–79/mo** |

## Cost levers if the bill creeps up

Pull these in order when `/admin/spend` shows the monthly total trending past $80:

1. **Reduce dossier count.** Dossiers are the most expensive single operation. A per-user monthly cap is a reasonable move.
2. **Enable "cheap mode" in the brain.** A toggle that drops the brain to Haiku for less-complex conversations. Worse reasoning, much cheaper.
3. **Skip contextual retrieval on low-value docs.** Only apply the Haiku contextual-prefix pass to court records and financial filings; skip it for news articles (they're already well-structured). Saves ~50% of ingest Haiku spend.
4. **Migrate Cloud SQL → Neon.** Neon scales to zero, saves ~$10/mo if the DB is idle most of the day. Real work, not a config flip.
5. **Skip Whisper transcription for older hearings.** Transcribe only the last 12 months of NOLA Council meetings; archive older video untranscribed.
6. **Drop OCR to Tesseract for low-value docs.** Free but less accurate; fine for news clippings, bad for dense filings.
7. **Cap brain `web_search` calls per conversation.** Web search is the most expensive tool call. Limit to 3 per conversation.

## What NOT to do

- **Don't** bypass `lib/claude/spend.ts`. Every call must log.
- **Don't** use Sonnet/Opus for anything that could use Haiku.
- **Don't** add a paid embedding API. The self-hosted service is fine.
- **Don't** forget Batch API for any non-interactive LLM work. 50% off is a huge lever.
- **Don't** add a new third-party paid API without showing how it fits in the cost model.
- **Don't** add a feature whose estimated monthly cost isn't documented. Estimate first, ship second.

## When planning a new feature

Before implementing, estimate the feature's monthly LLM + API cost:

```
Expected calls/month × (avg input tokens + cached tokens + output tokens) × price per token
```

Write the number into the feature's PR description. If it would push the total over $80, propose a lever before merging.

## Spend visibility during development

When testing:
```bash
# See month-to-date spend by service
psql $DATABASE_URL -c "
  SELECT service, SUM(\"costUsd\") AS total
  FROM \"ApiSpendLog\"
  WHERE \"loggedAt\" >= date_trunc('month', CURRENT_DATE)
  GROUP BY service
  ORDER BY total DESC;
"
```

When something surprises you, trace it:
```bash
# Which operations are most expensive this month?
psql $DATABASE_URL -c "
  SELECT operation, COUNT(*), SUM(\"costUsd\") AS total
  FROM \"ApiSpendLog\"
  WHERE \"loggedAt\" >= date_trunc('month', CURRENT_DATE)
  GROUP BY operation
  ORDER BY total DESC
  LIMIT 10;
"
```
