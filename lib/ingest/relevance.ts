/**
 * Pre-ingest relevance classifier.
 *
 * Dark Horse isn't a news farm — it's a political/policy/government research
 * platform for Louisiana and New Orleans. This classifier runs before the
 * expensive chunking + embedding + claim extraction pipeline. If the document
 * isn't relevant, we skip ingestion entirely.
 *
 * Classification uses Haiku (cheap, fast) with a compact system prompt.
 *
 * Scoring:
 *   1.0  — Directly about LA/NOLA politics, policy, government, elections,
 *          courts, campaign finance, public records, public safety policy,
 *          housing/infrastructure policy, ethics filings.
 *   0.7-0.9 — Political/policy context that mentions LA actors but the
 *             piece is primarily national (still usually worth keeping).
 *   0.4-0.6 — Tangential: local business/economic news with policy
 *             implications, cultural institutions that intersect with
 *             government.
 *   0.0-0.3 — Sports, weather, crime blotter without policy angle,
 *             entertainment, general lifestyle.
 *
 * Default threshold: 0.5. Below that, we skip.
 */

import { callClaude } from "../claude/spend";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";

const RELEVANCE_SYSTEM = `You are the relevance filter for Dark Horse, a Louisiana political and OSINT research platform.

Your ONLY job: score how relevant a document is to political research on Louisiana or New Orleans. Return STRICT JSON: { "score": 0.0-1.0, "reason": "one-sentence why", "topic": "kebab-case topic" }.

KEEP (score >= 0.5):
- Louisiana/NOLA politicians, candidates, elected officials, appointees
- Louisiana Legislature, Orleans Parish Council, LA state agencies
- Campaign finance, elections, qualifying periods, political ads
- Courts: judges, DA, sheriff, court reform, judicial restructuring
- Public records, ethics filings, transparency
- Policy decisions: housing, infrastructure, public safety, education funding
- Lobbying, PACs, political organizing
- Federal politics affecting Louisiana directly
- Investigative journalism on LA power structures
- Public corruption, scandals, misconduct by officials

DROP (score < 0.5):
- Sports, team management, athletic departments (unless about public funding/NIL policy)
- Weather, traffic, routine events
- Crime blotter without policy/systemic angle
- Entertainment, festivals, food, culture (unless political)
- Business news unrelated to policy or political figures
- National news with no LA nexus
- Health/medical unless it's policy
- Obituaries, society, lifestyle

Edge cases: LSU athletic department spending bills = KEEP (it's a public records policy story, not sports). Coverage of a hurricane response = KEEP (it's government capacity). A wrong-organ medical malpractice case = DROP (not policy).

Return ONLY the JSON, no preamble.`;

export interface RelevanceScore {
  score: number;
  reason: string;
  topic: string;
}

export async function classifyRelevance(
  title: string,
  excerpt: string
): Promise<RelevanceScore> {
  const response = await callClaude({
    operation: "ingest_relevance",
    params: {
      model: HAIKU_MODEL,
      max_tokens: 200,
      temperature: 0,
      system: [{ type: "text", text: RELEVANCE_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: `Title: ${title || "(untitled)"}\n\nExcerpt:\n${excerpt.slice(0, 1500)}`,
        },
      ],
    },
  });
  const text = response.content
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join("\n");
  return parseScore(text);
}

function parseScore(text: string): RelevanceScore {
  const fallback: RelevanceScore = { score: 0.5, reason: "parse failure", topic: "unknown" };
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const body = fenced ? fenced[1] : text;
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed === "object" && parsed !== null) {
      return {
        score: typeof parsed.score === "number"
          ? parsed.score
          : parseFloat(String(parsed.score ?? 0.5)) || 0.5,
        reason: String(parsed.reason ?? ""),
        topic: String(parsed.topic ?? "unknown"),
      };
    }
  } catch {
    // try to extract JSON object span
    const first = body.indexOf("{");
    const last = body.lastIndexOf("}");
    if (first >= 0 && last > first) {
      try {
        const parsed = JSON.parse(body.slice(first, last + 1));
        return {
          score: typeof parsed.score === "number" ? parsed.score : 0.5,
          reason: String(parsed.reason ?? ""),
          topic: String(parsed.topic ?? "unknown"),
        };
      } catch {
        return fallback;
      }
    }
  }
  return fallback;
}
