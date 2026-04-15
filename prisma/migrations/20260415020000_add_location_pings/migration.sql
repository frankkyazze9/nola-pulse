CREATE TABLE "LocationPing" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "label" TEXT,
    "note" TEXT,
    "accuracyM" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LocationPing_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LocationPing_caseId_timestamp_idx" ON "LocationPing"("caseId", "timestamp");

ALTER TABLE "LocationPing" ADD CONSTRAINT "LocationPing_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
