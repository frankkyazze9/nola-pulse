/**
 * Zod schemas for brain output. The brain returns structured JSON matching
 * one of these schemas — a UI renderer or `scripts/brain-cli.ts` then turns
 * them into markdown, React components, or a future PDF dossier.
 */

import { z } from "zod";

export const DocumentRefSchema = z.object({
  documentId: z.string(),
  chunkId: z.string().optional(),
  title: z.string().optional(),
  sourceUrl: z.string().optional(),
  sourceSystem: z.string().optional(),
  publishedAt: z.string().optional(),
});
export type DocumentRef = z.infer<typeof DocumentRefSchema>;

export const ClaimRefSchema = z.object({
  documentId: z.string(),
  chunkId: z.string().optional(),
  charStart: z.number().optional(),
  charEnd: z.number().optional(),
  quote: z.string().optional(),
});
export type ClaimRef = z.infer<typeof ClaimRefSchema>;

export const SourcedClaimSchema = z.object({
  subject: z.string(),
  predicate: z.string(),
  objectText: z.string(),
  confidence: z.number().min(0).max(1),
  sources: z.array(ClaimRefSchema).min(1),
});
export type SourcedClaim = z.infer<typeof SourcedClaimSchema>;

export const BrainAnswerSchema = z.object({
  markdown: z.string(),
  claims: z.array(SourcedClaimSchema),
  sourcesConsulted: z.array(DocumentRefSchema),
  nextSteps: z.array(z.string()).default([]),
});
export type BrainAnswer = z.infer<typeof BrainAnswerSchema>;

export const DossierSectionSchema = z.object({
  narrative: z.string(),
  claims: z.array(SourcedClaimSchema),
});
export type DossierSection = z.infer<typeof DossierSectionSchema>;

export const DossierSchema = z.object({
  personId: z.string(),
  personName: z.string(),
  generatedAt: z.string(),
  sections: z.object({
    bio: DossierSectionSchema,
    politicalBackground: DossierSectionSchema,
    votingRecord: DossierSectionSchema,
    publicStatements: DossierSectionSchema,
    campaignFinance: DossierSectionSchema,
    personalFinance: DossierSectionSchema,
    legal: DossierSectionSchema,
    media: DossierSectionSchema,
    associations: DossierSectionSchema,
  }),
  sourcesConsulted: z.array(DocumentRefSchema),
  coverageGaps: z.array(
    z.object({
      section: z.string(),
      reason: z.string(),
    })
  ),
});
export type Dossier = z.infer<typeof DossierSchema>;
