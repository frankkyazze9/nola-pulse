/**
 * Tool handlers for the brain's Claude tool-use loop. Each handler is a
 * Postgres query (via Prisma or raw SQL) returning JSON-serializable data
 * the LLM can reason about.
 *
 * Hybrid search (vector + BM25) uses pgvector's <=> cosine-distance operator
 * combined with Postgres FTS `tsv @@ websearch_to_tsquery`, merged by a
 * simple reciprocal-rank-fusion.
 */

import { prisma } from "../db";
import { embedSingle, toVectorLiteral } from "../ingest/embed";

export async function searchPeople(args: {
  query?: string;
  officeOcdId?: string;
  jurisdictionOcdId?: string;
  limit?: number;
}) {
  const limit = args.limit ?? 20;
  const rows = await prisma.person.findMany({
    where: {
      ...(args.query
        ? {
            OR: [
              { familyName: { contains: args.query, mode: "insensitive" } },
              { givenName: { contains: args.query, mode: "insensitive" } },
              { aliases: { has: args.query } },
            ],
          }
        : {}),
    },
    take: limit,
    select: {
      id: true,
      givenName: true,
      middleName: true,
      familyName: true,
      suffix: true,
      aliases: true,
      party: true,
      ocdId: true,
      wikidataQid: true,
      fecCandidateId: true,
    },
    orderBy: { familyName: "asc" },
  });
  return { results: rows, count: rows.length };
}

export async function getPerson(args: { personId: string }) {
  const person = await prisma.person.findUnique({
    where: { id: args.personId },
    include: {
      terms: { include: { post: { include: { jurisdiction: true } } } },
      candidacies: {
        include: { election: true, post: { include: { jurisdiction: true } } },
      },
      memberships: { include: { organization: true } },
    },
  });
  return person;
}

export async function searchDocuments(args: {
  query: string;
  personId?: string;
  sinceDate?: string;
  sourceSystem?: string;
  limit?: number;
}) {
  const limit = args.limit ?? 10;
  const queryEmbedding = await embedSingle(args.query);
  const vector = toVectorLiteral(queryEmbedding);

  // Hybrid: vector cosine distance + FTS rank, merged 50/50.
  const since = args.sinceDate ? new Date(args.sinceDate) : null;
  const sourceSystem = args.sourceSystem ?? null;

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      document_id: string;
      chunk_index: number;
      text: string;
      page_number: number | null;
      title: string | null;
      source_url: string;
      source_system: string;
      published_at: Date | null;
      vector_score: number;
      fts_score: number;
    }>
  >`
    WITH vec AS (
      SELECT c.id, c."documentId", c."chunkIndex", c.text, c."pageNumber",
             (1 - (c.embedding <=> ${vector}::vector)) AS vector_score,
             0::float AS fts_score
      FROM "DocumentChunk" c
      WHERE c.embedding IS NOT NULL
      ORDER BY c.embedding <=> ${vector}::vector
      LIMIT 50
    ),
    fts AS (
      SELECT c.id, c."documentId", c."chunkIndex", c.text, c."pageNumber",
             0::float AS vector_score,
             ts_rank_cd(c.tsv, websearch_to_tsquery('english', ${args.query})) AS fts_score
      FROM "DocumentChunk" c
      WHERE c.tsv @@ websearch_to_tsquery('english', ${args.query})
      ORDER BY fts_score DESC
      LIMIT 50
    ),
    combined AS (
      SELECT id, "documentId", "chunkIndex", text, "pageNumber",
             SUM(vector_score) AS vector_score,
             SUM(fts_score) AS fts_score
      FROM (SELECT * FROM vec UNION ALL SELECT * FROM fts) u
      GROUP BY id, "documentId", "chunkIndex", text, "pageNumber"
    )
    SELECT c.id, c."documentId" AS document_id, c."chunkIndex" AS chunk_index,
           c.text, c."pageNumber" AS page_number,
           d.title, d."sourceUrl" AS source_url, d."sourceSystem" AS source_system,
           d."publishedAt" AS published_at,
           c.vector_score, c.fts_score
    FROM combined c
    JOIN "Document" d ON d.id = c."documentId"
    WHERE (${since}::timestamp IS NULL OR d."publishedAt" >= ${since})
      AND (${sourceSystem}::text IS NULL OR d."sourceSystem" = ${sourceSystem})
    ORDER BY (c.vector_score * 0.5 + c.fts_score * 0.5) DESC
    LIMIT ${limit}
  `;

  return {
    results: rows.map((r) => ({
      chunkId: r.id,
      documentId: r.document_id,
      chunkIndex: r.chunk_index,
      text: r.text,
      pageNumber: r.page_number,
      title: r.title,
      sourceUrl: r.source_url,
      sourceSystem: r.source_system,
      publishedAt: r.published_at?.toISOString(),
      score: Number(r.vector_score) * 0.5 + Number(r.fts_score) * 0.5,
    })),
  };
}

