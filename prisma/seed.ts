/**
 * Dark Horse seed data.
 *
 * Loads Louisiana jurisdictions (Open Civic Data IDs) and the Posts Dark Horse
 * tracks for opposition research. Idempotent — safe to re-run.
 *
 * Run: `npx prisma db seed`
 */

import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type JurisdictionSeed = {
  ocdId: string;
  name: string;
  jurisdictionType: "state" | "parish" | "municipality" | "court_district";
  parentOcdId?: string;
};

type PostSeed = {
  ocdId?: string;
  jurisdictionOcdId: string;
  label: string;
  postType: "executive" | "legislative" | "judicial" | "law_enforcement";
};

// -- Jurisdictions ----------------------------------------------------------

const JURISDICTIONS: JurisdictionSeed[] = [
  // State
  {
    ocdId: "ocd-division/country:us/state:la",
    name: "Louisiana",
    jurisdictionType: "state",
  },
  // Orleans Parish
  {
    ocdId: "ocd-division/country:us/state:la/county:orleans",
    name: "Orleans Parish",
    jurisdictionType: "parish",
    parentOcdId: "ocd-division/country:us/state:la",
  },
  // City of New Orleans
  {
    ocdId: "ocd-division/country:us/state:la/place:new_orleans",
    name: "New Orleans",
    jurisdictionType: "municipality",
    parentOcdId: "ocd-division/country:us/state:la/county:orleans",
  },
  // Orleans Parish courts
  {
    ocdId: "ocd-division/country:us/state:la/county:orleans/court:civil_district",
    name: "Orleans Parish Civil District Court",
    jurisdictionType: "court_district",
    parentOcdId: "ocd-division/country:us/state:la/county:orleans",
  },
  {
    ocdId: "ocd-division/country:us/state:la/county:orleans/court:criminal_district",
    name: "Orleans Parish Criminal District Court",
    jurisdictionType: "court_district",
    parentOcdId: "ocd-division/country:us/state:la/county:orleans",
  },
  // State courts
  {
    ocdId: "ocd-division/country:us/state:la/court:supreme",
    name: "Louisiana Supreme Court",
    jurisdictionType: "court_district",
    parentOcdId: "ocd-division/country:us/state:la",
  },
  {
    ocdId: "ocd-division/country:us/state:la/court:appeal_4th_circuit",
    name: "Louisiana 4th Circuit Court of Appeal",
    jurisdictionType: "court_district",
    parentOcdId: "ocd-division/country:us/state:la",
  },
];

// -- Posts ------------------------------------------------------------------

