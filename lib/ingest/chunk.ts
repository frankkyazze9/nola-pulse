/**
 * Sentence-aware chunking. Splits text at sentence boundaries, targeting
 * ~800 tokens per chunk with 100-token overlap. Rough — real semantic
 * chunking would embed first and split on similarity drops — but this is
 * a solid baseline for Dark Horse's document corpus.
 */

export interface ChunkOptions {
  targetTokens: number;
  overlapTokens: number;
}

export interface Chunk {
  text: string;
  charStart: number;
  charEnd: number;
  pageNumber?: number;
}

// Rough English token-to-character ratio.
const CHARS_PER_TOKEN = 4;

export function chunkText(text: string, opts: ChunkOptions): Chunk[] {
  if (!text || text.length === 0) return [];

  const targetChars = opts.targetTokens * CHARS_PER_TOKEN;
  const overlapChars = opts.overlapTokens * CHARS_PER_TOKEN;

  const sentences: Array<{ text: string; start: number; end: number }> = [];
  const sentenceRegex = /[^.!?\n]+[.!?\n]+\s*/g;
  let match: RegExpExecArray | null;
  while ((match = sentenceRegex.exec(text)) !== null) {
    sentences.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  if (sentences.length === 0) {
    return [{ text, charStart: 0, charEnd: text.length }];
  }

  const chunks: Chunk[] = [];
  let buffer = "";
  let bufferStart = sentences[0].start;

  for (const sent of sentences) {
    if (buffer.length + sent.text.length > targetChars && buffer.length > 0) {
      chunks.push({
        text: buffer.trim(),
        charStart: bufferStart,
        charEnd: bufferStart + buffer.length,
      });
      // Start next chunk with tail overlap from the previous buffer.
      const overlapStart = Math.max(0, buffer.length - overlapChars);
      buffer = buffer.slice(overlapStart);
      bufferStart = bufferStart + overlapStart;
    }
    buffer += sent.text;
  }

  if (buffer.trim().length > 0) {
    chunks.push({
      text: buffer.trim(),
      charStart: bufferStart,
      charEnd: bufferStart + buffer.length,
    });
  }

  return chunks;
}