export async function getDocument(args: { documentId: string }) {
  const document = await prisma.document.findUnique({
    where: { id: args.documentId },
    select: {
      id: true,
      sourceUrl: true,
      archivedUrl: true,
      docType: true,
      title: true,
      publishedAt: true,
      sourceSystem: true,
      textContent: true,
    },
  });
  return document;
}

export async function searchClaims(args: {
  subjectPersonId: string;
  predicate?: string;
  limit?: number;
}) {
  const rows = await prisma.claim.findMany({
    where: {
      subjectPersonId: args.subjectPersonId,
      ...(args.predicate ? { predicate: args.predicate } : {}),
    },
    take: args.limit ?? 50,
    orderBy: { collectedAt: "desc" },
    include: {
      sourceDocument: {
        select: { title: true, sourceUrl: true, sourceSystem: true, publishedAt: true },
      },
    },
  });
  return rows.map((c) => ({
    id: c.id,
    predicate: c.predicate,
    objectText: c.objectText,
    confidence: c.confidence,
    source: {
      documentId: c.sourceDocumentId,
      title: c.sourceDocument?.title,
      sourceUrl: c.sourceDocument?.sourceUrl,
      sourceSystem: c.sourceDocument?.sourceSystem,
      publishedAt: c.sourceDocument?.publishedAt?.toISOString(),
      charStart: c.charStart,
      charEnd: c.charEnd,
    },
  }));
}

export async function getDonations(args: {
  personId?: string;
  committeeId?: string;
  direction: "given" | "received";
  minAmount?: number;
  sinceDate?: string;
  limit?: number;
}) {
  const limit = args.limit ?? 100;
  const since = args.sinceDate ? new Date(args.sinceDate) : undefined;
  const minAmount = args.minAmount;

  if (args.direction === "given") {
    return prisma.donation.findMany({
      where: {
        OR: [
          args.personId ? { donorPersonId: args.personId } : {},
          args.committeeId ? { donorOrgId: args.committeeId } : {},
        ].filter((w) => Object.keys(w).length > 0),
        ...(minAmount ? { amount: { gte: minAmount } } : {}),
        ...(since ? { date: { gte: since } } : {}),
      },
      take: limit,
      orderBy: { date: "desc" },
      include: { recipient: true },
    });
  }

  return prisma.donation.findMany({
    where: {
      recipientId: args.committeeId ?? "__none__",
      ...(minAmount ? { amount: { gte: minAmount } } : {}),
      ...(since ? { date: { gte: since } } : {}),
    },
    take: limit,
    orderBy: { date: "desc" },
    include: { donorPerson: true, donorOrg: true },
  });
}

export async function getCourtCases(args: { personId: string; caseType?: string }) {
  return prisma.courtCaseParty.findMany({
    where: {
      personId: args.personId,
      ...(args.caseType ? { case: { caseType: args.caseType } } : {}),
    },
    include: { case: true },
  });
}

export async function getNews(args: { personId: string; sinceDate?: string; limit?: number }) {
  const person = await prisma.person.findUnique({
    where: { id: args.personId },
    select: { givenName: true, familyName: true, aliases: true },
  });
  if (!person) return { results: [] };

  const query = `${person.givenName} ${person.familyName}`;
  return searchDocuments({
    query,
    sinceDate: args.sinceDate,
    sourceSystem: "rss",
    limit: args.limit ?? 20,
  });
}

export async function getHearings(args: { personId: string; sinceDate?: string; limit?: number }) {
  const person = await prisma.person.findUnique({
    where: { id: args.personId },
    select: { givenName: true, familyName: true },
  });
  if (!person) return { results: [] };
  const query = `${person.givenName} ${person.familyName}`;
  const results = await prisma.document.findMany({
    where: {
      docType: { in: ["hearing_transcript", "transcript", "video"] },
      textContent: { contains: query, mode: "insensitive" },
      ...(args.sinceDate ? { publishedAt: { gte: new Date(args.sinceDate) } } : {}),
    },
    take: args.limit ?? 10,
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      title: true,
      sourceUrl: true,
      sourceSystem: true,
      publishedAt: true,
    },
  });
  return { results };
}

