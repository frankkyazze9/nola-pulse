/**
 * Self-hosted BGE-small-en-v1.5 embedding client.
 *
 * The dark-horse-embed Cloud Run service runs a sentence-transformers server
 * inside our VPC. Zero external API cost; only Cloud Run compute (~$2/mo
 * scaled to zero).
 */

const EMBED_URL = process.env.EMBEDDING_SERVICE_URL;
export const EMBEDDING_DIM = 384;

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (!EMBED_URL) {
    throw new Error(
      "EMBEDDING_SERVICE_URL not set. Provision the dark-horse-embed Cloud Run service first."
    );
  }
  if (texts.length === 0) return [];

  const response = await fetch(`${EMBED_URL}/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new Error(
      `dark-horse-embed error: ${response.status} ${response.statusText}`
    );
  }
  const data = (await response.json()) as { embeddings: number[][] };
  return data.embeddings;
}

export async function embedSingle(text: string): Promise<number[]> {
  const [embedding] = await embedBatch([text]);
  return embedding;
}

/** Convert an embedding array into a pgvector literal for raw SQL. */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