const POSTS: PostSeed[] = [
  // New Orleans executive
  {
    ocdId: "ocd-post/country:us/state:la/place:new_orleans/mayor",
    jurisdictionOcdId: "ocd-division/country:us/state:la/place:new_orleans",
    label: "Mayor of New Orleans",
    postType: "executive",
  },
  // New Orleans City Council
  ...["a", "b", "c", "d", "e"].map(
    (district): PostSeed => ({
      ocdId: `ocd-post/country:us/state:la/place:new_orleans/council/district:${district}`,
      jurisdictionOcdId: "ocd-division/country:us/state:la/place:new_orleans",
      label: `New Orleans City Council District ${district.toUpperCase()}`,
      postType: "legislative",
    })
  ),
  {
    ocdId: "ocd-post/country:us/state:la/place:new_orleans/council/at_large:1",
    jurisdictionOcdId: "ocd-division/country:us/state:la/place:new_orleans",
    label: "New Orleans City Council At-Large Division 1",
    postType: "legislative",
  },
  {
    ocdId: "ocd-post/country:us/state:la/place:new_orleans/council/at_large:2",
    jurisdictionOcdId: "ocd-division/country:us/state:la/place:new_orleans",
    label: "New Orleans City Council At-Large Division 2",
    postType: "legislative",
  },
  // Orleans Parish law enforcement / executive
  {
    ocdId: "ocd-post/country:us/state:la/county:orleans/da",
    jurisdictionOcdId: "ocd-division/country:us/state:la/county:orleans",
    label: "Orleans Parish District Attorney",
    postType: "law_enforcement",
  },
  {
    ocdId: "ocd-post/country:us/state:la/county:orleans/sheriff",
    jurisdictionOcdId: "ocd-division/country:us/state:la/county:orleans",
    label: "Orleans Parish Sheriff",
    postType: "law_enforcement",
  },
  {
    ocdId: "ocd-post/country:us/state:la/county:orleans/clerk_criminal",
    jurisdictionOcdId: "ocd-division/country:us/state:la/county:orleans",
    label: "Orleans Parish Clerk of Criminal District Court",
    postType: "law_enforcement",
  },
  {
    ocdId: "ocd-post/country:us/state:la/county:orleans/clerk_civil",
    jurisdictionOcdId: "ocd-division/country:us/state:la/county:orleans",
    label: "Orleans Parish Clerk of Civil District Court",
    postType: "law_enforcement",
  },
  {
    ocdId: "ocd-post/country:us/state:la/county:orleans/assessor",
    jurisdictionOcdId: "ocd-division/country:us/state:la/county:orleans",
    label: "Orleans Parish Assessor",
    postType: "executive",
  },
  // Orleans Parish Criminal District Court judges (sections A–M)
  ...["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"].map(
    (section): PostSeed => ({
      ocdId: `ocd-post/country:us/state:la/county:orleans/court:criminal_district/section:${section.toLowerCase()}`,
      jurisdictionOcdId:
        "ocd-division/country:us/state:la/county:orleans/court:criminal_district",
      label: `Orleans Parish Criminal District Court Judge, Section ${section}`,
      postType: "judicial",
    })
  ),
  // Orleans Parish Civil District Court judges (divisions A–N)
  ...["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"].map(
    (division): PostSeed => ({
      ocdId: `ocd-post/country:us/state:la/county:orleans/court:civil_district/division:${division.toLowerCase()}`,
      jurisdictionOcdId:
        "ocd-division/country:us/state:la/county:orleans/court:civil_district",
      label: `Orleans Parish Civil District Court Judge, Division ${division}`,
      postType: "judicial",
    })
  ),
  // LA Supreme Court (Districts 1–7)
  ...[1, 2, 3, 4, 5, 6, 7].map(
    (district): PostSeed => ({
      ocdId: `ocd-post/country:us/state:la/court:supreme/district:${district}`,
      jurisdictionOcdId: "ocd-division/country:us/state:la/court:supreme",
      label: `Louisiana Supreme Court Justice, District ${district}`,
      postType: "judicial",
    })
  ),
  // LA 4th Circuit Court of Appeal (covers Orleans, Plaquemines, St. Bernard) — divisions A–L
  ...["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"].map(
    (division): PostSeed => ({
      ocdId: `ocd-post/country:us/state:la/court:appeal_4th_circuit/division:${division.toLowerCase()}`,
      jurisdictionOcdId: "ocd-division/country:us/state:la/court:appeal_4th_circuit",
      label: `Louisiana 4th Circuit Court of Appeal Judge, Division ${division}`,
      postType: "judicial",
    })
  ),
  // LA Senate districts overlapping Orleans (3, 4, 5, 7, 19) — adjust as needed
  ...[3, 4, 5, 7, 19].map(
    (d): PostSeed => ({
      ocdId: `ocd-post/country:us/state:la/senate/district:${d}`,
      jurisdictionOcdId: "ocd-division/country:us/state:la",
      label: `Louisiana State Senate District ${d}`,
      postType: "legislative",
    })
  ),
  // LA House districts overlapping Orleans (91, 93, 94, 97, 98, 99, 100, 102, 103) — adjust as needed
  ...[91, 93, 94, 97, 98, 99, 100, 102, 103].map(
    (d): PostSeed => ({
      ocdId: `ocd-post/country:us/state:la/house/district:${d}`,
      jurisdictionOcdId: "ocd-division/country:us/state:la",
      label: `Louisiana State House District ${d}`,
      postType: "legislative",
    })
  ),
  // US House LA-02 (covers most of Orleans)
  {
    ocdId: "ocd-post/country:us/state:la/cd:2",
    jurisdictionOcdId: "ocd-division/country:us/state:la",
    label: "U.S. House of Representatives, Louisiana District 2",
    postType: "legislative",
  },
  // Louisiana Governor
  {
    ocdId: "ocd-post/country:us/state:la/governor",
    jurisdictionOcdId: "ocd-division/country:us/state:la",
    label: "Governor of Louisiana",
    postType: "executive",
  },
  // LA Attorney General
  {
    ocdId: "ocd-post/country:us/state:la/attorney_general",
    jurisdictionOcdId: "ocd-division/country:us/state:la",
    label: "Louisiana Attorney General",
    postType: "executive",
  },
];

async function main() {
  console.log("Seeding Louisiana jurisdictions...");

  // Jurisdictions: upsert parents first, then children (two passes handles the
  // parent FK dependency even though the seed list is already ordered).
  const jurisdictionIdByOcdId = new Map<string, string>();
  for (const j of JURISDICTIONS) {
    const row = await prisma.jurisdiction.upsert({
      where: { ocdId: j.ocdId },
      create: {
        ocdId: j.ocdId,
        name: j.name,
        jurisdictionType: j.jurisdictionType,
        parentId: j.parentOcdId ? jurisdictionIdByOcdId.get(j.parentOcdId) : null,
      },
      update: {
        name: j.name,
        jurisdictionType: j.jurisdictionType,
        parentId: j.parentOcdId ? jurisdictionIdByOcdId.get(j.parentOcdId) : null,
      },
    });
    jurisdictionIdByOcdId.set(j.ocdId, row.id);
  }
  console.log(`  upserted ${JURISDICTIONS.length} jurisdictions`);

  console.log("Seeding Posts Dark Horse tracks...");
  for (const p of POSTS) {
    const jurisdictionId = jurisdictionIdByOcdId.get(p.jurisdictionOcdId);
    if (!jurisdictionId) {
      console.warn(`  skipping ${p.label}: jurisdiction ${p.jurisdictionOcdId} not found`);
      continue;
    }
    await prisma.post.upsert({
      where: p.ocdId ? { ocdId: p.ocdId } : { id: "never-matches" },
      create: {
        ocdId: p.ocdId,
        jurisdictionId,
        label: p.label,
        postType: p.postType,
      },
      update: {
        jurisdictionId,
        label: p.label,
        postType: p.postType,
      },
    });
  }
  console.log(`  upserted ${POSTS.length} posts`);

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
