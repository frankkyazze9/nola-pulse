---
name: ingest-document
description: The standard Dark Horse document ingest pipeline — PDF/scan/HTML/video/social post → GCS → OCR → chunking → contextual prefix → self-hosted embedding → pgvector + FTS → claim extraction, with full provenance.
---

# Ingesting a document into Dark Horse

Use this flow for every document that enters the corpus: court filings, campaign finance PDFs, news articles, hearing transcripts, social posts, PFDs, contracts, anything. Scrapers should call `ingestDocument()` rather than reimplementing.

## Entry point

```typescript
import { ingestDocument } from "@/lib/ingest/document-pipeline";

await ingestDocument({
  sourceUrl: string,        // canonical URL — required for provenance
  sourceSystem: string,     // e.g. "la_ethics" | "fec" | "courtlistener" | "nola_news"
  title?: string,
  publishedAt?: Date,
  buffer?: Buffer,          // for binary (PDF, image, audio, video)
  textContent?: string,     // for plain text (social posts, RSS articles)
  metadata?: Record<string, unknown>,
});
```

The pipeline returns the created (or existing) `Document` with all chunks + claims attached.

## Flow

### 1 — Hash-based dedupe

`lib/ingest/dedupe.ts` computes `sha256(buffer ?? textContent)` and checks `Document.hash`. If it exists, return the existing row. **No re-ingestion.**

### 2 — Wayback snapshot

`lib/wayback.ts` fires SavePageNow against `sourceUrl` and stores the result in `Document.archivedUrl`. Run even if the main ingest fails — provenance first.

### 3 — GCS raw write

`lib/gcs.ts` writes the buffer (or text) to:
```
gs://dark-horse-docs/raw/<sourceSystem>/<YYYY-MM-DD>/<hash>.<ext>
```
and stores the path in `Document.gcsPath`.

### 4 — Extraction

Dispatch by `docType`:

| docType | Extractor | Notes |
|---|---|---|
| `pdf` (scanned) | **Google Document AI** via `lib/ingest/ocr.ts` | OCR output cached in GCS by hash — reruns are free. ~$1.50/1K pages. |
| `pdf` (native) | `pdf-parse` or Unstructured.io | Cheap, no OCR needed. |
| `html` | `cheerio` for boilerplate stripping | Scraped article text. |
| `video` | **Whisper** via `pipelines/transcribe/whisper_job.py` in a Cloud Run Job | NOLA Council hearings, LA Legislature recordings. |
| `social_post` | passthrough `textContent` | Already plain text. |
| `hearing_transcript` | passthrough or Whisper | If already transcribed, skip. |
| dense-table PDF | **LlamaParse** | When Unstructured fails on FEC Schedule A / LA Ethics tables. |

The result is populated in `Document.textContent`.

### 5 — Semantic chunking

`lib/ingest/chunk.ts` splits `textContent` at ~800 tokens with 100-token overlap, preserving sentence boundaries. Chunks are created as `DocumentChunk` rows with `chunkIndex`, `pageNumber` (where known), `charStart`, `charEnd` — **these spans are what dossier citations point at**, so accuracy matters.

### 6 — Contextual prefix generation

For each chunk, `lib/ingest/contextual-prefix.ts` calls **Claude Haiku** via **Batch API (50% off)** with:
- **Cached block:** full document text (prompt caching, cache reads at ~10% of input price).
- **Fresh block:** this chunk.
- **Instruction:** "Generate a 1-2 sentence contextual prefix situating this chunk in the broader document. No fluff — state the section and subject."

The prefix is prepended to the chunk text before embedding. Delivers ~49% recall improvement over naive RAG per the [Anthropic Contextual Retrieval paper](https://www.anthropic.com/news/contextual-retrieval).

Every call logs to `ApiSpendLog` via `lib/claude/spend.ts`.

### 7 — Embedding

`lib/ingest/embed.ts` POSTs the prefixed chunk text to the `dark-horse-embed` Cloud Run service (VPC-private) which runs **BGE-small-en-v1.5** (384 dim). The returned vector is written into the pgvector `embedding` column on `DocumentChunk`.

**Zero API cost.** Just Cloud Run compute (~$2/mo scaled to zero).

### 8 — Postgres FTS

`DocumentChunk.tsv` is a `GENERATED ALWAYS AS` column — no manual update needed. GIN index makes BM25-style search fast. The brain's `search_documents` tool uses hybrid: pgvector cosine for semantic + `tsv @@ websearch_to_tsquery` for lexical, merged by reciprocal rank fusion.

### 9 — Claim extraction

`lib/ingest/claim-extract.ts` runs a **Haiku Batch API** pass per chunk with a system prompt instructing: *"Extract structured claims from this chunk. A claim is a factual assertion about a person or organization with a clear predicate. Return JSON list of { subject, predicate, object, confidence, charStart, charEnd }. Skip anything below 0.7 confidence."*

Persisted to `Claim` rows tied to `DocumentChunk.charStart/charEnd` so the brain can cite them precisely later.

## Cost discipline

Every LLM call in this pipeline goes through `lib/claude/batch.ts` which:
- Defaults to Haiku.
- Uses Batch API when non-interactive.
- Applies prompt caching on any cached block > 2K tokens.
- Logs to `ApiSpendLog`.
- Hard-fails at $95 MTD.

If a call would push over the cap, the pipeline skips the prefix/claim-extract steps and logs the skip — the document is still ingested and searchable, just without the LLM-derived enrichments until next month.

## When NOT to re-ingest

If a document was already ingested and you just want to refresh claim extraction (e.g. after improving the prompt), call `reExtractClaims(documentId)` directly — don't re-run the full pipeline. Saves OCR, chunking, and embedding costs.

## Verifying an ingest

```sql
SELECT d.id, d."sourceSystem", d.title, COUNT(c.id) AS chunk_count,
       d."gcsPath", d."archivedUrl"
FROM "Document" d
LEFT JOIN "DocumentChunk" c ON c."documentId" = d.id
WHERE d.id = '<id>'
GROUP BY d.id;
```

You should see a chunk count > 0 and both `gcsPath` + `archivedUrl` populated. If `archivedUrl` is null but `gcsPath` exists, the Wayback call failed — the document is still usable but provenance is incomplete.
