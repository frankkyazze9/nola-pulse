-- Dark Horse initial schema. Hand-written because pgvector + GENERATED tsvector
-- columns aren't natively supported by Prisma. Every table/index matches
-- prisma/schema.prisma.

-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- -- Entities ---------------------------------------------------------------

CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "ocdId" TEXT,
    "wikidataQid" TEXT,
    "fecCandidateId" TEXT,
    "laEthicsId" TEXT,
    "givenName" TEXT NOT NULL,
    "middleName" TEXT,
    "familyName" TEXT NOT NULL,
    "suffix" TEXT,
    "aliases" TEXT[],
    "dateOfBirth" TIMESTAMP(3),
    "party" TEXT,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Person_ocdId_key" ON "Person"("ocdId");
CREATE UNIQUE INDEX "Person_wikidataQid_key" ON "Person"("wikidataQid");
CREATE UNIQUE INDEX "Person_fecCandidateId_key" ON "Person"("fecCandidateId");
CREATE UNIQUE INDEX "Person_laEthicsId_key" ON "Person"("laEthicsId");
CREATE INDEX "Person_familyName_givenName_idx" ON "Person"("familyName", "givenName");

CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "ocdId" TEXT,
    "wikidataQid" TEXT,
    "fecCommitteeId" TEXT,
    "einNumber" TEXT,
    "name" TEXT NOT NULL,
    "aliases" TEXT[],
    "orgType" TEXT NOT NULL,
    "website" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Organization_ocdId_key" ON "Organization"("ocdId");
CREATE UNIQUE INDEX "Organization_wikidataQid_key" ON "Organization"("wikidataQid");
CREATE UNIQUE INDEX "Organization_fecCommitteeId_key" ON "Organization"("fecCommitteeId");
CREATE UNIQUE INDEX "Organization_einNumber_key" ON "Organization"("einNumber");
CREATE INDEX "Organization_name_idx" ON "Organization"("name");

-- -- Jurisdictions, offices, terms ------------------------------------------