export async function getPublicOpinion(args: {
  personId: string;
  sinceDate?: string;
  sources?: string[];
}) {
  const person = await prisma.person.findUnique({
    where: { id: args.personId },
    select: { givenName: true, familyName: true, aliases: true },
  });
  if (!person) return { results: [] };
  const query = `${person.givenName} ${person.familyName}`;
  const sources = args.sources ?? ["bluesky", "social_post", "forum"];
  return prisma.document.findMany({
    where: {
      sourceSystem: { in: sources },
      textContent: { contains: query, mode: "insensitive" },
      ...(args.sinceDate ? { publishedAt: { gte: new Date(args.sinceDate) } } : {}),
    },
    take: 30,
    orderBy: { publishedAt: "desc" },
  });
}

export async function webSearch(args: { query: string }) {
  // Stub — a real implementation would call a web search API (SerpAPI, Brave,
  // Bing until Aug 2025). The brain is instructed to use this sparingly.
  return {
    note: "web_search is not yet wired to a provider. Prefer local tools.",
    query: args.query,
    results: [],
  };
}

// --- Case (investigation) handlers -----------------------------------------

export async function createCase(args: { title: string; brief: string }) {
  const row = await prisma.case.create({
    data: { title: args.title, brief: args.brief, status: "active" },
    select: { id: true, title: true, brief: true, status: true, createdAt: true },
  });
  return row;
}

export async function updateCase(args: {
  caseId: string;
  title?: string;
  brief?: string;
  status?: "active" | "paused" | "closed" | "published";
  findings?: Record<string, unknown>;
  outputDraft?: string;
}) {
  const row = await prisma.case.update({
    where: { id: args.caseId },
    data: {
      ...(args.title !== undefined ? { title: args.title } : {}),
      ...(args.brief !== undefined ? { brief: args.brief } : {}),
      ...(args.status !== undefined ? { status: args.status } : {}),
      ...(args.findings !== undefined ? { findings: args.findings as object } : {}),
      ...(args.outputDraft !== undefined ? { outputDraft: args.outputDraft } : {}),
    },
  });
  return row;
}

export async function attachEvidence(args: {
  caseId: string;
  role?: "primary_source" | "supporting" | "contradicting" | "background";
  documentId?: string;
  claimId?: string;
  personId?: string;
  organizationId?: string;
  note?: string;
}) {
  const row = await prisma.caseEvidence.create({
    data: {
      caseId: args.caseId,
      role: args.role ?? "supporting",
      documentId: args.documentId,
      claimId: args.claimId,
      personId: args.personId,
      organizationId: args.organizationId,
      note: args.note,
    },
  });
  return row;
}

export async function getCase(args: { caseId: string }) {
  return prisma.case.findUnique({
    where: { id: args.caseId },
    include: {
      evidence: {
        include: {
          document: {
            select: { id: true, title: true, sourceUrl: true, sourceSystem: true, publishedAt: true },
          },
          claim: {
            select: { id: true, predicate: true, objectText: true, confidence: true },
          },
          person: { select: { id: true, givenName: true, familyName: true } },
          organization: { select: { id: true, name: true, orgType: true } },
        },
        orderBy: { addedAt: "desc" },
      },
    },
  });
}

export async function listCases(args: { status?: string; limit?: number }) {
  return prisma.case.findMany({
    where: args.status ? { status: args.status } : {},
    orderBy: { updatedAt: "desc" },
    take: args.limit ?? 50,
    select: { id: true, title: true, status: true, createdAt: true, updatedAt: true },
  });
}

// --- Project (campaign/brand) handlers -------------------------------------

export async function createProject(args: {
  title: string;
  kind?: "campaign" | "brand" | "other";
  subjectPersonId?: string;
  subjectOrgId?: string;
  goals?: Record<string, unknown>;
}) {
  const row = await prisma.project.create({
    data: {
      title: args.title,
      kind: args.kind ?? "campaign",
      subjectPersonId: args.subjectPersonId,
      subjectOrgId: args.subjectOrgId,
      goals: args.goals as object | undefined,
      status: "active",
    },
  });
  return row;
}

