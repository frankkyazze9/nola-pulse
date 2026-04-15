/**
 * Dark Horse document ingest pipeline.
 *
 * Takes any document source (URL + optional buffer/text) and runs it through:
 *   1. Content-hash dedupe (skip if already ingested)
 *   2. Wayback snapshot for provenance
 *   3. GCS raw save (if buffer)
 *   4. Text extraction (OCR via Document AI for scanned PDFs; passthrough for text)
 *   5. Semantic chunking
 *   6. Haiku contextual-prefix generation (cached on the full document)
 *   7. Self-hosted BGE-small embedding
 *   8. DocumentChunk insert + pgvector embedding update (raw SQL for the vector col)
 *   9. Haiku claim extraction
 *
 * Every LLM call logs to ApiSpendLog. OCR results are cached by hash.
 *
 * See `.claude/skills/ingest-document/SKILL.md` for the full contract.
 */

import { prisma } from "../db";
import { saveBuffer, rawPath } from "../gcs";
import { savePageNow } from "../wayback";
import { contentHash } from "./dedupe";
import { ocrPdf } from "./ocr";
import { chunkText } from "./chunk";
import { generateContextualPrefixes } from "./contextual-prefix";
import { embedBatch, toVectorLiteral } from "./embed";
import { extractClaims } from "./claim-extract";
import { classifyRelevance } from "./relevance";

/** Below this, we skip chunk/embed/claim and return {skipped:true,reason:"irrelevant"}. */
const RELEVANCE_THRESHOLD = 0.35;

/**
 * Source systems that are ALWAYS relevant — they're already political by
 * construction, don't pay for a classification pass. Add new ones as we wire
 * scrapers that are inherently on-topic.
 */
const BYPASS_RELEVANCE = new Set([
  "fec",
  "la_ethics",
  "la_ethics_bootstrap",
  "legiscan",
  "nola_council",
  "courtlistener",
  "fb_ads",
  "ballotpedia",
  "wikipedia_elections",
  // Curated LA-political RSS outlets — hand-picked in pipelines/scrapers/nola-news-rss
  "louisiana_illuminator",
  "the_lens_nola",
  "verite_news",
  "nola_com",
  "gambit",
  "wwno",
  "louisiana_weekly",
  "bayoubrief",
]);

export interface IngestInput {
  sourceUrl: string;
  sourceSystem: string;
  docType:
    | "pdf"
    | "html"
    | "video"
    | "transcript"
    | "social_post"
    | "hearing_transcript"
    | "rss_article";
  title?: string;
  publishedAt?: Date;
  /** Binary payload for PDFs / images. */
  buffer?: Buffer;
  /** Plain text payload for articles / social posts. */
  textContent?: string;
  metadata?: Record<string, unknown>;
  /** Override relevance filtering (default false — relevance IS checked). */
  skipRelevanceCheck?: boolean;
}

export interface IngestResult {
  documentId: string | null; // null when rejected by relevance filter
  skipped: boolean;
  chunkCount: number;
  claimCount: number;
  /** "dedupe" | "too_short" | "irrelevant" | "ingested" */
  reason?: string;
  relevanceScore?: number;
}

