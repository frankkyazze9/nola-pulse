/**
 * Voice module — loads the voice guide at startup and exposes it to the
 * observation engine + journalism drafting tools.
 *
 * Source of truth: `/Users/frank/Desktop/claude-code-workspace/Frank/writing-voice/`
 * Vendored into `data/voice/` at build time (see Dockerfile's COPY data).
 *
 * The voice guide + analysis get prepended to the system prompt when the
 * brain calls `draft_in_voice` or when generating observations. Every
 * output is validated against the forbidden-word list; violations trigger
 * a single correction retry before shipping.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const VOICE_DIR = join(process.cwd(), "data", "voice");

// Hard voice rules from VOICE.md — these must not appear in any generated
// prose. Casing is loose; match any casing variant.
const FORBIDDEN_WORDS = [
  "delve",
  "landscape",
  "leverage",
  "synergy",
  "nuanced",
  "multifaceted",
  "unpack",
  // LinkedIn-speak
  "I'd be happy to",
  "certainly",
  "absolutely",
  "in today's fast-paced",
  "game-changer",
  "paradigm shift",
  "revolutionize",
  "cutting-edge",
  "at the end of the day",
  "moving forward",
  "circle back",
  "deep dive",
];

// "journey" is forbidden AS A METAPHOR for life/work/growth. Literal travel
// use is fine. We can't reliably detect metaphor statically, so we flag it
// as a soft warning rather than a hard rejection.
const SOFT_FLAG_WORDS = ["journey"];

let cachedVoiceGuide: string | null = null;
let cachedVoiceAnalysis: string | null = null;

function load(filename: string): string {
  try {
    return readFileSync(join(VOICE_DIR, filename), "utf8");
  } catch (err) {
    console.warn(
      `[voice] could not read ${filename} from ${VOICE_DIR}:`,
      err instanceof Error ? err.message : err
    );
    return "";
  }
}

/**
 * The voice guide — VOICE.md contents. The prime directive + core traits +
 * sentence architecture + hard rules.
 */
export function voiceGuide(): string {
  if (cachedVoiceGuide === null) {
    cachedVoiceGuide = load("VOICE.md");
  }
  return cachedVoiceGuide;
}

/**
 * The voice analysis — voice-analysis.md contents. Deeper analysis of voice
 * traits, patterns, and examples. Use this when we need maximum fidelity.
 */
export function voiceAnalysis(): string {
  if (cachedVoiceAnalysis === null) {
    cachedVoiceAnalysis = load("voice-analysis.md");
  }
  return cachedVoiceAnalysis;
}

/**
 * Full voice prompt — guide + analysis. Pass as a system block with
 * prompt caching enabled so re-use is cheap across many drafts.
 */
export function fullVoicePrompt(): string {
  const guide = voiceGuide();
  const analysis = voiceAnalysis();
  if (!guide && !analysis) return "";
  return [
    "## VOICE GUIDE (follow this exactly when writing prose)",
    guide,
    "",
    "## VOICE ANALYSIS (deeper reference)",
    analysis,
  ].join("\n");
}

export interface VoiceValidation {
  valid: boolean;
  violations: Array<{ type: "forbidden_word" | "em_dash" | "soft_flag"; match: string }>;
}

/**
 * Check generated text against the hard voice rules.
 * - Forbidden words → hard violation
 * - Em dashes (— or –) → hard violation (use -- instead)
 * - Soft-flag words (e.g. "journey") → warning only
 */
export function validateVoice(text: string): VoiceValidation {
  const violations: VoiceValidation["violations"] = [];
  const lower = text.toLowerCase();

  for (const w of FORBIDDEN_WORDS) {
    const needle = w.toLowerCase();
    if (lower.includes(needle)) {
      violations.push({ type: "forbidden_word", match: w });
    }
  }

  // Em dashes (both en-dash and em-dash)
  if (/[—–]/.test(text)) {
    violations.push({ type: "em_dash", match: text.match(/[—–]/)?.[0] ?? "—" });
  }

  for (const w of SOFT_FLAG_WORDS) {
    if (lower.includes(w.toLowerCase())) {
      violations.push({ type: "soft_flag", match: w });
    }
  }

  const hard = violations.filter((v) => v.type !== "soft_flag");
  return { valid: hard.length === 0, violations };
}

/**
 * Compose a correction instruction from validation output. Passed to the
 * model in a retry turn when the initial draft has hard violations.
 */
export function correctionInstruction(v: VoiceValidation): string {
  const hard = v.violations.filter((x) => x.type !== "soft_flag");
  if (hard.length === 0) return "";
  const parts: string[] = [];
  const forbidden = hard.filter((x) => x.type === "forbidden_word").map((x) => x.match);
  if (forbidden.length > 0) {
    parts.push(
      `Rewrite, removing these forbidden words: ${forbidden.map((w) => `"${w}"`).join(", ")}.`
    );
  }
  if (hard.some((x) => x.type === "em_dash")) {
    parts.push(`Replace every em dash (—) and en dash (–) with double hyphens (--).`);
  }
  return parts.join(" ");
}
