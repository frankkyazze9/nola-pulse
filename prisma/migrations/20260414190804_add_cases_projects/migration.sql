/*
  Warnings:

  - You are about to drop the column `embedding` on the `DocumentChunk` table. All the data in the column will be lost.
  - You are about to drop the column `tsv` on the `DocumentChunk` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "CourtCaseParty" DROP CONSTRAINT "CourtCaseParty_caseId_fkey";

-- DropIndex
DROP INDEX "DocumentChunk_embedding_hnsw_idx";

-- DropIndex
DROP INDEX "DocumentChunk_tsv_gin_idx";

-- AlterTable
ALTER TABLE "DocumentChunk" DROP COLUMN "embedding",
DROP COLUMN "tsv";

-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "findings" JSONB,
    "outputDraft" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseEvidence" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'supporting',
    "documentId" TEXT,
    "claimId" TEXT,
    "personId" TEXT,
    "organizationId" TEXT,
    "note" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'campaign',
    "subjectPersonId" TEXT,
    "subjectOrgId" TEXT,
    "goals" JSONB,
    "brandAnalysis" JSONB,
    "influencerMap" JSONB,
    "growthPlan" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Case_status_updatedAt_idx" ON "Case"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "CaseEvidence_caseId_idx" ON "CaseEvidence"("caseId");

-- CreateIndex
CREATE INDEX "CaseEvidence_documentId_idx" ON "CaseEvidence"("documentId");

-- CreateIndex
CREATE INDEX "CaseEvidence_claimId_idx" ON "CaseEvidence"("claimId");

-- CreateIndex
CREATE INDEX "CaseEvidence_personId_idx" ON "CaseEvidence"("personId");

-- CreateIndex
CREATE INDEX "CaseEvidence_organizationId_idx" ON "CaseEvidence"("organizationId");

-- CreateIndex
CREATE INDEX "Project_status_updatedAt_idx" ON "Project"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "Project_subjectPersonId_idx" ON "Project"("subjectPersonId");

-- CreateIndex
CREATE INDEX "Project_subjectOrgId_idx" ON "Project"("subjectOrgId");

-- AddForeignKey
ALTER TABLE "CourtCaseParty" ADD CONSTRAINT "CourtCaseParty_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CourtCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseEvidence" ADD CONSTRAINT "CaseEvidence_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseEvidence" ADD CONSTRAINT "CaseEvidence_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseEvidence" ADD CONSTRAINT "CaseEvidence_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseEvidence" ADD CONSTRAINT "CaseEvidence_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseEvidence" ADD CONSTRAINT "CaseEvidence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_subjectPersonId_fkey" FOREIGN KEY ("subjectPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_subjectOrgId_fkey" FOREIGN KEY ("subjectOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
