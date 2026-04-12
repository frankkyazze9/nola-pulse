/**
 * Google Cloud Storage wrapper for Dark Horse's document and raw-scrape data.
 *
 * All raw scraper output lands in gs://${GCS_BUCKET}/raw/<sourceSystem>/<date>/
 * All processed documents (OCR text, chunked JSON) land in gs://${GCS_BUCKET}/processed/
 */

import { Storage } from "@google-cloud/storage";

const BUCKET_NAME = process.env.GCS_BUCKET ?? "dark-horse-docs";

const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
});

export const bucket = storage.bucket(BUCKET_NAME);

/**
 * Save a buffer to GCS and return the gs:// URI.
 */
export async function saveBuffer(
  path: string,
  buffer: Buffer,
  options: { contentType?: string } = {}
): Promise<string> {
  const file = bucket.file(path);
  await file.save(buffer, {
    contentType: options.contentType ?? "application/octet-stream",
    resumable: false,
  });
  return `gs://${BUCKET_NAME}/${path}`;
}

export async function saveText(
  path: string,
  text: string,
  contentType = "text/plain"
): Promise<string> {
  return saveBuffer(path, Buffer.from(text, "utf8"), { contentType });
}

export async function saveJson(path: string, data: unknown): Promise<string> {
  return saveText(path, JSON.stringify(data, null, 2), "application/json");
}

export async function readText(path: string): Promise<string> {
  const [content] = await bucket.file(path).download();
  return content.toString("utf8");
}

export async function fileExists(path: string): Promise<boolean> {
  const [exists] = await bucket.file(path).exists();
  return exists;
}

/**
 * Canonical path for a raw scrape artifact.
 *
 *   rawPath("fec", new Date("2026-04-11"), "abc123", "json")
 *     -> "raw/fec/2026-04-11/abc123.json"
 */
export function rawPath(
  sourceSystem: string,
  date: Date,
  hash: string,
  ext: string
): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `raw/${sourceSystem}/${yyyy}-${mm}-${dd}/${hash}.${ext}`;
}

/**
 * Canonical path for a processed document (e.g. cached OCR output).
 */
export function processedPath(hash: string, ext: string): string {
  return `processed/${hash}.${ext}`;
}
