/**
 * Claude call wrapper with spend tracking and hard-cap enforcement.
 *
 * ALL Claude calls in Dark Horse MUST go through `callClaude()`. This is the
 * single choke point that:
 *   1. Reads month-to-date spend from ApiSpendLog before the call.
 *   2. Refuses Sonnet/Opus calls above the $95 soft cap, downgrading to Haiku.
 *   3. Refuses all calls above the $100 hard cap (throws SpendCapExceededError).
 *   4. Logs the real token usage + computed cost after the call.
 *
 * See `.claude/skills/brain-prompt/SKILL.md` and
 * `.claude/skills/cost-discipline/SKILL.md`.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  getMonthToDateSpend,
  logSpend,
  SPEND_CAPS,
  type Operation,
  type Service,
} from "../spend";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

type MessageCreateParams = Anthropic.Messages.MessageCreateParamsNonStreaming;
type MessageResponse = Anthropic.Messages.Message;

export class SpendCapExceededError extends Error {
  constructor(public monthToDate: number, public cap: number) {
    super(
      `Dark Horse monthly spend cap exceeded: $${monthToDate.toFixed(2)} >= $${cap}. ` +
        `Blocking further non-essential LLM calls until next month.`
    );
    this.name = "SpendCapExceededError";
  }
}

export interface ClaudeCallOptions {
  operation: Operation;
  params: MessageCreateParams;
  /** If true, throw above the hard cap. Default true. */
  enforceCap?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Wrap `anthropic.messages.create` with budget enforcement + spend logging.
 */
export async function callClaude(options: ClaudeCallOptions): Promise<MessageResponse> {
  const enforceCap = options.enforceCap ?? true;
  const mtd = await getMonthToDateSpend();

  if (enforceCap && mtd >= SPEND_CAPS.monthlyHardCap) {
    throw new SpendCapExceededError(mtd, SPEND_CAPS.monthlyHardCap);
  }

  let params = options.params;
  const originalModel = params.model;
  const isExpensiveModel = originalModel.includes("sonnet") || originalModel.includes("opus");

  if (mtd >= SPEND_CAPS.sonnetSoftCap && isExpensiveModel) {
    params = { ...params, model: "claude-haiku-4-5-20251001" };
    console.warn(
      `[spend] month-to-date $${mtd.toFixed(2)} >= soft cap $${SPEND_CAPS.sonnetSoftCap}; ` +
        `forcing Haiku fallback (was ${originalModel})`
    );
  }

  const response = await anthropic.messages.create(params);
  const service = serviceForModel(params.model);

  await logSpend({
    service,
    operation: options.operation,
    usage: {
      inputTokens:
        response.usage.input_tokens + (response.usage.cache_creation_input_tokens ?? 0),
      cachedInputTokens: response.usage.cache_read_input_tokens ?? 0,
      outputTokens: response.usage.output_tokens,
    },
    metadata: {
      model: params.model,
      ...(originalModel !== params.model ? { originalModel } : {}),
      ...options.metadata,
    },
  });

  return response;
}

function serviceForModel(model: string): Service {
  if (model.includes("haiku")) return "claude_haiku";
  if (model.includes("opus")) return "claude_opus";
  return "claude_sonnet";
}