CREATE TABLE "Jurisdiction" (
    "id" TEXT NOT NULL,
    "ocdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jurisdictionType" TEXT NOT NULL,
    "parentId" TEXT,
    CONSTRAINT "Jurisdiction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Jurisdiction_ocdId_key" ON "Jurisdiction"("ocdId");

CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "ocdId" TEXT,
    "jurisdictionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "postType" TEXT NOT NULL,
    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Post_ocdId_key" ON "Post"("ocdId");

CREATE TABLE "Term" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "howEnded" TEXT,
    CONSTRAINT "Term_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Term_personId_idx" ON "Term"("personId");
CREATE INDEX "Term_postId_idx" ON "Term"("postId");

CREATE TABLE "Election" (
    "id" TEXT NOT NULL,
    "ocdId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "electionType" TEXT NOT NULL,
    CONSTRAINT "Election_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Election_ocdId_key" ON "Election"("ocdId");

CREATE TABLE "Candidacy" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "outcome" TEXT,
    "votesReceived" INTEGER,
    "votesPct" DOUBLE PRECISION,
    CONSTRAINT "Candidacy_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Candidacy_personId_idx" ON "Candidacy"("personId");
CREATE INDEX "Candidacy_electionId_idx" ON "Candidacy"("electionId");

CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "organizationId" TEXT,
    "role" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- -- Money ------------------------------------------------------------------

CREATE TABLE "Donation" (
    "id" TEXT NOT NULL,
    "donorPersonId" TEXT,
    "donorOrgId" TEXT,
    "recipientId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "date" TIMESTAMP(3) NOT NULL,
    "sourceFilingId" TEXT,
    "employer" TEXT,
    "occupation" TEXT,
    "address" TEXT,
    "sourceDocumentId" TEXT,
    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Donation_donorPersonId_idx" ON "Donation"("donorPersonId");
CREATE INDEX "Donation_donorOrgId_idx" ON "Donation"("donorOrgId");
CREATE INDEX "Donation_recipientId_idx" ON "Donation"("recipientId");
CREATE INDEX "Donation_date_idx" ON "Donation"("date");

CREATE TABLE "VendorPayment" (
    "id" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "purpose" TEXT,
    "sourceDocumentId" TEXT,
    CONSTRAINT "VendorPayment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VendorPayment_payerId_idx" ON "VendorPayment"("payerId");
CREATE INDEX "VendorPayment_date_idx" ON "VendorPayment"("date");

CREATE TABLE "Ownership" (
    "id" TEXT NOT NULL,
    "ownerPersonId" TEXT,
    "ownerOrgId" TEXT,
    "assetType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3),
    "disposedAt" TIMESTAMP(3),
    "sourceDocumentId" TEXT,
    CONSTRAINT "Ownership_pkey" PRIMARY KEY ("id")
);

-- -- Legal ------------------------------------------------------------------

CREATE TABLE "CourtCase" (
    "id" TEXT NOT NULL,
    "docketNumber" TEXT NOT NULL,
    "courtOcdId" TEXT NOT NULL,
    "caseType" TEXT NOT NULL,
    "filedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "caption" TEXT,
    CONSTRAINT "CourtCase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CourtCase_docketNumber_courtOcdId_key" ON "CourtCase"("docketNumber", "courtOcdId");

CREATE TABLE "CourtCaseParty" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "personId" TEXT,
    "role" TEXT NOT NULL,
    CONSTRAINT "CourtCaseParty_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CourtCaseParty_caseId_idx" ON "CourtCaseParty"("caseId");
CREATE INDEX "CourtCaseParty_personId_idx" ON "CourtCaseParty"("personId");

-- -- Documents, chunks, claims ----------------------------------------------

CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "archivedUrl" TEXT,
    "gcsPath" TEXT,
    "docType" TEXT NOT NULL,
    "title" TEXT,
    "publishedAt" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceSystem" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "textContent" TEXT,
    "metadata" JSONB,
    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Document_hash_key" ON "Document"("hash");
CREATE INDEX "Document_sourceSystem_idx" ON "Document"("sourceSystem");
CREATE INDEX "Document_publishedAt_idx" ON "Document"("publishedAt");

CREATE TABLE "DocumentChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "contextPrefix" TEXT NOT NULL,
    "pageNumber" INTEGER,
    "charStart" INTEGER,
    "charEnd" INTEGER,
    -- pgvector column + generated FTS column (not Prisma-native)
    "embedding" vector(384),
    "tsv" tsvector GENERATED ALWAYS AS (to_tsvector('english', "text")) STORED,
    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DocumentChunk_documentId_idx" ON "DocumentChunk"("documentId");
CREATE INDEX "DocumentChunk_embedding_hnsw_idx" ON "DocumentChunk" USING hnsw (embedding vector_cosine_ops);
CREATE INDEX "DocumentChunk_tsv_gin_idx" ON "DocumentChunk" USING gin (tsv);

CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "subjectPersonId" TEXT,
    "subjectOrgId" TEXT,
    "predicate" TEXT NOT NULL,
    "objectText" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "charStart" INTEGER,
    "charEnd" INTEGER,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Claim_subjectPersonId_predicate_idx" ON "Claim"("subjectPersonId", "predicate");
CREATE INDEX "Claim_subjectOrgId_predicate_idx" ON "Claim"("subjectOrgId", "predicate");
CREATE INDEX "Claim_sourceDocumentId_idx" ON "Claim"("sourceDocumentId");

-- -- Implicit many-to-many: Document <-> CourtCase (Prisma name: "caseDoc") --

CREATE TABLE "_caseDoc" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_caseDoc_AB_pkey" PRIMARY KEY ("A","B")
);
CREATE INDEX "_caseDoc_B_index" ON "_caseDoc"("B");

-- -- Infrastructure (entity resolution, scraper observability, spend) ------

CREATE TABLE "EntityMatch" (
    "id" TEXT NOT NULL,
    "leftEntityType" TEXT NOT NULL,
    "leftEntityId" TEXT NOT NULL,
    "rightEntityType" TEXT NOT NULL,
    "rightEntityId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    CONSTRAINT "EntityMatch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EntityMatch_status_idx" ON "EntityMatch"("status");
CREATE INDEX "EntityMatch_leftEntityType_leftEntityId_idx" ON "EntityMatch"("leftEntityType", "leftEntityId");
CREATE INDEX "EntityMatch_rightEntityType_rightEntityId_idx" ON "EntityMatch"("rightEntityType", "rightEntityId");

CREATE TABLE "ScraperRun" (
    "id" TEXT NOT NULL,
    "scraperName" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "recordsFetched" INTEGER NOT NULL DEFAULT 0,
    "recordsUpserted" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "errorDetails" JSONB,
    CONSTRAINT "ScraperRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ScraperRun_scraperName_startedAt_idx" ON "ScraperRun"("scraperName", "startedAt");

CREATE TABLE "ApiSpendLog" (
    "id" TEXT NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "service" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "cachedInputTokens" INTEGER,
    "outputTokens" INTEGER,
    "pagesProcessed" INTEGER,
    "costUsd" DECIMAL(10,5) NOT NULL,
    "metadata" JSONB,
    CONSTRAINT "ApiSpendLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ApiSpendLog_loggedAt_idx" ON "ApiSpendLog"("loggedAt");
CREATE INDEX "ApiSpendLog_service_loggedAt_idx" ON "ApiSpendLog"("service", "loggedAt");
CREATE INDEX "ApiSpendLog_operation_loggedAt_idx" ON "ApiSpendLog"("operation", "loggedAt");

-- -- Foreign keys ------------------------------------------------------------

ALTER TABLE "Jurisdiction"
  ADD CONSTRAINT "Jurisdiction_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Jurisdiction"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Post"
  ADD CONSTRAINT "Post_jurisdictionId_fkey"
  FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Term"
  ADD CONSTRAINT "Term_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "Post"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Term"
  ADD CONSTRAINT "Term_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Election"
  ADD CONSTRAINT "Election_jurisdictionId_fkey"
  FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Candidacy"
  ADD CONSTRAINT "Candidacy_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Candidacy"
  ADD CONSTRAINT "Candidacy_electionId_fkey"
  FOREIGN KEY ("electionId") REFERENCES "Election"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Candidacy"
  ADD CONSTRAINT "Candidacy_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "Post"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Membership"
  ADD CONSTRAINT "Membership_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Membership"
  ADD CONSTRAINT "Membership_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Donation"
  ADD CONSTRAINT "Donation_donorPersonId_fkey"
  FOREIGN KEY ("donorPersonId") REFERENCES "Person"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Donation"
  ADD CONSTRAINT "Donation_donorOrgId_fkey"
  FOREIGN KEY ("donorOrgId") REFERENCES "Organization"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Donation"
  ADD CONSTRAINT "Donation_recipientId_fkey"
  FOREIGN KEY ("recipientId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Donation"
  ADD CONSTRAINT "Donation_sourceDocumentId_fkey"
  FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VendorPayment"
  ADD CONSTRAINT "VendorPayment_payerId_fkey"
  FOREIGN KEY ("payerId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VendorPayment"
  ADD CONSTRAINT "VendorPayment_sourceDocumentId_fkey"
  FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Ownership"
  ADD CONSTRAINT "Ownership_ownerPersonId_fkey"
  FOREIGN KEY ("ownerPersonId") REFERENCES "Person"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Ownership"
  ADD CONSTRAINT "Ownership_ownerOrgId_fkey"
  FOREIGN KEY ("ownerOrgId") REFERENCES "Organization"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Ownership"
  ADD CONSTRAINT "Ownership_sourceDocumentId_fkey"
  FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CourtCaseParty"
  ADD CONSTRAINT "CourtCaseParty_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "CourtCase"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourtCaseParty"
  ADD CONSTRAINT "CourtCaseParty_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DocumentChunk"
  ADD CONSTRAINT "DocumentChunk_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Claim"
  ADD CONSTRAINT "Claim_subjectPersonId_fkey"
  FOREIGN KEY ("subjectPersonId") REFERENCES "Person"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Claim"
  ADD CONSTRAINT "Claim_subjectOrgId_fkey"
  FOREIGN KEY ("subjectOrgId") REFERENCES "Organization"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Claim"
  ADD CONSTRAINT "Claim_sourceDocumentId_fkey"
  FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_caseDoc"
  ADD CONSTRAINT "_caseDoc_A_fkey"
  FOREIGN KEY ("A") REFERENCES "CourtCase"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_caseDoc"
  ADD CONSTRAINT "_caseDoc_B_fkey"
  FOREIGN KEY ("B") REFERENCES "Document"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
