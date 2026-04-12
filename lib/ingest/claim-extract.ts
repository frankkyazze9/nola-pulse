/**
 * Structured claim extraction from DocumentChunks.
 *
 * For each chunk, ask Haiku to extract {subject, predicate, objectText,
 * confidence} tuples. Only claims above the confidence threshold are
 * persisted. Each claim links back to the source document + chunk span so
 * the brain can cite it precisely later.
 */

import { prisma } from "../db";
import { callClaude } from "../claude/spend";
import type { Chunk } from "./chunk";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_MIN_CONFIDENCE = 0.7;

interface ExtractedClaim {
  subject: string;
  predicate: string;
  objectText: string;
  confidence: number;
}

export async function extractClaims(params: {
  documentId: string;
  chunks: Chunk[];
  minConfidence?: number;
}): Promise<number> {
  const minConfidence = params.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
  let totalSaved = 0;

  for (const chunk of params.chunks) {
    const response = await callClaude({
      operation: "ingest_claim_extract",
      params: {
        model: HAIKU_MODEL,
        max_tokens: 1500,
        system: [
          {
            type: "text",
            text:
              "Extract structured factual claims from the chunk. Each claim has: " +
              "subject (person or org name), predicate (short relation like " +
              "'holds_office' / 'donated_to' / 'was_charged_with' / 'voted_for' / " +
              "'employed_by' / 'owns'), objectText (the target as stated), " +
              "confidence (0..1). Focus on political figures, elections, donations, " +
              "court cases, public statements, voting records, and professional " +
              "relationships. Skip anything below 0.7 confidence. " +
              "Respond with JSON only: " +
              '{"claims":[{"subject":"...","predicate":"...","objectText":"...","confidence":0.9}]}',
          },
        ],
        messages: [
          {
            role: "user",
            content: chunk.text,
          },
        ],
      },
    });

    const textBlock = response.content.find((c) => c.type === "text");
    const rawText = textBlock && "text" in textBlock ? textBlock.text : "";

    let parsed: { claims?: ExtractedClaim[] };
    try {
      // Tolerate fenced code blocks in Haiku output.
      const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
      parsed = JSON.parse(cleaned);
    } catch {
      continue;
    }

    for (const claim of parsed.claims ?? []) {
      if (!claim || claim.confidence < minConfidence) continue;

      // Best-effort subject resolution to an existing Person by surname or alias.
      // Proper entity linking happens in the Phase 5 Splink job; this is a
      // cheap pre-link while ingesting.
      const subject = await prisma.person.findFirst({
        where: {
          OR: [
            { familyName: { equals: claim.subject, mode: "insensitive" } },
            { aliases: { has: claim.subject } },
          ],
        },
        select: { id: true },
      });

      await prisma.claim.create({
        data: {
          subjectPersonId: subject?.id,
          predicate: claim.predicate,
          objectText: claim.objectText,
          confidence: claim.confidence,
          sourceDocumentId: params.documentId,
          charStart: chunk.charStart,
          charEnd: chunk.charEnd,
        },
      });
      totalSaved++;
    }
  }

  return totalSaved;
}
