/**
 * Observation Engine — reads recent documents, triages for observation-
 * worthiness, generates typed observations (pattern / hypothesis / comedy)
 * in the house voice, persists to the Observation table.
 *
 * See `.claude/memory/reference_observation_and_comedy.md` for definitions
 * of what counts as an observation and what counts as comedy.
 *
 * Pipeline:
 *   1. Candidate set: documents ingested in the last N hours, grouped by
 *      sourceSystem + topic inferred from title (rough).
 *   2. Triage (Haiku): score each candidate 0..1 on four axes — pattern
 *      deviation, absurdity, hidden obvious, underreported angle. Pass if
 *      any axis >= 0.6.
 *   3. Generate (Sonnet + voice): for each passing candidate, produce up to
 *      3 typed observations. Refuses to produce observations without
 *      source backing. Comedy obs only when content actually warrants it.
 *   4. Persist: save Observation + ObservationSource rows.
 */

import { prisma } from "../db";
import { callClaude } from "../claude/spend";
import { validateVoice, correctionInstruction, fullVoicePrompt } from "../voice";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const SONNET_MODEL = "claude-sonnet-4-6";

const TRIAGE_SYSTEM = `You are the triage filter for a political OSINT observation engine. Your job is to rapidly score whether a news document is worth generating observations about.

Score on four axes, each 0.0–1.0:
- pattern_deviation: does this contain something statistically unusual — disproportionate attention, a missing expected signal, a 10x shift?
- absurdity: does this contain a structural contradiction, a hidden-in-plain-sight disproportion, a thing that's obviously obvious but unsaid?
- hidden_obvious: does this contain a truth that nobody is naming plainly — something the reader would recognize as "I knew this but no one said it"?
- underreported_angle: is there a pattern AROUND the reported story (who benefits, who's silent, what's missing) that matters more than the story itself?

Routine coverage (straight news, sports, weather, crime blotter with no context) scores near-zero on all axes. Pass only if at least one axis >= 0.6.

Return STRICT JSON: { "pattern_deviation": 0.0, "absurdity": 0.0, "hidden_obvious": 0.0, "underreported_angle": 0.0, "reason": "one-sentence why or why not", "topic_tag": "kebab-case-topic" }`;

interface TriageScore {
  pattern_deviation: number;
  absurdity: number;
  hidden_obvious: number;
  underreported_angle: number;
  reason: string;
  topic_tag: string;
}

const OBS_GEN_GUIDE = `You are the Observation Engine for Dark Horse, generating observations on ingested documents.

Three types, in descending evidentiary weight:
1. pattern — factual, sourced. State the pattern. Use numbers when possible.
2. hypothesis — sourced but unfalsified. An educated guess the data suggests but doesn't prove. Mark it as hypothesis.
3. comedy — the art of surprise. Name an absurdity, contradiction, or hidden-obvious plainly. Content is the joke. NO dad jokes. NO jokes ABOUT the content — the observation IS the punchline. Sometimes it's sad, that's fine.

Hard rules:
- Each observation is 1-4 sentences. Short.
- Do not produce an observation of a type the content doesn't support. If the content isn't funny, don't force comedy.
- Cite sources by quoting a 5-15 word phrase from the source chunk that anchors the claim. One quote per observation minimum.
- No preamble like "Here's my observation" — start with the observation.
- No em dashes. Use double hyphens (--).
- Forbidden words: delve, landscape (metaphor), leverage, synergy, nuanced, multifaceted, unpack, journey (metaphor), LinkedIn-speak, AI-isms.

Output STRICT JSON array of at most 3 observations:
[
  {
    "type": "pattern" | "hypothesis" | "comedy",
    "text": "...",
    "confidence": 0.0..1.0,
    "topic": "kebab-case",
    "quote": "exact phrase from source"
  }
]

Return [] if nothing in the source warrants an observation.`;

export interface GenerateOptions {
  /** Lookback window in hours. Default 24. */
  sinceHours?: number;
  /** Max number of source documents to process. Default 20. */
  limit?: number;
  /** Skip triage and force generation on all candidates (for small runs). */
  skipTriage?: boolean;
}

export interface GenerateResult {
  candidatesExamined: number;
  passedTriage: number;
  observationsCreated: number;
  skipped: string[];
}

