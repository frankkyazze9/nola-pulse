/**
 * Socrata Open Data API Helper
 *
 * data.nola.gov is powered by Socrata. All datasets have a REST API
 * that supports SoQL queries. No authentication required for public data.
 *
 * Usage:
 *   const client = new SocrataClient();
 *   const results = await client.query("2jgv-pqrq", {
 *     where: "request_type = 'Pothole/Roadway Surface Defect'",
 *     order: "date_created DESC",
 *     limit: 1000,
 *   });
 */

const BASE_URL = "https://data.nola.gov/resource";

export interface SocrataQuery {
  select?: string;
  where?: string;
  order?: string;
  group?: string;
  limit?: number;
  offset?: number;
  q?: string; // full-text search
}

export class SocrataClient {
  private appToken?: string;

  constructor(appToken?: string) {
    this.appToken = appToken || process.env.SOCRATA_APP_TOKEN;
  }

  async query<T = Record<string, unknown>>(
    datasetId: string,
    params: SocrataQuery = {}
  ): Promise<T[]> {
    const url = new URL(`${BASE_URL}/${datasetId}.json`);

    if (params.select) url.searchParams.set("$select", params.select);
    if (params.where) url.searchParams.set("$where", params.where);
    if (params.order) url.searchParams.set("$order", params.order);
    if (params.group) url.searchParams.set("$group", params.group);
    if (params.q) url.searchParams.set("$q", params.q);
    url.searchParams.set("$limit", String(params.limit || 1000));
    if (params.offset) url.searchParams.set("$offset", String(params.offset));

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (this.appToken) {
      headers["X-App-Token"] = this.appToken;
    }

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      throw new Error(
        `Socrata API error: ${response.status} ${response.statusText} for ${datasetId}`
      );
    }

    return response.json() as Promise<T[]>;
  }

  async count(datasetId: string, where?: string): Promise<number> {
    const result = await this.query<{ count: string }>(datasetId, {
      select: "count(*) as count",
      where,
    });
    return parseInt(result[0]?.count || "0", 10);
  }

  /**
   * Paginate through all records matching a query.
   * Yields batches of records.
   */
  async *paginate<T = Record<string, unknown>>(
    datasetId: string,
    params: Omit<SocrataQuery, "offset" | "limit"> = {},
    batchSize = 1000
  ): AsyncGenerator<T[]> {
    let offset = 0;
    while (true) {
      const batch = await this.query<T>(datasetId, {
        ...params,
        limit: batchSize,
        offset,
      });
      if (batch.length === 0) break;
      yield batch;
      if (batch.length < batchSize) break;
      offset += batchSize;
    }
  }
}

/**
 * Known dataset IDs on data.nola.gov
 */
export const DATASETS = {
  // 311 Service Requests
  CALLS_311: "2jgv-pqrq",
  CALLS_311_HISTORIC: "3iz8-nghx",

  // Short-Term Rentals
  STR_ACTIVE: "ufdg-ajws",
  STR_APPLICATIONS: "en36-xvxg",
  STR_NON_COMMERCIAL: "2ei9-wqw2",

  // Permits & Demolitions
  PERMITS: "rcm3-fn58",
  DEMOLITIONS: "e3wd-h7q2",
  BUILDING_PERMITS_2018: "nbcf-m6c2",

  // Code Enforcement / Blight
  BLIGHT_CASES: "u6yx-v2tw",
  BLIGHT_VIOLATIONS: "3ehi-je3s",
  BLIGHT_INSPECTIONS: "uh5a-f7uw",
  BLIGHT_HEARINGS: "44ct-56tr",

  // Crime
  POLICE_REPORTS_2025: "agqi-9adb",
  POLICE_REPORTS_2024: "c5iy-ew8n",
  POLICE_REPORTS_2023: "j3gz-62a2",
  CALLS_FOR_SERVICE_2026: "es9j-6y5d",
  CALLS_FOR_SERVICE_2025: "4xwx-sfte",
  USE_OF_FORCE: "9mnw-mbde",

  // Budget & Finance
  SALES_TAX_REVENUE: "qx7d-6vrr",
  EMPLOYEE_SALARIES: "ewni-nsbu",
  BUSINESS_LICENSES: "abc4-h3u3",

  // Property
  PARCELS: "v9q5-fz7t",

  // Council
  COUNCIL_DISTRICTS: "d49t-wy6p",
  COUNCIL_DEMOGRAPHICS: "ti3t-pm8k",

  // Meta
  DATASET_INVENTORY: "r6b2-hfba",
} as const;
