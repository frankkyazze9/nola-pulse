/**
 * The Dark Horse Brain — Claude tool-use reasoning loop.
 *
 * Two public entry points wrap the same loop:
 *   - runBrainInteractive(question)   — conversational research mode
 *   - generateDossier(personId)       — full 9-section oppo-research dossier
 *
 * The loop:
 *   1. Send the user's question with the tool definitions and system prompt
 *      (both prompt-cached).
 *   2. While the model returns tool_use blocks, execute the matching handler
 *      and feed the result back as a user tool_result message.
 *   3. When the model returns a final text block, parse it as JSON and
 *      validate against BrainAnswerSchema (interactive) or DossierSchema
 *      (dossier). One retry on bad JSON.
 *
 * Every call is routed through `callClaude()` so spend is logged and the
 * $100/mo cap is enforced. The system prompt and tool list each get an
 * ephemeral cache breakpoint — cache reads are ~10% of input price and are
 * the single biggest cost lever for this app.
 *
 * See `.claude/skills/brain-prompt/SKILL.md` for the contract.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { callClaude } from "../claude/spend";
import { findTool, TOOLS } from "./tools";
import {
  BrainAnswerSchema,
  DossierSchema,
  type BrainAnswer,
  type Dossier,
} from "./schemas";

const SONNET_MODEL = "claude-sonnet-4-6";
const MAX_TOOL_ITERATIONS = 15;
const INTERACTIVE_MAX_TOKENS = 8_192;
const DOSSIER_MAX_TOKENS = 16_384;

const BRAIN_BASE_SYSTEM = `You are Dark Horse, a political research analyst specialized in New Orleans and Louisiana politics. You have tool access to a structured knowledge graph of political figures, their donations, court records, news mentions, public hearings, and public opinion.

RULES:
1. Call tools to gather sources BEFORE concluding. Do not guess.
2. Every factual claim in your final answer MUST cite { documentId, chunkId?, charStart?, charEnd? } from a tool result.
3. If a claim cannot be cited, either call more tools or omit it.
4. Prefer local tools over web_search. Use web_search only when the corpus clearly lacks the data — every web_search is expensive and less citable.
5. Be concise. Users are professionals; they do not need hedging or throat-clearing. Lead with the answer.
6. Your FINAL message (after all tool calls) MUST be valid JSON only — no markdown fences, no prose around it — matching the schema for this mode.

Louisiana political context you already know:
- The LA Ethics Board handles state campaign finance at ethics.la.gov; the Secretary of State does not.
- Orleans Parish judges hold section-specific positions (e.g. "Civil District Court, Section A").
- Pre-2022 LA donations come from the Accountability Project CSV imports under sourceSystem "la_ethics_bootstrap"; 2022+ come from "la_ethics" filings.
- NOLA Council hearings live under sourceSystem "nola_council" with docType "hearing_transcript".
- GDELT and RSS feeds populate news under sourceSystems "gdelt", "rss", and outlet-specific slugs like "louisiana_illuminator".`;

const INTERACTIVE_SCHEMA_HINT = `
FINAL OUTPUT SCHEMA (BrainAnswer):
{
  "markdown": string,                                // sourced markdown answer
  "claims": [
    {
      "subject": string,
      "predicate": string,
      "objectText": string,
      "confidence": number,                          // 0.0–1.0
      "sources": [
        { "documentId": string, "chunkId"?: string, "charStart"?: number, "charEnd"?: number, "quote"?: string }
      ]                                              // at least 1
    }
  ],
  "sourcesConsulted": [
    { "documentId": string, "chunkId"?: string, "title"?: string, "sourceUrl"?: string, "sourceSystem"?: string, "publishedAt"?: string }
  ],
  "nextSteps": [string]                              // what the analyst should do next
}`;

const DOSSIER_SCHEMA_HINT = `
ADDITIONAL DOSSIER RULES:
- Populate these sections in order: bio, politicalBackground, votingRecord, publicStatements, campaignFinance, personalFinance, legal, media, associations.
- Call tools aggressively — a complete dossier should touch most of them.
- For each section that cannot be populated, add an entry to coverageGaps explaining why (no data, data too old, paywalled, requires manual review, etc.). Do not fabricate.

FINAL OUTPUT SCHEMA (Dossier):
{
  "personId": string,
  "personName": string,
  "generatedAt": string,                             // ISO timestamp
  "sections": {
    "bio":                  { "narrative": string, "claims": Claim[] },
    "politicalBackground":  { "narrative": string, "claims": Claim[] },
    "votingRecord":         { "narrative": string, "claims": Claim[] },
    "publicStatements":     { "narrative": string, "claims": Claim[] },
    "campaignFinance":      { "narrative": string, "claims": Claim[] },
    "personalFinance":      { "narrative": string, "claims": Claim[] },
    "legal":                { "narrative": string, "claims": Claim[] },
    "media":                { "narrative": string, "claims": Claim[] },
    "associations":         { "narrative": string, "claims": Claim[] }
  },
  "sourcesConsulted": DocumentRef[],
  "coverageGaps": [ { "section": string, "reason": string } ]
}
Each Claim = { subject, predicate, objectText, confidence, sources: ClaimRef[] (>=1) }`;

type Tool = Anthropic.Messages.Tool;
type MessageParam = Anthropic.Messages.MessageParam;
type ContentBlock = Anthropic.Messages.ContentBlock;
type ToolUseBlock = Extract<ContentBlock, { type: "tool_use" }>;
type TextBlock = Extract<ContentBlock, { type: "text" }>;
type ToolResultBlockParam = Anthropic.Messages.ToolResultBlockParam;

/** Anthropic API shape for our tool list, with ephemeral cache on the last tool. */
function buildApiTools(): Tool[] {
  const out: Tool[] = TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Tool["input_schema"],
  }));
  if (out.length > 0) {
    out[out.length - 1] = {
      ...out[out.length - 1],
      cache_control: { type: "ephemeral" },
    };
  }
  return out;
}