export async function runObservationPass(
  opts: GenerateOptions = {}
): Promise<GenerateResult> {
  const sinceHours = opts.sinceHours ?? 24;
  const limit = opts.limit ?? 20;
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);

  // Candidate pool: recent documents from the news-oriented sources
  const candidates = await prisma.document.findMany({
    where: {
      collectedAt: { gte: since },
      sourceSystem: {
        in: [
          "louisiana_illuminator",
          "the_lens_nola",
          "verite_news",
          "nola_com",
          "gambit",
          "wwno",
          "wdsu",
          "wwltv",
          "fox8live",
          "louisiana_weekly",
          "gdelt",
          "bluesky",
          "fb_ads",
          "courtlistener",
          "ballotpedia",
        ],
      },
    },
    orderBy: { collectedAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      sourceSystem: true,
      sourceUrl: true,
      textContent: true,
      publishedAt: true,
    },
  });

  const result: GenerateResult = {
    candidatesExamined: candidates.length,
    passedTriage: 0,
    observationsCreated: 0,
    skipped: [],
  };

  for (const doc of candidates) {
    if (!doc.textContent || doc.textContent.length < 200) {
      result.skipped.push(`${doc.id} (too short)`);
      continue;
    }

    // Trim to first 2K chars for triage — saves tokens
    const excerpt = doc.textContent.slice(0, 2000);

    let score: TriageScore | null = null;
    if (!opts.skipTriage) {
      try {
        score = await triage(doc.title ?? "(untitled)", excerpt);
      } catch (err) {
        console.error(`[observation] triage failed for ${doc.id}:`, err);
        result.skipped.push(`${doc.id} (triage error)`);
        continue;
      }

      const maxAxis = Math.max(
        score.pattern_deviation,
        score.absurdity,
        score.hidden_obvious,
        score.underreported_angle
      );
      if (maxAxis < 0.6) {
        result.skipped.push(`${doc.id} (triage: ${score.reason})`);
        continue;
      }
    }

    result.passedTriage++;

    // Generate observations
    try {
      const observations = await generate(
        doc.title ?? "(untitled)",
        excerpt,
        score?.topic_tag ?? inferTopic(doc.title ?? "")
      );

      for (const obs of observations) {
        const validation = validateVoice(obs.text);
        if (!validation.valid) {
          console.warn(
            `[observation] ${doc.id}: voice violations, skipping observation:`,
            validation.violations.map((v) => v.match).join(", ")
          );
          continue;
        }

        await prisma.observation.create({
          data: {
            type: obs.type,
            text: obs.text,
            confidence: obs.confidence,
            topic: obs.topic,
            status: "draft",
            sources: {
              create: [
                {
                  documentId: doc.id,
                  quote: obs.quote ?? null,
                },
              ],
            },
          },
        });
        result.observationsCreated++;
      }
    } catch (err) {
      console.error(`[observation] generation failed for ${doc.id}:`, err);
      result.skipped.push(`${doc.id} (generation error)`);
    }
  }

  return result;
}

async function triage(title: string, excerpt: string): Promise<TriageScore> {
  const response = await callClaude({
    operation: "observation_triage",
    params: {
      model: HAIKU_MODEL,
      max_tokens: 400,
      temperature: 0,
      system: [{ type: "text", text: TRIAGE_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: `Title: ${title}\n\nExcerpt:\n${excerpt}`,
        },
      ],
    },
  });
  const text = extractText(response.content);
  const parsed = stripJsonAndParse(text) as Record<string, unknown>;
  return {
    pattern_deviation: num(parsed.pattern_deviation),
    absurdity: num(parsed.absurdity),
    hidden_obvious: num(parsed.hidden_obvious),
    underreported_angle: num(parsed.underreported_angle),
    reason: String(parsed.reason ?? ""),
    topic_tag: String(parsed.topic_tag ?? "misc"),
  };
}

interface GeneratedObs {
  type: "pattern" | "hypothesis" | "comedy";
  text: string;
  confidence: number;
  topic: string;
  quote?: string;
}

async function generate(
  title: string,
  excerpt: string,
  topic: string
): Promise<GeneratedObs[]> {
  const voiceGuide = fullVoicePrompt();
  const system =
    `${voiceGuide}\n\n---\n\n${OBS_GEN_GUIDE}\n\nContext topic tag: ${topic}`;

  const response = await callClaude({
    operation: "observation_generate",
    params: {
      model: SONNET_MODEL,
      max_tokens: 2000,
      temperature: 0.7,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: `Title: ${title}\n\nSource:\n${excerpt}\n\nGenerate observations per the rules above. Return [] if nothing warrants observation.`,
        },
      ],
    },
    metadata: { topic },
  });
  const text = extractText(response.content);
  const raw = stripJsonAndParse(text);
  if (!Array.isArray(raw)) return [];

  const out: GeneratedObs[] = [];
  for (const r of raw) {
    if (typeof r !== "object" || r === null) continue;
    const o = r as Record<string, unknown>;
    const type = String(o.type);
    if (!["pattern", "hypothesis", "comedy"].includes(type)) continue;
    const t = String(o.text ?? "").trim();
    if (!t) continue;
    out.push({
      type: type as GeneratedObs["type"],
      text: t,
      confidence: num(o.confidence, 0.7),
      topic: String(o.topic ?? topic),
      quote: o.quote ? String(o.quote) : undefined,
    });
  }
  return out.slice(0, 3);
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

function stripJsonAndParse(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const body = fenced ? fenced[1] : text;
  // Try parsing as-is first
  try {
    return JSON.parse(body);
  } catch {
    // Fall back to span extraction
    const first = Math.min(
      ...[body.indexOf("["), body.indexOf("{")].filter((i) => i >= 0)
    );
    const last = Math.max(body.lastIndexOf("]"), body.lastIndexOf("}"));
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(body.slice(first, last + 1));
      } catch {
        return {};
      }
    }
    return {};
  }
}

function num(v: unknown, d = 0): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : d;
}

function inferTopic(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .split(/\s+/)
    .slice(0, 3)
    .join("-")
    .slice(0, 40);
}

// Keep unused import happy — correctionInstruction is available for future
// retry logic but not used in this first cut.
void correctionInstruction;
