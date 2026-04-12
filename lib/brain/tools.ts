/**
 * Tool definitions for the brain's Claude tool-use loop.
 *
 * Each tool has:
 *   - name + description (shown to Claude)
 *   - input_schema (JSON Schema, validated by Claude)
 *   - handler (invoked with parsed input, returns JSON-serializable result)
 *
 * The brain is instructed to call tools aggressively before answering and
 * to cite sources from tool results via documentId. See
 * `.claude/skills/brain-prompt/SKILL.md`.
 */

import * as handlers from "./handlers";

export interface BrainTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (input: Record<string, unknown>) => Promise<unknown>;
}

export const TOOLS: BrainTool[] = [
  {
    name: "search_people",
    description:
      "Find persons in the Dark Horse knowledge graph by name, office, or jurisdiction. Use this to resolve a question like 'what does this judge do' to a specific Person ID before calling tools that require one.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Name fragment to search (full or partial)." },
        officeOcdId: { type: "string", description: "Filter by OCD post ID." },
        jurisdictionOcdId: { type: "string", description: "Filter by OCD division ID." },
        limit: { type: "number", description: "Max results (default 20)." },
      },
    },
    handler: (input) => handlers.searchPeople(input as Parameters<typeof handlers.searchPeople>[0]),
  },
  {
    name: "get_person",
    description:
      "Get a person's full record: name, aliases, known IDs (FEC, LA Ethics, Wikidata), terms held, candidacies, memberships. Use after search_people to load details.",
    input_schema: {
      type: "object",
      properties: {
        personId: { type: "string", description: "Internal Person ID (cuid)." },
      },
      required: ["personId"],
    },
    handler: (input) => handlers.getPerson(input as Parameters<typeof handlers.getPerson>[0]),
  },
  {
    name: "search_documents",
    description:
      "Hybrid BM25 + vector search across the document corpus (news, filings, hearings, social posts). Returns document chunks with source and score. Every result can be cited via documentId + chunkId.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural language query." },
        personId: { type: "string", description: "Filter to documents mentioning this person." },
        sinceDate: { type: "string", description: "ISO date filter (YYYY-MM-DD). Only return docs published after." },
        sourceSystem: { type: "string", description: "Filter by sourceSystem (e.g. 'rss', 'fec', 'la_ethics', 'nola_council')." },
        limit: { type: "number", description: "Max results (default 10)." },
      },
      required: ["query"],
    },
    handler: (input) => handlers.searchDocuments(input as Parameters<typeof handlers.searchDocuments>[0]),
  },
  {
    name: "get_document",
    description: "Fetch the full text and metadata of a document by ID, for deep reading of a specific source.",
    input_schema: {
      type: "object",
      properties: {
        documentId: { type: "string" },
      },
      required: ["documentId"],
    },
    handler: (input) => handlers.getDocument(input as Parameters<typeof handlers.getDocument>[0]),
  },
  {
    name: "search_claims",
    description:
      "Get structured claims extracted about a subject, optionally filtered by predicate (holds_office, donated_to, voted_for, was_charged_with, owns, employed_by, associated_with, etc.).",
    input_schema: {
      type: "object",
      properties: {
        subjectPersonId: { type: "string" },
        predicate: { type: "string" },
        limit: { type: "number" },
      },
      required: ["subjectPersonId"],
    },
    handler: (input) => handlers.searchClaims(input as Parameters<typeof handlers.searchClaims>[0]),
  },
  {
    name: "get_donations",
    description:
      "Get donations given or received. Direction 'given' returns donations from the person; direction 'received' requires committeeId and returns donations to the committee.",
    input_schema: {
      type: "object",
      properties: {
        personId: { type: "string" },
        committeeId: { type: "string" },
        direction: { type: "string", enum: ["given", "received"] },
        minAmount: { type: "number" },
        sinceDate: { type: "string" },
        limit: { type: "number" },
      },
      required: ["direction"],
    },
    handler: (input) => handlers.getDonations(input as Parameters<typeof handlers.getDonations>[0]),
  },
  {
    name: "get_court_cases",
    description: "Get court cases a person is a party to, optionally filtered by case type (civil, criminal, federal, appellate, bankruptcy).",
    input_schema: {
      type: "object",
      properties: {
        personId: { type: "string" },
        caseType: { type: "string" },
      },
      required: ["personId"],
    },
    handler: (input) => handlers.getCourtCases(input as Parameters<typeof handlers.getCourtCases>[0]),
  },
  {
    name: "get_news",
    description: "News mentions for a person — aggregated from LA journalism RSS feeds and GDELT. Returns document chunks.",
    input_schema: {
      type: "object",
      properties: {
        personId: { type: "string" },
        sinceDate: { type: "string" },
        limit: { type: "number" },
      },
      required: ["personId"],
    },
    handler: (input) => handlers.getNews(input as Parameters<typeof handlers.getNews>[0]),
  },
  {
    name: "get_hearings",
    description: "Public hearing transcripts mentioning a person — NOLA City Council (Granicus), LA Legislature (LegiScan), courts.",
    input_schema: {
      type: "object",
      properties: {
        personId: { type: "string" },
        sinceDate: { type: "string" },
        limit: { type: "number" },
      },
      required: ["personId"],
    },
    handler: (input) => handlers.getHearings(input as Parameters<typeof handlers.getHearings>[0]),
  },
  {
    name: "get_public_opinion",
    description: "Public social media posts, letters to the editor, forum posts about a person. Includes Bluesky and any scraped forum content.",
    input_schema: {
      type: "object",
      properties: {
        personId: { type: "string" },
        sinceDate: { type: "string" },
        sources: { type: "array", items: { type: "string" } },
      },
      required: ["personId"],
    },
    handler: (input) => handlers.getPublicOpinion(input as Parameters<typeof handlers.getPublicOpinion>[0]),
  },
  {
    name: "web_search",
    description:
      "Live web search for things NOT in the Dark Horse corpus. Use sparingly — prefer local tools. Every web_search call is more expensive and less citable.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
    },
    handler: (input) => handlers.webSearch(input as Parameters<typeof handlers.webSearch>[0]),
  },
];

export function findTool(name: string): BrainTool | undefined {
  return TOOLS.find((t) => t.name === name);
}
