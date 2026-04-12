/**
 * Anthropic-style contextual retrieval prefix generation.
 *
 * For each chunk, call Haiku with the full document text as a CACHED prefix
 * and ask for a 1-2 sentence contextual prefix situating the chunk. The
 * document-level cache keeps per-chunk cost near-zero because cache reads
 * are billed at ~10% of input price.
 *
 * See https://www.anthropic.com/news/contextual-retrieval
 */

import { callClaude } from "../claude/spend";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 120;

export async function generateContextualPrefixes(params: {
  documentText: string;
  chunks: string[];
}): Promise<string[]> {
  const prefixes: string[] = [];

  for (const chunk of params.chunks) {
    const response = await callClaude({
      operation: "ingest_contextual_prefix",
      params: {
        model: HAIKU_MODEL,
        max_tokens: MAX_TOKENS,
        system: [
          {
            type: "text",
            text:
              "You generate contextual prefixes for retrieval chunks. Given the " +
              "full document below and a specific chunk, produce a 1-2 sentence " +
              "prefix that situates the chunk in the broader document. State the " +
              "section and subject concisely. No preamble, no fluff.\n\n" +
              "FULL DOCUMENT:\n" +
              params.documentText,
            // Cache the full document so we only pay for it once per document
            // even when generating prefixes for every chunk.
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: `Contextual prefix for this chunk:\n\n${chunk}`,
          },
        ],
      },
    });

    const textBlock = response.content.find((c) => c.type === "text");
    prefixes.push(textBlock && "text" in textBlock ? textBlock.text.trim() : "");
  }

  return prefixes;
}
