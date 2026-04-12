import { createHash } from "crypto";

/**
 * SHA-256 content hash used as the `Document.hash` dedupe key. Re-ingesting a
 * byte-identical document returns the existing row instead of re-OCR'ing.
 */
export function contentHash(input: string | Buffer): string {
  const h = createHash("sha256");
  h.update(typeof input === "string" ? Buffer.from(input, "utf8") : input);
  return h.digest("hex");
}