export async function ingestDocument(input: IngestInput): Promise<IngestResult> {
  const hashInput = input.buffer ?? input.textContent ?? "";
  const hash = contentHash(hashInput);

  // 1. Dedupe
  const existing = await prisma.document.findUnique({
    where: { hash },
    select: { id: true },
  });
  if (existing) {
    return {
      documentId: existing.id,
      skipped: true,
      chunkCount: 0,
      claimCount: 0,
      reason: "dedupe",
    };
  }

  // 1.5. Relevance gate. Skip cheap-to-classify docs that aren't political
  // or policy-related. Source systems in BYPASS_RELEVANCE are always kept.
  if (
    !input.skipRelevanceCheck &&
    !BYPASS_RELEVANCE.has(input.sourceSystem) &&
    input.textContent &&
    input.textContent.length > 200
  ) {
    try {
      const rel = await classifyRelevance(
        input.title ?? "",
        input.textContent.slice(0, 1500)
      );
      if (rel.score < RELEVANCE_THRESHOLD) {
        return {
          documentId: null,
          skipped: true,
          chunkCount: 0,
          claimCount: 0,
          reason: "irrelevant",
          relevanceScore: rel.score,
        };
      }
    } catch (err) {
      // On classifier failure, err on the side of ingesting — we don't want
      // to silently drop real content because Haiku hiccupped.
      console.warn(
        "[ingest] relevance classifier failed, defaulting to ingest:",
        err instanceof Error ? err.message : err
      );
    }
  }

  // 2. Wayback (best effort; non-blocking)
  const archivedUrl = await savePageNow(input.sourceUrl).catch(() => null);

  // 3. GCS raw save (only for binary inputs)
  let gcsPath: string | undefined;
  if (input.buffer) {
    const ext = input.docType === "pdf" ? "pdf" : "bin";
    const path = rawPath(input.sourceSystem, new Date(), hash, ext);
    gcsPath = await saveBuffer(path, input.buffer, {
      contentType: input.docType === "pdf" ? "application/pdf" : undefined,
    });
  }

  // 4. Extract text
  let textContent = input.textContent ?? "";
  if (!textContent && input.buffer && input.docType === "pdf") {
    const ocrResult = await ocrPdf(input.buffer, { hash, gcsPath });
    textContent = ocrResult.text;
  }

  // 5. Chunk + embed FIRST so we can reject before committing a Document row.
  //    (Prevents orphan Documents when the embed service is down or when
  //    the Haiku contextual-prefix / embedding call fails mid-flight.)
  const chunks =
    textContent && textContent.length >= 50
      ? chunkText(textContent, { targetTokens: 800, overlapTokens: 100 })
      : [];

  let prefixes: string[] = [];
  let embeddings: number[][] = [];
  if (chunks.length > 0) {
    prefixes = await generateContextualPrefixes({
      documentText: textContent,
      chunks: chunks.map((c) => c.text),
    });
    embeddings = await embedBatch(
      chunks.map((c, i) => `${prefixes[i]} ${c.text}`)
    );
  }

  // 6. Commit Document + chunks together. If either the Document insert
  //    or any chunk insert fails, the transaction rolls back and we leave
  //    no orphans behind.
  const documentId = await prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        sourceUrl: input.sourceUrl,
        archivedUrl,
        gcsPath,
        docType: input.docType,
        title: input.title,
        publishedAt: input.publishedAt,
        sourceSystem: input.sourceSystem,
        hash,
        textContent,
        metadata: input.metadata as object | undefined,
      },
      select: { id: true },
    });

    for (let i = 0; i < chunks.length; i++) {
      const row = await tx.documentChunk.create({
        data: {
          documentId: document.id,
          chunkIndex: i,
          text: chunks[i].text,
          contextPrefix: prefixes[i] ?? "",
          pageNumber: chunks[i].pageNumber,
          charStart: chunks[i].charStart,
          charEnd: chunks[i].charEnd,
        },
        select: { id: true },
      });
      const vectorLiteral = toVectorLiteral(embeddings[i]);
      await tx.$executeRaw`
        UPDATE "DocumentChunk"
        SET embedding = ${vectorLiteral}::vector
        WHERE id = ${row.id}
      `;
    }

    return document.id;
  });

  // 7. Claim extraction runs AFTER the transaction commits. Claims that
  //    fail to extract don't block the Document/chunks from being saved.
  const claimCount =
    chunks.length > 0
      ? await extractClaims({ documentId, chunks }).catch((err) => {
          console.error(`[ingest] claim extraction failed for ${documentId}:`, err);
          return 0;
        })
      : 0;

  return {
    documentId,
    skipped: false,
    chunkCount: chunks.length,
    claimCount,
  };
}

