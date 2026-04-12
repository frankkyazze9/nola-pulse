/**
 * Open Civic Data ID helpers.
 *
 * OCD-IDs are stable canonical identifiers for jurisdictions, offices, and
 * elected positions. See https://github.com/opencivicdata/ocd-division-ids
 *
 * Examples:
 *   ocd-division/country:us/state:la
 *   ocd-division/country:us/state:la/place:new_orleans
 *   ocd-post/country:us/state:la/place:new_orleans/mayor
 */

export type OcdType = "division" | "post" | "person";

export interface OcdParts {
  type: OcdType;
  segments: Record<string, string>;
}

/**
 * Build an ocd-division ID from a hierarchy of key/value segments.
 * Order matters: country → state → county → place → court.
 */
export function jurisdictionOcdId(parts: {
  country?: string;
  state?: string;
  county?: string;
  place?: string;
  court?: string;
}): string {
  const segments: string[] = [];
  if (parts.country) segments.push(`country:${parts.country}`);
  if (parts.state) segments.push(`state:${parts.state}`);
  if (parts.county) segments.push(`county:${parts.county}`);
  if (parts.place) segments.push(`place:${parts.place}`);
  if (parts.court) segments.push(`court:${parts.court}`);
  return `ocd-division/${segments.join("/")}`;
}

/**
 * Turn an ocd-division ID into an ocd-post ID with a slug suffix.
 *
 *   postOcdId("ocd-division/country:us/state:la/place:new_orleans", "mayor")
 *     -> "ocd-post/country:us/state:la/place:new_orleans/mayor"
 */
export function postOcdId(divisionOcdId: string, postSlug: string): string {
  const base = divisionOcdId.replace(/^ocd-division\//, "ocd-post/");
  return `${base}/${postSlug}`;
}

/**
 * Parse an OCD-ID into its type and key/value segments. Returns
 * `{ type: "unknown", segments: {} }` if the string isn't a valid OCD-ID.
 */
export function parseOcdId(ocdId: string): OcdParts | { type: "unknown"; segments: Record<string, string> } {
  const match = ocdId.match(/^ocd-(division|post|person)\/(.+)$/);
  if (!match) return { type: "unknown", segments: {} };
  const [, type, rest] = match;
  const segments: Record<string, string> = {};
  for (const pair of rest.split("/")) {
    const [k, v] = pair.split(":");
    if (k && v) segments[k] = v;
  }
  return { type: type as OcdType, segments };
}

/**
 * Canonical OCD-IDs for Louisiana / New Orleans, used throughout Dark Horse
 * so scraper code doesn't have to reconstruct them.
 */
export const LA_OCD = {
  state: jurisdictionOcdId({ country: "us", state: "la" }),
  orleansParish: jurisdictionOcdId({ country: "us", state: "la", county: "orleans" }),
  newOrleans: jurisdictionOcdId({ country: "us", state: "la", place: "new_orleans" }),
  orleansCivilCourt: jurisdictionOcdId({
    country: "us",
    state: "la",
    county: "orleans",
    court: "civil_district",
  }),
  orleansCriminalCourt: jurisdictionOcdId({
    country: "us",
    state: "la",
    county: "orleans",
    court: "criminal_district",
  }),
  laSupremeCourt: jurisdictionOcdId({ country: "us", state: "la", court: "supreme" }),
  la4thCircuit: jurisdictionOcdId({
    country: "us",
    state: "la",
    court: "appeal_4th_circuit",
  }),
} as const;