/** Execute one tool_use block and produce a tool_result content block. */
async function runTool(block: ToolUseBlock): Promise<ToolResultBlockParam> {
  const tool = findTool(block.name);
  if (!tool) {
    return {
      type: "tool_result",
      tool_use_id: block.id,
      is_error: true,
      content: `Unknown tool: ${block.name}`,
    };
  }
  try {
    const result = await tool.handler(block.input as Record<string, unknown>);
    return {
      type: "tool_result",
      tool_use_id: block.id,
      content: JSON.stringify(result ?? null),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      type: "tool_result",
      tool_use_id: block.id,
      is_error: true,
      content: `Tool ${block.name} failed: ${message}`,
    };
  }
}

interface LoopOptions {
  operation: "brain_interactive" | "brain_dossier";
  systemText: string;
  initialUserMessage: string;
  maxTokens: number;
}

async function runToolUseLoop(opts: LoopOptions): Promise<string> {
  const apiTools = buildApiTools();
  const messages: MessageParam[] = [
    { role: "user", content: opts.initialUserMessage },
  ];

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const response = await callClaude({
      operation: opts.operation,
      params: {
        model: SONNET_MODEL,
        max_tokens: opts.maxTokens,
        temperature: 0.2,
        system: [
          {
            type: "text",
            text: opts.systemText,
            cache_control: { type: "ephemeral" },
          },
        ],
        tools: apiTools,
        messages,
      },
      metadata: { iteration },
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") {
      return extractFinalText(response.content);
    }

    const toolUses = response.content.filter(
      (b): b is ToolUseBlock => b.type === "tool_use"
    );
    if (toolUses.length === 0) {
      return extractFinalText(response.content);
    }

    const toolResults: ToolResultBlockParam[] = [];
    for (const block of toolUses) {
      toolResults.push(await runTool(block));
    }
    messages.push({ role: "user", content: toolResults });
  }

  throw new Error(
    `Brain exceeded ${MAX_TOOL_ITERATIONS} tool-use iterations without reaching a final answer.`
  );
}

