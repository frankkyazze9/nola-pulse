/**
 * Punch-Up Writer — writes the final piece in Frank's voice
 *
 * Takes editor-approved pitches and turns them into publishable content.
 * VOICE.md is the bible. If it sounds like AI wrote it, burn it.
 */

import { Agent } from "../../shared/agent-sdk";
import { readFileSync } from "fs";
import { join } from "path";

const agent = new Agent({ name: "agent-punchup", version: "1.0.0", type: "creator" });

function loadVoiceGuide(): string {
  try {
    return readFileSync(join(process.cwd(), "data", "voice.md"), "utf-8");
  } catch {
    return "";
  }
}

async function main() {
  await agent.run(async () => {
    console.log(`[${agent.name}] Looking for approved pitches...`);

    const voiceGuide = loadVoiceGuide();

    // Get editor-approved pitches
    const approved = await agent.queryKB(
      `SELECT id, headline, summary
       FROM nola_pulse_kb.insights
       WHERE topics LIKE '%approved%'
       ORDER BY created_at DESC LIMIT 3`
    );

    if (approved.length === 0) {
      console.log(`[${agent.name}] No approved pitches. Run the reporter and editor first.`);
      return;
    }

    for (const pitch of approved) {
      const p = pitch as any;
      console.log(`[${agent.name}] Writing: "${p.headline}"`);

      // Get supporting data
      const supportingData = await agent.queryKB(
        `SELECT request_type, COUNT(*) as c FROM nola_pulse_kb.service_requests_311
         WHERE request_type IS NOT NULL GROUP BY request_type ORDER BY c DESC LIMIT 5`
      );

      const article = await agent.think(
        `You are writing for NOLA Pulse. You ARE Frank Kyazze. Follow this voice guide with absolute fidelity — if you deviate, the piece dies:

${voiceGuide}

Additional rules for this piece:
- This is a news outlet, not a comedy blog. You don't announce that you're being funny.
- The humor comes from HOW you deliver facts, not from trying to be funny.
- Sarcasm when it's earned. Metaphors that are specific and weird, not generic.
- Say the thing people are thinking but won't say out loud.
- Randomness and non sequiturs are human. Use them sparingly but don't be afraid of them.
- Every stat must be real — cite the actual number.
- NO em-dashes. NO "delve", "landscape", "unpack", "nuanced", "stakeholder".
- NO "it's worth noting", "furthermore", "in conclusion".
- If this reads like ChatGPT wrote it, you failed. Start over.
- Read it out loud in your head. Does it sound like a person at a bar? Good. Does it sound like a LinkedIn post? Burn it.`,
        `Write this piece:

Headline: ${p.headline}
Editor notes: ${p.summary}
Supporting data: ${JSON.stringify(supportingData)}

500-700 words. Lead with the most striking fact. Write it like you're telling a friend something wild you just found out. End with something that sits with the reader.`,
        { maxTokens: 2000 }
      );

      await agent.submitDraft({
        type: "article",
        title: p.headline,
        body: article,
        insightId: p.id,
      });

      console.log(`[${agent.name}] Draft submitted: "${p.headline}"`);
    }
  });
}

export { main };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