export async function updateProject(args: {
  projectId: string;
  title?: string;
  status?: "active" | "paused" | "closed";
  goals?: Record<string, unknown>;
  brandAnalysis?: Record<string, unknown>;
  influencerMap?: Record<string, unknown>;
  growthPlan?: Record<string, unknown>;
}) {
  const row = await prisma.project.update({
    where: { id: args.projectId },
    data: {
      ...(args.title !== undefined ? { title: args.title } : {}),
      ...(args.status !== undefined ? { status: args.status } : {}),
      ...(args.goals !== undefined ? { goals: args.goals as object } : {}),
      ...(args.brandAnalysis !== undefined ? { brandAnalysis: args.brandAnalysis as object } : {}),
      ...(args.influencerMap !== undefined ? { influencerMap: args.influencerMap as object } : {}),
      ...(args.growthPlan !== undefined ? { growthPlan: args.growthPlan as object } : {}),
    },
  });
  return row;
}

export async function getProject(args: { projectId: string }) {
  return prisma.project.findUnique({
    where: { id: args.projectId },
    include: {
      subjectPerson: true,
      subjectOrg: true,
    },
  });
}

export async function listProjects(args: { status?: string; limit?: number }) {
  return prisma.project.findMany({
    where: args.status ? { status: args.status } : {},
    orderBy: { updatedAt: "desc" },
    take: args.limit ?? 50,
    include: {
      subjectPerson: { select: { givenName: true, familyName: true } },
      subjectOrg: { select: { name: true } },
    },
  });
}

// --- Election intelligence handlers ----------------------------------------

export async function createElection(args: {
  date: string; // ISO
  jurisdictionOcdId: string;
  electionType: "primary" | "general" | "runoff" | "special";
  ocdId?: string;
}) {
  const jurisdiction = await prisma.jurisdiction.findUnique({
    where: { ocdId: args.jurisdictionOcdId },
    select: { id: true },
  });
  if (!jurisdiction) {
    throw new Error(`jurisdiction not found: ${args.jurisdictionOcdId}`);
  }
  return prisma.election.create({
    data: {
      date: new Date(args.date),
      jurisdictionId: jurisdiction.id,
      electionType: args.electionType,
      ocdId: args.ocdId,
    },
  });
}

export async function createCandidacy(args: {
  personId: string;
  electionId: string;
  postOcdId: string;
  outcome?: "won" | "lost" | "withdrew" | "pending";
  votesReceived?: number;
  votesPct?: number;
}) {
  const post = await prisma.post.findUnique({
    where: { ocdId: args.postOcdId },
    select: { id: true },
  });
  if (!post) throw new Error(`post not found: ${args.postOcdId}`);
  return prisma.candidacy.create({
    data: {
      personId: args.personId,
      electionId: args.electionId,
      postId: post.id,
      outcome: args.outcome ?? "pending",
      votesReceived: args.votesReceived,
      votesPct: args.votesPct,
    },
  });
}

export async function listElections(args: {
  upcoming?: boolean;
  jurisdictionOcdId?: string;
  limit?: number;
}) {
  const where: Record<string, unknown> = {};
  if (args.upcoming) where.date = { gte: new Date() };
  if (args.jurisdictionOcdId) {
    const j = await prisma.jurisdiction.findUnique({
      where: { ocdId: args.jurisdictionOcdId },
      select: { id: true },
    });
    if (j) where.jurisdictionId = j.id;
  }
  return prisma.election.findMany({
    where,
    orderBy: { date: "asc" },
    take: args.limit ?? 50,
    include: {
      jurisdiction: { select: { name: true, ocdId: true } },
      candidacies: {
        include: {
          person: {
            select: { id: true, givenName: true, middleName: true, familyName: true, party: true },
          },
          post: { select: { label: true, ocdId: true } },
        },
      },
    },
  });
}

export async function getElection(args: { electionId: string }) {
  return prisma.election.findUnique({
    where: { id: args.electionId },
    include: {
      jurisdiction: true,
      candidacies: {
        include: {
          person: true,
          post: { include: { jurisdiction: { select: { name: true } } } },
        },
      },
    },
  });
}