function extractFinalText(content: ContentBlock[]): string {
  const text = content
    .filter((b): b is TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  if (!text) {
    throw new Error("Brain returned no text content in final message.");
  }
  return text;
}

/**
 * Strip any accidental markdown fences / prose wrapping and return the JSON
 * substring, or the original string if no fence is detected.
 */
function stripJsonFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) return fenced[1].trim();
  // Fall back to the first `{...}` span if there is prose around it.
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return text;
}

// --- Public entry points ----------------------------------------------------

export async function runBrainInteractive(question: string): Promise<BrainAnswer> {
  const systemText = `${BRAIN_BASE_SYSTEM}\n\n${INTERACTIVE_SCHEMA_HINT}`;
  const rawText = await runToolUseLoop({
    operation: "brain_interactive",
    systemText,
    initialUserMessage: question,
    maxTokens: INTERACTIVE_MAX_TOKENS,
  });
  return parseAndValidate(rawText, BrainAnswerSchema, {
    operation: "brain_interactive",
    systemText,
    priorPrompt: question,
    maxTokens: INTERACTIVE_MAX_TOKENS,
  }) as Promise<BrainAnswer>;
}

export async function generateDossier(personId: string): Promise<Dossier> {
  const systemText = `${BRAIN_BASE_SYSTEM}\n\n${DOSSIER_SCHEMA_HINT}`;
  const userMessage =
    `Generate a complete opposition-research dossier on the person with internal ID "${personId}". ` +
    `Start by resolving the person via get_person, then walk every relevant tool — donations, court cases, ` +
    `news, hearings, public opinion, claims — before writing the dossier. Fill coverageGaps[] honestly for ` +
    `any section that lacks enough data.`;

  const rawText = await runToolUseLoop({
    operation: "brain_dossier",
    systemText,
    initialUserMessage: userMessage,
    maxTokens: DOSSIER_MAX_TOKENS,
  });
  return parseAndValidate(rawText, DossierSchema, {
    operation: "brain_dossier",
    systemText,
    priorPrompt: userMessage,
    maxTokens: DOSSIER_MAX_TOKENS,
  }) as Promise<Dossier>;
}

interface RetryContext {
  operation: "brain_interactive" | "brain_dossier";
  systemText: string;
  priorPrompt: string;
  maxTokens: number;
}

async function parseAndValidate<T>(
  rawText: string,
  schema: { safeParse: (x: unknown) => { success: boolean; data?: T; error?: unknown } },
  retry: RetryContext
): Promise<T> {
  const parsed = tryParse(rawText);
  if (parsed !== undefined) {
    const v = schema.safeParse(parsed);
    if (v.success && v.data !== undefined) return v.data;
  }

  // One retry: ask the model to re-emit strictly-valid JSON.
  const retryResponse = await callClaude({
    operation: retry.operation,
    params: {
      model: SONNET_MODEL,
      max_tokens: retry.maxTokens,
      temperature: 0,
      system: [
        { type: "text", text: retry.systemText, cache_control: { type: "ephemeral" } },
      ],
      messages: [
        { role: "user", content: retry.priorPrompt },
        { role: "assistant", content: rawText },
        {
          role: "user",
          content:
            "The previous response was not valid JSON for the required schema. " +
            "Re-emit ONLY the JSON object (no markdown fences, no prose) that matches the schema exactly.",
        },
      ],
    },
    metadata: { retry: true },
  });
  const retryText = extractFinalText(retryResponse.content);
  const parsed2 = tryParse(retryText);
  if (parsed2 !== undefined) {
    const v = schema.safeParse(parsed2);
    if (v.success && v.data !== undefined) return v.data;
  }

  throw new Error(
    `Brain output failed schema validation after retry. Last raw text: ${retryText.slice(0, 500)}`
  );
}

function tryParse(text: string): unknown | undefined {
  const cleaned = stripJsonFences(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    return undefined;
  }
}
