import { BigQuery } from "@google-cloud/bigquery";

const globalForBQ = globalThis as unknown as {
  bigquery: BigQuery | undefined;
};

export const bigquery =
  globalForBQ.bigquery ??
  new BigQuery({ projectId: "nola-ai-innovation" });

if (process.env.NODE_ENV !== "production") globalForBQ.bigquery = bigquery;

const DATASET = "nola_pulse_kb";

export async function queryKB<T = Record<string, unknown>>(
  sql: string
): Promise<T[]> {
  const [rows] = await bigquery.query({ query: sql });
  return rows as T[];
}

export { DATASET };
