/**
 * Google Document AI OCR wrapper with GCS-backed caching.
 *
 * OCR output is cached by content hash at gs://${GCS_BUCKET}/processed/<hash>.txt
 * so re-ingesting a byte-identical document returns cached text without
 * re-OCR'ing (which would re-spend on Document AI).
 */

import { fileExists, processedPath, readText, saveText } from "../gcs";
import { logSpend } from "../spend";

const PROCESSOR_NAME = process.env.DOCUMENT_AI_PROCESSOR_ID;
const PROJECT_ID = process.env.GCP_PROJECT_ID;

export interface OcrResult {
  text: string;
  pageCount: number;
  cached: boolean;
}

export async function ocrPdf(
  buffer: Buffer,
  opts: { hash: string; gcsPath?: string }
): Promise<OcrResult> {
  const cachePath = processedPath(opts.hash, "txt");
  if (await fileExists(cachePath)) {
    const text = await readText(cachePath);
    return { text, pageCount: 0, cached: true };
  }

  if (!PROCESSOR_NAME || !PROJECT_ID) {
    throw new Error(
      "DOCUMENT_AI_PROCESSOR_ID / GCP_PROJECT_ID not set. Create the processor via `gcloud documentai processors create` (see docs/deploy.md)."
    );
  }

  // Lazy import so this module loads during local dev even when the
  // @google-cloud/documentai package isn't installed yet.
  const { DocumentProcessorServiceClient } = await import("@google-cloud/documentai");
  const client = new DocumentProcessorServiceClient();

  const [result] = await client.processDocument({
    name: PROCESSOR_NAME,
    rawDocument: {
      content: buffer.toString("base64"),
      mimeType: "application/pdf",
    },
  });

  const text = result.document?.text ?? "";
  const pageCount = result.document?.pages?.length ?? 0;

  await saveText(cachePath, text);

  await logSpend({
    service: "documentai",
    operation: "ocr_pdf",
    usage: { pagesProcessed: pageCount },
    metadata: { hash: opts.hash, gcsPath: opts.gcsPath },
  });

  return { text, pageCount, cached: false };
}
