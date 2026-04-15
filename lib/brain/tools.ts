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

  // --- Case (investigation) tools ---
  {
    name: "create_case",
    description:
      "Create a new investigation case. Use when the user describes an investigation they want to run (e.g. 'Is NOLA recycling real?'). Returns the new Case record with id.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short title for the investigation." },
        brief: { type: "string", description: "What are we investigating and why. Include the question, background, and known leads." },
      },
      required: ["title", "brief"],
    },
    handler: (input) => handlers.createCase(input as Parameters<typeof handlers.createCase>[0]),
  },
  {
    name: "update_case",
    description:
      "Update a case's title, brief, status, findings (structured JSON), or outputDraft (journalism piece). Status values: active | paused | closed | published.",
    input_schema: {
      type: "object",
      properties: {
        caseId: { type: "string" },
        title: { type: "string" },
        brief: { type: "string" },
        status: { type: "string", enum: ["active", "paused", "closed", "published"] },
        findings: { type: "object", description: "Structured findings: { summary, key_claims, timeline, open_questions, etc. }" },
        outputDraft: { type: "string", description: "Markdown draft of the investigative journalism piece." },
      },
      required: ["caseId"],
    },
    handler: (input) => handlers.updateCase(input as Parameters<typeof handlers.updateCase>[0]),
  },
  {
    name: "attach_evidence",
    description:
      "Link a document, claim, person, or organization to a case as evidence. Role: primary_source | supporting | contradicting | background.",
    input_schema: {
      type: "object",
      properties: {
        caseId: { type: "string" },
        role: { type: "string", enum: ["primary_source", "supporting", "contradicting", "background"] },
        documentId: { type: "string" },
        claimId: { type: "string" },
        personId: { type: "string" },
        organizationId: { type: "string" },
        note: { type: "string", description: "Why this evidence matters." },
      },
      required: ["caseId"],
    },
    handler: (input) => handlers.attachEvidence(input as Parameters<typeof handlers.attachEvidence>[0]),
  },
  {
    name: "get_case",
    description: "Load a case with all its attached evidence. Use when resuming work on an existing investigation.",
    input_schema: {
      type: "object",
      properties: { caseId: { type: "string" } },
      required: ["caseId"],
    },
    handler: (input) => handlers.getCase(input as Parameters<typeof handlers.getCase>[0]),
  },
  {
    name: "list_cases",
    description: "List cases, optionally filtered by status.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string" },
        limit: { type: "number" },
      },
    },
    handler: (input) => handlers.listCases(input as Parameters<typeof handlers.listCases>[0]),
  },

  // --- Project (campaign/brand) tools ---
  {
    name: "create_project",
    description:
      "Create a new campaign or brand project. Use when the user describes a candidate they're helping or a brand they're building. Link to a Person (subjectPersonId) or Organization (subjectOrgId) from the knowledge graph.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        kind: { type: "string", enum: ["campaign", "brand", "other"] },
        subjectPersonId: { type: "string" },
        subjectOrgId: { type: "string" },
        goals: { type: "object", description: "Agent-structured goals: { win_race?, increase_name_id?, target_demographics?, etc. }" },
      },
      required: ["title"],
    },
    handler: (input) => handlers.createProject(input as Parameters<typeof handlers.createProject>[0]),
  },
  {
    name: "update_project",
    description:
      "Update a project's title, status, goals, brand analysis, influencer map, or growth plan. All analysis fields are structured JSON the agent builds up over time.",
    input_schema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        title: { type: "string" },
        status: { type: "string", enum: ["active", "paused", "closed"] },
        goals: { type: "object" },
        brandAnalysis: { type: "object", description: "{ current_perception, coverage_summary, social_presence, strengths, weaknesses, etc. }" },
        influencerMap: { type: "object", description: "{ influencers: [{ handle, platform, reach, engagement, alignment, reason }] }" },
        growthPlan: { type: "object", description: "{ short_term_actions, outreach_targets, content_themes, risks }" },
      },
      required: ["projectId"],
    },
    handler: (input) => handlers.updateProject(input as Parameters<typeof handlers.updateProject>[0]),
  },
  {
    name: "get_project",
    description: "Load a project with its subject person/org. Use when resuming work on an existing campaign/brand project.",
    input_schema: {
      type: "object",
      properties: { projectId: { type: "string" } },
      required: ["projectId"],
    },
    handler: (input) => handlers.getProject(input as Parameters<typeof handlers.getProject>[0]),
  },
  {
    name: "list_projects",
    description: "List projects, optionally filtered by status.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string" },
        limit: { type: "number" },
      },
    },
    handler: (input) => handlers.listProjects(input as Parameters<typeof handlers.listProjects>[0]),
  },

  // --- Election intelligence tools ---
  {
    name: "create_election",
    description:
      "Register an election in the knowledge graph. Use when the user describes an upcoming election or you discover one in ingested coverage. jurisdictionOcdId must match a seeded jurisdiction (e.g. ocd-division/country:us/state:la/place:new_orleans).",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "ISO date of the election, e.g. 2026-05-12" },
        jurisdictionOcdId: { type: "string", description: "OCD division ID of the jurisdiction holding the election" },
        electionType: { type: "string", enum: ["primary", "general", "runoff", "special"] },
        ocdId: { type: "string", description: "Optional OCD election ID" },
      },
      required: ["date", "jurisdictionOcdId", "electionType"],
    },
    handler: (input) => handlers.createElection(input as Parameters<typeof handlers.createElection>[0]),
  },
  {
    name: "create_candidacy",
    description:
      "Register a person as a candidate in a specific election + post. personId and electionId must exist; postOcdId must match a seeded post. Use outcome='pending' for races that haven't happened yet.",
    input_schema: {
      type: "object",
      properties: {
        personId: { type: "string" },
        electionId: { type: "string" },
        postOcdId: { type: "string", description: "OCD post ID of the seat being contested" },
        outcome: { type: "string", enum: ["won", "lost", "withdrew", "pending"] },
        votesReceived: { type: "number" },
        votesPct: { type: "number" },
      },
      required: ["personId", "electionId", "postOcdId"],
    },
    handler: (input) => handlers.createCandidacy(input as Parameters<typeof handlers.createCandidacy>[0]),
  },
  {
    name: "list_elections",
    description:
      "List elections, optionally filtered to upcoming only or a specific jurisdiction. Returns each election with its candidacies.",
    input_schema: {
      type: "object",
      properties: {
        upcoming: { type: "boolean" },
        jurisdictionOcdId: { type: "string" },
        limit: { type: "number" },
      },
    },
    handler: (input) => handlers.listElections(input as Parameters<typeof handlers.listElections>[0]),
  },
  {
    name: "get_election",
    description: "Load a single election with full candidacy details (person + post).",
    input_schema: {
      type: "object",
      properties: { electionId: { type: "string" } },
      required: ["electionId"],
    },
    handler: (input) => handlers.getElection(input as Parameters<typeof handlers.getElection>[0]),
  },
  {
    name: "upsert_person_by_name",
    description:
      "Find or create a Person record by given + family name. Use when registering candidates the agent discovered in ingested coverage. If the person already exists, updates middleName/party/aliases if provided. Returns the Person row including id for use with create_candidacy.",
    input_schema: {
      type: "object",
      properties: {
        givenName: { type: "string" },
        familyName: { type: "string" },
        middleName: { type: "string" },
        party: { type: "string" },
        aliases: { type: "array", items: { type: "string" } },
      },
      required: ["givenName", "familyName"],
    },
    handler: (input) => handlers.upsertPersonByName(input as Parameters<typeof handlers.upsertPersonByName>[0]),
  },

  // --- Voice / drafting tool ---
  {
    name: "draft_in_voice",
    description:
      "Write prose in Dark Horse's house voice. Use this for journalism drafts, Case outputDraft, observations, social posts — anything meant to sound like a human piece of writing rather than a research report. The voice guide is loaded from data/voice/VOICE.md and enforces hard rules (no em dashes, no LinkedIn-speak, no forbidden words like 'delve', 'leverage', 'multifaceted'). Output is validated; if hard violations are found, the draft is retried once with a correction note.\n\nPass `context` as a list of short source excerpts or sourced claims the piece should build on. The tool handles the prose; you handle the sourcing.",
    input_schema: {
      type: "object",
      properties: {
        task: {
          type: "string",
          description: "What to write. E.g. 'Open a 400-word essay on why the Cantrell indictment coverage pattern suggests selective narrative deployment against Black women in executive roles.' Be specific about length, angle, and what the piece is arguing.",
        },
        genre: {
          type: "string",
          enum: ["essay", "observation", "journalism", "social_post", "default"],
          description: "Genre — influences tone/structure within the voice. 'observation' = short 2-4 sentence take. 'journalism' = investigative piece. 'essay' = longer reflective piece. 'social_post' = tweet-length. 'default' = unconstrained.",
        },
        context: {
          type: "array",
          items: { type: "string" },
          description: "Optional source excerpts, sourced claims, or facts the piece should build on. Each array element is a separate chunk of context.",
        },
      },
      required: ["task"],
    },
    handler: (input) =>
      handlers.draftInVoice(input as Parameters<typeof handlers.draftInVoice>[0]),
  },

  // --- Observation engine tools ---
  {
    name: "generate_observations",
    description:
      "Run the observation pass: triage recent documents, generate typed observations (pattern / hypothesis / comedy) for passing documents. Use this when the user asks to 'run observations' or 'see what's new', or when you want to seed comedy/pattern takes on a recent batch of ingested content. Returns counts: candidatesExamined, passedTriage, observationsCreated.",
    input_schema: {
      type: "object",
      properties: {
        sinceHours: { type: "number", description: "Lookback window in hours (default 24)" },
        limit: { type: "number", description: "Max source documents to process (default 20)" },
      },
    },
    handler: (input) => handlers.generateObservations(input as Parameters<typeof handlers.generateObservations>[0]),
  },
  {
    name: "list_observations",
    description: "List observations, optionally filtered by type and/or status. Use when the user asks what observations exist or wants to review specific types.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["pattern", "hypothesis", "comedy"] },
        status: { type: "string", enum: ["draft", "approved", "rejected", "published"] },
        limit: { type: "number" },
      },
    },
    handler: (input) => handlers.listObservations(input as Parameters<typeof handlers.listObservations>[0]),
  },
  {
    name: "update_observation_status",
    description: "Approve, reject, or publish an observation. Use when the user reacts to an observation (loves it, hates it, wants to share it).",
    input_schema: {
      type: "object",
      properties: {
        observationId: { type: "string" },
        status: { type: "string", enum: ["draft", "approved", "rejected", "published"] },
        note: { type: "string" },
      },
      required: ["observationId", "status"],
    },
    handler: (input) => handlers.updateObservationStatus(input as Parameters<typeof handlers.updateObservationStatus>[0]),
  },

  // --- Risk assessment tools ---
  {
    name: "assess_risk",
    description:
      "Run a structured risk analysis on a subject (person, organization, case, or project). Uses Sonnet + the subject's existing claims/evidence/metadata to produce typed assessments by category (legal, financial, reputational, opposition, narrative, operational). For cases, also produces publication_risk / backlash_risk / who_benefits / who_loses analysis. Returns the created assessment IDs. Use when the user asks about risk, enemies, exposure, or 'who benefits from this.'\n\ncategoryHints (optional) limits the analysis to specific categories. extraContext lets you pass additional framing (e.g. 'focus on risks if we publish this piece').",
    input_schema: {
      type: "object",
      properties: {
        subjectType: { type: "string", enum: ["person", "organization", "case", "project"] },
        subjectId: { type: "string" },
        categoryHints: {
          type: "array",
          items: { type: "string" },
          description: "Optional categories to focus on. Omit for full sweep.",
        },
        extraContext: { type: "string" },
      },
      required: ["subjectType", "subjectId"],
    },
    handler: (input) => handlers.assessRisk(input as Parameters<typeof handlers.assessRisk>[0]),
  },
  {
    name: "list_risks",
    description: "List risk assessments, optionally filtered by subject, severity, or status. Returns with source quotes.",
    input_schema: {
      type: "object",
      properties: {
        subjectType: { type: "string" },
        subjectId: { type: "string" },
        severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
        status: { type: "string", enum: ["active", "resolved", "watching", "dismissed"] },
        limit: { type: "number" },
      },
    },
    handler: (input) => handlers.listRisks(input as Parameters<typeof handlers.listRisks>[0]),
  },
  {
    name: "get_risk",
    description: "Load a single risk assessment with all sources.",
    input_schema: {
      type: "object",
      properties: { riskId: { type: "string" } },
      required: ["riskId"],
    },
    handler: (input) => handlers.getRisk(input as Parameters<typeof handlers.getRisk>[0]),
  },
];

export function findTool(name: string): BrainTool | undefined {
  return TOOLS.find((t) => t.name === name);
}
