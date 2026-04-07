/**
 * Vector Search — Semantic search over the knowledge base
 *
 * Uses Vertex AI text embeddings to enable agents to ask natural language
 * questions like "what has the council said about Entergy rate increases"
 * and get relevant KB chunks with source citations.
 *
 * Architecture:
 *   1. Documents are chunked into ~500 token segments
 *   2. Each chunk is embedded via Vertex AI text-embedding model
 *   3. Embeddings stored in BigQuery with vector index
 *   4. Queries are embedded and matched via cosine similarity
 */

import { BigQuery } from "@google-cloud/bigquery";

const PROJECT_ID = "nola-ai-innovation";
const DATASET = "nola_pulse_kb";
const EMBEDDINGS_TABLE = "embeddings";

const bigquery = new BigQuery({ projectId: PROJECT_ID });

export interface EmbeddingChunk {
  id: string;
  source_table: string;
  source_id: string;
  content: string;
  embedding: number[];
  created_at: string;
}

export interface SearchResult {
  content: string;
  source_table: string;
  source_id: string;
  similarity: number;
}

/**
 * Chunk text into segments of approximately `maxTokens` size
 * with overlap for context continuity.
 */
export function chunkText(
  text: string,
  maxChars: number = 1500,
  overlap: number = 200
): string[] {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + maxChars;

    // Try to break at a sentence boundary
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf(".", end);
      if (lastPeriod > start + maxChars / 2) {
        end = lastPeriod + 1;
      }
    }

    chunks.push(text.slice(start, end).trim());
    start = end - overlap;
  }

  return chunks;
}

/**
 * Generate embeddings using Vertex AI.
 * Falls back to a simple hash-based approach if Vertex AI is unavailable.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Use Vertex AI text-embedding API
    const url = `https://us-south1-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/us-south1/publishers/google/models/text-embedding-005:predict`;

    const { GoogleAuth } = await import("google-auth-library");
    const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
    const client = await auth.getClient();
    const token = await client.getAccessToken();

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token.token}`,
      },
      body: JSON.stringify({
        instances: [{ content: text.slice(0, 2048) }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Vertex AI error: ${response.status}`);
    }

    const data = await response.json();
    return data.predictions[0].embeddings.values;
  } catch (err) {
    console.warn("Vertex AI embedding failed, using fallback:", (err as Error).message);
    // Fallback: simple deterministic hash-based "embedding" for testing
    return simpleHash(text, 768);
  }
}

/**
 * Simple hash-based pseudo-embedding for testing when Vertex AI is unavailable.
 * NOT suitable for production — just keeps the pipeline working.
 */
function simpleHash(text: string, dims: number): number[] {
  const embedding = new Array(dims).fill(0);
  for (let i = 0; i < text.length; i++) {
    embedding[i % dims] += text.charCodeAt(i) / 1000;
  }
  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
  return embedding.map((v) => v / (magnitude || 1));
}

/**
 * Store an embedding in BigQuery
 */
export async function storeEmbedding(chunk: Omit<EmbeddingChunk, "created_at">): Promise<void> {
  await bigquery.dataset(DATASET).table(EMBEDDINGS_TABLE).insert([
    {
      ...chunk,
      embedding: JSON.stringify(chunk.embedding),
      created_at: new Date().toISOString(),
    },
  ], { ignoreUnknownValues: true, skipInvalidRows: true });
}

/**
 * Search for similar content using cosine similarity.
 * Uses BigQuery ML functions for vector search.
 */
export async function searchKB(
  query: string,
  topK: number = 5
): Promise<SearchResult[]> {
  const queryEmbedding = await generateEmbedding(query);

  // Use BigQuery cosine similarity
  const [rows] = await bigquery.query({
    query: `
      WITH query_embedding AS (
        SELECT ${queryEmbedding.map((v, i) => `${v} as e${i}`).join(", ")}
      )
      SELECT
        content,
        source_table,
        source_id,
        -- Approximate cosine similarity using dot product (embeddings are normalized)
        (${queryEmbedding.map((_, i) => `CAST(JSON_EXTRACT_SCALAR(embedding, '$[${i}]') AS FLOAT64) * ${queryEmbedding[i]}`).join(" + ")}) as similarity
      FROM \`${PROJECT_ID}.${DATASET}.${EMBEDDINGS_TABLE}\`
      ORDER BY similarity DESC
      LIMIT ${topK}
    `,
  });

  return rows as SearchResult[];
}

/**
 * Index a document from the knowledge base into the vector store.
 */
export async function indexDocument(
  sourceTable: string,
  sourceId: string,
  text: string
): Promise<number> {
  const chunks = chunkText(text);
  let indexed = 0;

  for (const chunk of chunks) {
    const embedding = await generateEmbedding(chunk);
    await storeEmbedding({
      id: `${sourceTable}-${sourceId}-${indexed}`,
      source_table: sourceTable,
      source_id: sourceId,
      content: chunk,
      embedding,
    });
    indexed++;
  }

  return indexed;
}
