/**
 * FollowTheMoney-style entity upsert helpers.
 *
 * These are the canonical way for scrapers and the document pipeline to write
 * rows to the knowledge graph. They deduplicate by known identifiers (FEC ID,
 * LA Ethics ID, EIN, OCD-ID, Wikidata QID) before creating new rows, merging
 * aliases when an update hits an existing entity.
 *
 * Scrapers should almost never call `prisma.person.create` directly — use
 * `upsertPerson` so cross-source deduplication works correctly.
 */

import { prisma } from "./db";

export interface PersonUpsert {
  ocdId?: string;
  wikidataQid?: string;
  fecCandidateId?: string;
  laEthicsId?: string;
  givenName: string;
  middleName?: string;
  familyName: string;
  suffix?: string;
  aliases?: string[];
  dateOfBirth?: Date;
  party?: string;
  bio?: string;
}

export async function upsertPerson(data: PersonUpsert): Promise<{ id: string }> {
  const existing =
    (data.wikidataQid &&
      (await prisma.person.findUnique({ where: { wikidataQid: data.wikidataQid } }))) ||
    (data.fecCandidateId &&
      (await prisma.person.findUnique({ where: { fecCandidateId: data.fecCandidateId } }))) ||
    (data.laEthicsId &&
      (await prisma.person.findUnique({ where: { laEthicsId: data.laEthicsId } }))) ||
    (data.ocdId && (await prisma.person.findUnique({ where: { ocdId: data.ocdId } })));

  if (existing) {
    return prisma.person.update({
      where: { id: existing.id },
      data: {
        ocdId: data.ocdId ?? existing.ocdId,
        wikidataQid: data.wikidataQid ?? existing.wikidataQid,
        fecCandidateId: data.fecCandidateId ?? existing.fecCandidateId,
        laEthicsId: data.laEthicsId ?? existing.laEthicsId,
        givenName: data.givenName,
        middleName: data.middleName ?? existing.middleName,
        familyName: data.familyName,
        suffix: data.suffix ?? existing.suffix,
        aliases: mergeAliases(existing.aliases, data.aliases),
        dateOfBirth: data.dateOfBirth ?? existing.dateOfBirth,
        party: data.party ?? existing.party,
        bio: data.bio ?? existing.bio,
      },
      select: { id: true },
    });
  }

  return prisma.person.create({
    data: {
      ocdId: data.ocdId,
      wikidataQid: data.wikidataQid,
      fecCandidateId: data.fecCandidateId,
      laEthicsId: data.laEthicsId,
      givenName: data.givenName,
      middleName: data.middleName,
      familyName: data.familyName,
      suffix: data.suffix,
      aliases: data.aliases ?? [],
      dateOfBirth: data.dateOfBirth,
      party: data.party,
      bio: data.bio,
    },
    select: { id: true },
  });
}

export interface OrganizationUpsert {
  ocdId?: string;
  wikidataQid?: string;
  fecCommitteeId?: string;
  einNumber?: string;
  name: string;
  aliases?: string[];
  orgType: string;
  website?: string;
}

export async function upsertOrganization(
  data: OrganizationUpsert
): Promise<{ id: string }> {
  const existing =
    (data.wikidataQid &&
      (await prisma.organization.findUnique({ where: { wikidataQid: data.wikidataQid } }))) ||
    (data.fecCommitteeId &&
      (await prisma.organization.findUnique({
        where: { fecCommitteeId: data.fecCommitteeId },
      }))) ||
    (data.einNumber &&
      (await prisma.organization.findUnique({ where: { einNumber: data.einNumber } }))) ||
    (data.ocdId && (await prisma.organization.findUnique({ where: { ocdId: data.ocdId } })));

  if (existing) {
    return prisma.organization.update({
      where: { id: existing.id },
      data: {
        ocdId: data.ocdId ?? existing.ocdId,
        wikidataQid: data.wikidataQid ?? existing.wikidataQid,
        fecCommitteeId: data.fecCommitteeId ?? existing.fecCommitteeId,
        einNumber: data.einNumber ?? existing.einNumber,
        name: data.name,
        aliases: mergeAliases(existing.aliases, data.aliases),
        orgType: data.orgType,
        website: data.website ?? existing.website,
      },
      select: { id: true },
    });
  }

  return prisma.organization.create({
    data: {
      ocdId: data.ocdId,
      wikidataQid: data.wikidataQid,
      fecCommitteeId: data.fecCommitteeId,
      einNumber: data.einNumber,
      name: data.name,
      aliases: data.aliases ?? [],
      orgType: data.orgType,
      website: data.website,
    },
    select: { id: true },
  });
}

export interface DonationUpsert {
  donorPersonId?: string;
  donorOrgId?: string;
  recipientId: string;
  amount: number | string;
  currency?: string;
  date: Date;
  sourceFilingId?: string;
  employer?: string;
  occupation?: string;
  address?: string;
  sourceDocumentId?: string;
}

export async function upsertDonation(data: DonationUpsert): Promise<{ id: string }> {
  if (data.sourceFilingId) {
    const existing = await prisma.donation.findFirst({
      where: {
        sourceFilingId: data.sourceFilingId,
        recipientId: data.recipientId,
        date: data.date,
        amount: data.amount as unknown as number,
      },
      select: { id: true },
    });
    if (existing) return existing;
  }
  return prisma.donation.create({
    data: {
      donorPersonId: data.donorPersonId,
      donorOrgId: data.donorOrgId,
      recipientId: data.recipientId,
      amount: data.amount as unknown as number,
      currency: data.currency ?? "USD",
      date: data.date,
      sourceFilingId: data.sourceFilingId,
      employer: data.employer,
      occupation: data.occupation,
      address: data.address,
      sourceDocumentId: data.sourceDocumentId,
    },
    select: { id: true },
  });
}

function mergeAliases(existing: string[], incoming?: string[]): string[] {
  if (!incoming || incoming.length === 0) return existing;
  const set = new Set(existing);
  for (const alias of incoming) set.add(alias);
  return Array.from(set);
}
