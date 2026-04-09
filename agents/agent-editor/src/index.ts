/**
 * Editor Agent — quality gate for content
 *
 * Reviews story pitches and kills anything that's:
 * - Obvious (no "crime is bad" stories)
 * - Corny (no AI comedy)
 * - Off-voice (doesn't match Frank's style)
 * - Inaccurate (numbers don't check out)
 * - Unshareable (nobody would text this to a friend)
 */

import { Agent } from "../../shared/agent-sdk";
import { readFileSync } from "fs";
import { join } from "path";

const agent = new Agent({ name: "agent-editor", version: "1.0.0", type: "analyst" });

function loadVoiceGuide(): string {
  try {
    return readFileSync(join(process.cwd(), "data", "voice.md"), "utf-8");
  } catch {
    return "";
  }
}

interface EditorVerdict {
  approved: boolean;
  headline: string;
  reason: string;
  notes: string;
  suggestedTweak: string | null;
}

async function reviewPitches(): Promise<EditorVerdict[]> {
  const voiceGuide = loadVoiceGuide();

  // Get recent pitches from Firestore
  const recentInsights = await agent.queryKB(
    `SELECT id, headline, summary, relevance, suggested_formats
     FROM nola_pulse_kb.insights
     WHERE topics LIKE '%pitch%'
     ORDER BY created_at DESC LIMIT 5`
  );

  if (recentInsights.length === 0) {
    console.log(`[${agent.name}] No pitches to review.`);
    return [];
  }

  const verdictsRaw = await agent.think(
    `You are the editor of NOLA Pulse, a New Orleans news outlet. You are the quality gate. Your job is to review story pitches and decide what gets written and what dies.

Frank's voice guide (this is LAW):
${voiceGuide}

KILL a pitch if:
- The reaction is "duh" or "so what?" — it has to be SURPRISING
- It reads like AI trying to be funny — corny, forced, trying too hard
- It doesn't match Frank's voice — too corporate, too earnest, too LinkedIn
- The data doesn't support the angle
- Nobody would share it — if it wouldn't survive a group chat, kill it
- It's been done a million times — "potholes are bad" is not a story

APPROVE a pitch if:
- It makes you go "wait, seriously?" or laugh
- It says something people are thinking but nobody's said out loud
- The data point is genuinely surprising or reveals something hidden
- You can picture someone screenshotting it
- It has that randomness that feels human, not algorithmic

Be ruthless. Better to publish nothing than publish something mid.`,
    `Review these pitches and return a JSON array of verdicts:

${JSON.stringify(recentInsights, null, 2)}

For each pitch, return:
{
  "approved": true/false,
  "headline": "the headline",
  "reason": "why you approved or killed it (be specific)",
  "notes": "any notes for the writer if approved",
  "suggestedTweak": "how to make it better, or null"
}

Return ONLY the JSON array.`,
    { maxTokens: 2000 }
  );

  let verdicts: EditorVerdict[];
  try {
    verdicts = JSON.parse(verdictsRaw);
  } catch {
    verdicts = JSON.parse(verdictsRaw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
  }

  return verdicts;
}

async function main() {
  await agent.run(async () => {
    console.log(`[${agent.name}] Reviewing pitches...`);

    const verdicts = await reviewPitches();

    const approved = verdicts.filter((v) => v.approved);
    const killed = verdicts.filter((v) => !v.approved);

    console.log(`\n[${agent.name}] Results: ${approved.length} approved, ${killed.length} killed\n`);

    for (const v of verdicts) {
      const icon = v.approved ? "✓" : "✗";
      console.log(`  ${icon} "${v.headline}"`);
      console.log(`    ${v.reason}`);
      if (v.suggestedTweak) console.log(`    Tweak: ${v.suggestedTweak}`);
      console.log();
    }

    // Store approved pitches as content drafts for the punch-up writer
    for (const v of approved) {
      await agent.submitInsight({
        type: "story",
        headline: v.headline,
        summary: `EDITOR APPROVED: ${v.reason}\n\nNotes for writer: ${v.notes}\n${v.suggestedTweak ? `Suggested tweak: ${v.suggestedTweak}` : ""}`,
        dataPoints: [],
        relevance: 95,
        topics: ["approved"],
        suggestedFormats: ["article"],
      });
    }
  });
}

export { main, reviewPitches };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
