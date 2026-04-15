#!/usr/bin/env tsx
/**
 * Seed the May 12, 2026 Orleans Parish election shell.
 *
 * Creates the Election row. Candidates populated separately — either by
 * running the Ballotpedia scraper and letting the brain extract, or by
 * asking the agent to register them from known coverage.
 *
 * Run: `tsx scripts/seed-may-2026-election.ts`
 */

import { prisma } from "../lib/db";

const NEW_ORLEANS_OCD = "ocd-division/country:us/state:la/place:new_orleans";
const ORLEANS_PARISH_OCD = "ocd-division/country:us/state:la/county:orleans";
const LOUISIANA_OCD = "ocd-division/country:us/state:la";

async function main(): Promise<void> {
  // Find the best jurisdiction for this election. Prefer New Orleans place,
  // fall back to Orleans Parish, then Louisiana.
  const candidates = [NEW_ORLEANS_OCD, ORLEANS_PARISH_OCD, LOUISIANA_OCD];
  let jurisdiction = null;
  for (const ocdId of candidates) {
    jurisdiction = await prisma.jurisdiction.findUnique({ where: { ocdId } });
    if (jurisdiction) break;
  }
  if (!jurisdiction) {
    throw new Error(
      "No LA/Orleans/NOLA jurisdiction seeded. Run `npx prisma db seed` first."
    );
  }

  const date = new Date("2026-05-16T00:00:00Z");
  const ocdId = `${jurisdiction.ocdId}/election:2026-05-16`;

  // Idempotent — upsert by OCD election ID
  const existing = await prisma.election.findUnique({ where: { ocdId } });
  if (existing) {
    console.log(
      `Election already exists: ${existing.id} (${jurisdiction.name}, ${date.toISOString().slice(0, 10)})`
    );
    return;
  }

  const election = await prisma.election.create({
    data: {
      date,
      jurisdictionId: jurisdiction.id,
      electionType: "primary",
      ocdId,
    },
  });

  console.log(
    `Created election: ${election.id}\n` +
      `  Jurisdiction: ${jurisdiction.name} (${jurisdiction.ocdId})\n` +
      `  Date: ${election.date.toISOString().slice(0, 10)}\n` +
      `  Type: ${election.electionType}\n` +
      `  OCD: ${election.ocdId}\n\n` +
      `Next: run the Ballotpedia scraper and ask the agent to register candidates:\n` +
      `  POST /api/jobs/scrape/ballotpedia\n`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
