/**
 * SSE streaming wrapper for the brain's tool-use loop.
 *
 * Emits events as the brain works so the UI can show progress:
 *   - { type: "tool_call", name, input }       — brain is calling a tool
 *   - { type: "tool_result", name, preview }    — tool returned data
 *   - { type: "thinking", iteration }           — brain is reasoning
 *   - { type: "answer", data }                  — final validated BrainAnswer
 *   - { type: "error", message }                — something went wrong
 *
 * Uses the same callClaude / tool infrastructure as runner.ts but yields
 * events via a ReadableStream instead of returning a single Promise.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { callClaude, SpendCapExceededError } from "../claude/spend";
import { findTool, TOOLS } from "./tools";
import { BrainAnswerSchema } from "./schemas";

const SONNET_MODEL = "claude-sonnet-4-6";
const MAX_TOOL_ITERATIONS = 15;
const INTERACTIVE_MAX_TOKENS = 8_192;

const BRAIN_BASE_SYSTEM = `You are Dark Horse, a research analyst for Last Word Strategies specialized in New Orleans and Louisiana politics. You have tool access to a structured knowledge graph of political figures, their donations, court records, news mentions, public hearings, and public opinion.

RULES:
1. Call tools to gather sources BEFORE concluding. Do not guess.
2. Every factual claim in your final answer MUST cite { documentId, chunkId?, charStart?, charEnd? } from a tool result.
3. If a claim cannot be cited, either call more tools or omit it.
4. Prefer local tools over web_search. Use web_search only when the corpus clearly lacks the data — every web_search is expensive and less citable.
5. Be concise. Christine is a professional; she does not need hedging or throat-clearing. Lead with the answer.
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
  "markdown": string,
  "claims": [
    {
      "subject": string,
      "predicate": string,
      "objectText": string,
      "confidence": number,
      "sources": [
        { "documentId": string, "chunkId"?: string, "charStart"?: number, "charEnd"?: number, "quote"?: string }
      ]
    }
  ],
  "sourcesConsulted": [
    { "documentId": string, "chunkId"?: string, "title"?: string, "sourceUrl"?: string, "sourceSystem"?: string, "publishedAt"?: string }
  ],
  "nextSteps": [string]
}`;

type Tool = Anthropic.Messages.Tool;
type MessageParam = Anthropic.Messages.MessageParam;
type ContentBlock = Anthropic.Messages.ContentBlock;
type ToolUseBlock = Extract<ContentBlock, { type: "tool_use" }>;
type TextBlock = Extract<ContentBlock, { type: "text" }>;
type ToolResultBlockParam = Anthropic.Messages.ToolResultBlockParam;

export interface BrainStreamEvent {
  type: "tool_call" | "tool_result" | "thinking" | "answer" | "error";
  [key: string]: unknown;
}

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

async function runToolBlock(block: ToolUseBlock): Promise<ToolResultBlockParam> {
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

function stripJsonFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) return fenced[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return text;
}

/**
 * Stream the brain's interactive reasoning loop as SSE events.
 * Returns a ReadableStream suitable for a Response body.
 */
export function streamBrainInteractive(question: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const systemText = `${BRAIN_BASE_SYSTEM}\n\n${INTERACTIVE_SCHEMA_HINT}`;
  const apiTools = buildApiTools();

  return new ReadableStream({
    async start(controller) {
      function emit(event: BrainStreamEvent) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      try {
        const messages: MessageParam[] = [
          { role: "user", content: question },
        ];

        for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
          emit({ type: "thinking", iteration });

          const response = await callClaude({
            operation: "brain_interactive",
            params: {
              model: SONNET_MODEL,
              max_tokens: INTERACTIVE_MAX_TOKENS,
              temperature: 0.2,
              system: [
                {
                  type: "text",
                  text: systemText,
                  cache_control: { type: "ephemeral" },
                },
              ],
              tools: apiTools,
              messages,
            },
            metadata: { iteration, streaming: true },
          });

          messages.push({ role: "assistant", content: response.content });

          if (response.stop_reason !== "tool_use") {
            const rawText = response.content
              .filter((b): b is TextBlock => b.type === "text")
              .map((b) => b.text)
              .join("\n")
              .trim();

            const parsed = tryParseAnswer(rawText);
            if (parsed) {
              emit({ type: "answer", data: parsed });
            } else {
              emit({
                type: "answer",
                data: {
                  markdown: rawText,
                  claims: [],
                  sourcesConsulted: [],
                  nextSteps: [],
                },
              });
            }
            break;
          }

          const toolUses = response.content.filter(
            (b): b is ToolUseBlock => b.type === "tool_use"
          );

          const toolResults: ToolResultBlockParam[] = [];
          for (const block of toolUses) {
            emit({
              type: "tool_call",
              name: block.name,
              input: block.input,
            });
            const result = await runToolBlock(block);
            const preview = truncatePreview(
              typeof result.content === "string" ? result.content : ""
            );
            emit({
              type: "tool_result",
              name: block.name,
              preview,
              isError: result.is_error ?? false,
            });
            toolResults.push(result);
          }
          messages.push({ role: "user", content: toolResults });
        }
      } catch (err) {
        if (err instanceof SpendCapExceededError) {
          emit({
            type: "error",
            message: err.message,
            code: "spend_cap_exceeded",
          });
        } else {
          const message = err instanceof Error ? err.message : String(err);
          emit({ type: "error", message });
        }
      } finally {
        controller.close();
      }
    },
  });
}

function tryParseAnswer(rawText: string): unknown | null {
  try {
    const cleaned = stripJsonFences(rawText);
    const parsed = JSON.parse(cleaned);
    const v = BrainAnswerSchema.safeParse(parsed);
    if (v.success) return v.data;
    return parsed;
  } catch {
    return null;
  }
}

function truncatePreview(text: string, maxLen = 200): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}
