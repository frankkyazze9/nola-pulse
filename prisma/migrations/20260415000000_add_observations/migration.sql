-- Add Observation + ObservationSource tables
CREATE TABLE "Observation" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "subjectPersonId" TEXT,
    "subjectOrgId" TEXT,
    "topic" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Observation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Observation_type_createdAt_idx" ON "Observation"("type", "createdAt");
CREATE INDEX "Observation_status_createdAt_idx" ON "Observation"("status", "createdAt");
CREATE INDEX "Observation_subjectPersonId_idx" ON "Observation"("subjectPersonId");
CREATE INDEX "Observation_subjectOrgId_idx" ON "Observation"("subjectOrgId");
CREATE INDEX "Observation_topic_idx" ON "Observation"("topic");

ALTER TABLE "Observation" ADD CONSTRAINT "Observation_subjectPersonId_fkey" FOREIGN KEY ("subjectPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_subjectOrgId_fkey" FOREIGN KEY ("subjectOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ObservationSource" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkId" TEXT,
    "quote" TEXT,
    CONSTRAINT "ObservationSource_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ObservationSource_observationId_idx" ON "ObservationSource"("observationId");
CREATE INDEX "ObservationSource_documentId_idx" ON "ObservationSource"("documentId");

ALTER TABLE "ObservationSource" ADD CONSTRAINT "ObservationSource_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "Observation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ObservationSource" ADD CONSTRAINT "ObservationSource_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
