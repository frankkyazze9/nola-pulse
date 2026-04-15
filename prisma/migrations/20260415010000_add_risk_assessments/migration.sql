CREATE TABLE "RiskAssessment" (
    "id" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "riskType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT,
    "signals" JSONB,
    "mitigations" JSONB,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RiskAssessment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RiskAssessment_subjectType_subjectId_idx" ON "RiskAssessment"("subjectType", "subjectId");
CREATE INDEX "RiskAssessment_severity_updatedAt_idx" ON "RiskAssessment"("severity", "updatedAt");
CREATE INDEX "RiskAssessment_riskType_idx" ON "RiskAssessment"("riskType");
CREATE INDEX "RiskAssessment_status_idx" ON "RiskAssessment"("status");

CREATE TABLE "RiskAssessmentSource" (
    "id" TEXT NOT NULL,
    "riskAssessmentId" TEXT NOT NULL,
    "documentId" TEXT,
    "claimId" TEXT,
    "quote" TEXT,
    "note" TEXT,
    CONSTRAINT "RiskAssessmentSource_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RiskAssessmentSource_riskAssessmentId_idx" ON "RiskAssessmentSource"("riskAssessmentId");
CREATE INDEX "RiskAssessmentSource_documentId_idx" ON "RiskAssessmentSource"("documentId");
CREATE INDEX "RiskAssessmentSource_claimId_idx" ON "RiskAssessmentSource"("claimId");

ALTER TABLE "RiskAssessmentSource" ADD CONSTRAINT "RiskAssessmentSource_riskAssessmentId_fkey" FOREIGN KEY ("riskAssessmentId") REFERENCES "RiskAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiskAssessmentSource" ADD CONSTRAINT "RiskAssessmentSource_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RiskAssessmentSource" ADD CONSTRAINT "RiskAssessmentSource_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;