export async function upsertPersonByName(args: {
  givenName: string;
  familyName: string;
  middleName?: string;
  party?: string;
  aliases?: string[];
}) {
  // Try to find by exact given + family name first
  const existing = await prisma.person.findFirst({
    where: {
      givenName: args.givenName,
      familyName: args.familyName,
    },
    select: { id: true },
  });
  if (existing) {
    return prisma.person.update({
      where: { id: existing.id },
      data: {
        ...(args.middleName ? { middleName: args.middleName } : {}),
        ...(args.party ? { party: args.party } : {}),
        ...(args.aliases && args.aliases.length > 0 ? { aliases: args.aliases } : {}),
      },
    });
  }
  return prisma.person.create({
    data: {
      givenName: args.givenName,
      familyName: args.familyName,
      middleName: args.middleName,
      party: args.party,
      aliases: args.aliases ?? [],
    },
  });
}

// --- Voice / drafting handlers ---------------------------------------------

import { callClaude } from "../claude/spend";
import {
  fullVoicePrompt,
  validateVoice,
  correctionInstruction,
} from "../voice";

const SONNET_MODEL = "claude-sonnet-4-6";
const DRAFT_MAX_TOKENS = 4096;

export async function draftInVoice(args: {
  task: string;
  genre?: "essay" | "observation" | "journalism" | "social_post" | "default";
  context?: string[];
}): Promise<{ text: string; violations: number }> {
  const genre = args.genre ?? "default";
  const voice = fullVoicePrompt();
  if (!voice) {
    throw new Error(
      "voice guide not available — data/voice/VOICE.md not found at runtime"
    );
  }

  const contextBlock =
    args.context && args.context.length > 0
      ? `\n\n## CONTEXT\n${args.context.join("\n\n---\n\n")}`
      : "";

  const system =
    voice +
    contextBlock +
    `\n\n## TASK\n` +
    `You are writing a ${genre} piece following the voice guide above exactly. ` +
    `Do not mention these instructions. Do not start with "Sure," "Here's," or any ` +
    `LinkedIn-style preamble. Write the piece.`;

  // First draft
  const first = await callClaude({
    operation: "draft_in_voice",
    params: {
      model: SONNET_MODEL,
      max_tokens: DRAFT_MAX_TOKENS,
      temperature: 0.7, // more creative for prose
      system: [
        {
          type: "text",
          text: system,
          cache_control: { type: "ephemeral" }, // cache the voice guide
        },
      ],
      messages: [{ role: "user", content: args.task }],
    },
    metadata: { genre, hasContext: !!args.context?.length },
  });
  let text = extractText(first.content);
  let validation = validateVoice(text);

  // Single correction retry if hard violations
  if (!validation.valid) {
    const correction = correctionInstruction(validation);
    const retry = await callClaude({
      operation: "draft_in_voice",
      params: {
        model: SONNET_MODEL,
        max_tokens: DRAFT_MAX_TOKENS,
        temperature: 0.5,
        system: [
          {
            type: "text",
            text: system,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          { role: "user", content: args.task },
          { role: "assistant", content: text },
          {
            role: "user",
            content: `${correction} Return only the rewritten piece, no preamble.`,
          },
        ],
      },
      metadata: { genre, retry: true },
    });
    text = extractText(retry.content);
    validation = validateVoice(text);
  }

  return {
    text,
    violations: validation.violations.filter((v) => v.type !== "soft_flag").length,
  };
}

function extractText(content: unknown[]): string {
  return content
    .filter(
      (b): b is { type: "text"; text: string } =>
        typeof b === "object" &&
        b !== null &&
        "type" in b &&
        (b as { type: unknown }).type === "text"
    )
    .map((b) => b.text)
    .join("\n")
    .trim();
}

// --- Observation handlers --------------------------------------------------

import { runObservationPass } from "../observation";

export async function generateObservations(args: {
  sinceHours?: number;
  limit?: number;
}) {
  return runObservationPass({
    sinceHours: args.sinceHours ?? 24,
    limit: args.limit ?? 20,
  });
}

export async function listObservations(args: {
  type?: "pattern" | "hypothesis" | "comedy";
  status?: "draft" | "approved" | "rejected" | "published";
  limit?: number;
}) {
  return prisma.observation.findMany({
    where: {
      ...(args.type ? { type: args.type } : {}),
      ...(args.status ? { status: args.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: args.limit ?? 50,
    include: {
      sources: {
        include: {
          document: {
            select: { title: true, sourceUrl: true, sourceSystem: true },
          },
        },
      },
    },
  });
}

export async function updateObservationStatus(args: {
  observationId: string;
  status: "draft" | "approved" | "rejected" | "published";
  note?: string;
}) {
  return prisma.observation.update({
    where: { id: args.observationId },
    data: {
      status: args.status,
      ...(args.note !== undefined ? { note: args.note } : {}),
    },
  });
}
