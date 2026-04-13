---
name: brain-prompt
description: The Dark Horse "Brain" system-prompt contract and design rules — tool list, output schema, citation discipline, spend logging, model selection. Read before touching lib/brain/* or changing how the brain reasons.
---

# The Dark Horse Brain — design contract

Dark Horse's center of gravity is a **single Claude reasoning loop with tool use**. It runs in two modes (interactive research and dossier generation) but it's the same loop, same tools, different system prompts. Do not fan out into subagents-per-section — it costs more and produces worse output because sections can't cross-reference.

## Model selection rules

| Situation | Model | Why |
|---|---|---|
| Ingest pipeline (contextual prefix, claim extraction) | **Haiku** via **Batch API** | Cheap; doesn't need reasoning depth. |
| Brain interactive + dossier | **Sonnet** | Multi-hop reasoning across tools. Haiku fails here. |
| Month-to-date spend > $95 | **Force Haiku fallback** | Hard cap. `lib/claude/spend.ts` enforces. |
| Anything requiring Opus | **Reject the request** | Over-budget. Push back on the requesting feature. |

## Non-negotiable design rules

1. **Always use prompt caching.** System prompt + tool definitions are cached on every call. Cache reads cost ~10% of input price.
2. **Every `messages.create` call wraps through `lib/claude/spend.ts`.** Never call `anthropic.messages.create` directly from brain code — always via the wrapper. The wrapper reads month-to-date spend and enforces the $95 hard cap.
3. **Every output claim cites `{ documentId, chunkId?, charStart?, charEnd? }`.** The system prompt must state this as non-negotiable. If a claim can't be cited, the brain must either call more tools or mark it as a `coverageGap`.
4. **Output is always structured JSON** matching `BrainAnswer` (interactive) or `Dossier` (dossier mode) Zod schemas in `lib/brain/schemas.ts`. Interactive mode also includes a `markdown` field for chat rendering.
5. **Dossier mode populates `coverageGaps[]`** — the brain's self-assessment of sections that lack data. Critical for the team to know what's thin before delivering.

## Tool set (see `lib/brain/tools.ts` for full schemas)

- `search_people` — find persons by name/office/jurisdiction
- `get_person` — full record with terms, memberships, known IDs
- `search_documents` — hybrid BM25 + vector search over the corpus
- `get_document` — full text by ID
- `search_claims` — structured claims by subject + optional predicate
- `get_donations` — donations given/received with filters
- `get_court_cases` — court cases a person is a party to
- `get_news` — news mentions for a person
- `get_hearings` — hearing transcripts mentioning a person
- `get_public_opinion` — social media / forum / LTE posts
- `web_search` — live web search for things not in the corpus. **Use sparingly** — prefer local sources. Every `web_search` call is more expensive and less citable than a local tool call.

## System prompt skeleton (interactive mode)

```
You are Dark Horse, a political research analyst specialized in
New Orleans and Louisiana politics. You have tool access to a structured
knowledge graph of political figures, their donations, court records, news
mentions, hearings, and public opinion.

RULES:
1. Call tools to gather sources BEFORE concluding. Don't guess.
2. Every factual claim in your answer MUST include a citation
   { documentId, chunkId?, charStart?, charEnd? }.
3. If a claim can't be cited, either call more tools or omit it.
4. Prefer local tools over `web_search`. Use `web_search` only when the
   corpus clearly lacks the data.
5. Output JSON matching the BrainAnswer schema:
   { markdown: string, claims: Claim[], sourcesConsulted: DocumentRef[], nextSteps: string[] }
6. Be concise. Users are professionals; they don't need hedging or
   throat-clearing. Lead with the answer.

Louisiana political context is your specialty: the LA Ethics Board handles
campaign finance (ethics.la.gov), not the Secretary of State; Orleans Parish
judges hold section-specific positions; LA state races are covered by both
the Accountability Project CSVs and LA Ethics filings.
```

## System prompt skeleton (dossier mode)

Interactive system prompt + the dossier template:

```
ADDITIONAL DOSSIER RULES:
- Populate these sections in order: bio, politicalBackground, votingRecord,
  publicStatements, campaignFinance, personalFinance, legal, media, associations.
- Call tools aggressively — a dossier should touch most of them.
- For each section that can't be populated, add an entry to coverageGaps[]
  explaining why (no data found, data too old, paywalled, etc.).
- Output JSON matching the Dossier schema.
```

## Spend logging every call

`lib/claude/spend.ts` provides:

```typescript
await spendWrappedCall({
  service: "claude_sonnet",
  operation: "brain_interactive",
  call: () => anthropic.messages.create(...)
});
```

It:
1. Reads month-to-date spend from `ApiSpendLog`.
2. If Sonnet requested and MTD > $95, downgrades to Haiku with a warning.
3. Makes the Anthropic call.
4. Logs the `usage` (input tokens, cached tokens, output tokens) to `ApiSpendLog` with computed cost.

If you bypass this wrapper, you break the budget model. Don't.
