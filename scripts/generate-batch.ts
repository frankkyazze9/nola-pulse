/**
 * Generate a batch of articles and submit to content queue.
 * Usage: npx tsx scripts/generate-batch.ts 7
 */

import { Agent } from "../agents/shared/agent-sdk";
import { readFileSync } from "fs";
import { join } from "path";

const agent = new Agent({ name: "batch-writer", version: "1.0.0", type: "creator" });
const count = parseInt(process.argv[2] || "7", 10);

const voiceGuide = (() => {
  try { return readFileSync(join(process.cwd(), "data", "voice.md"), "utf-8"); }
  catch { return ""; }
})();

const ANGLES = [
  {
    topic: "use of force breakdown",
    sql: "SELECT force_type, COUNT(*) as c FROM nola_pulse_kb.use_of_force WHERE force_type IS NOT NULL GROUP BY force_type ORDER BY c DESC LIMIT 10",
    hint: "Break down what types of force NOPD uses most. The numbers tell a story."
  },
  {
    topic: "domestic disputes dominate police calls",
    sql: "SELECT signal_description, COUNT(*) as c FROM nola_pulse_kb.police_reports WHERE signal_description IS NOT NULL GROUP BY signal_description ORDER BY c DESC LIMIT 10",
    hint: "Domestic disturbances are the #1 police report type. What does that say about the city?"
  },
  {
    topic: "STR takeover by neighborhood",
    sql: "SELECT neighborhood, COUNT(*) as c FROM nola_pulse_kb.str_permits WHERE neighborhood IS NOT NULL GROUP BY neighborhood ORDER BY c DESC LIMIT 10",
    hint: "Which neighborhoods have been most converted to tourist rentals? Show the data."
  },
  {
    topic: "trash complaints vs everything else",
    sql: "SELECT request_type, COUNT(*) as c FROM nola_pulse_kb.service_requests_311 WHERE request_type IS NOT NULL GROUP BY request_type ORDER BY c DESC LIMIT 10",
    hint: "Trash and recycling complaints dominate 311. What does that say about city services?"
  },
  {
    topic: "the demolition map",
    sql: "SELECT program, COUNT(*) as c FROM nola_pulse_kb.demolitions WHERE program IS NOT NULL GROUP BY program ORDER BY c DESC",
    hint: "3,940 properties demolished. What programs are driving it and what's replacing them?"
  },
  {
    topic: "blight by the numbers",
    sql: "SELECT stage, COUNT(*) as c FROM nola_pulse_kb.blight_cases WHERE stage IS NOT NULL GROUP BY stage ORDER BY c DESC",
    hint: "5,668 blight cases in various stages. How fast does the city actually move on blight?"
  },
  {
    topic: "building permits tell the real story",
    sql: "SELECT permit_type, COUNT(*) as c FROM nola_pulse_kb.building_permits WHERE permit_type IS NOT NULL GROUP BY permit_type ORDER BY c DESC LIMIT 10",
    hint: "15,843 building permits. What's actually being built? Renovations? New construction? Demolitions?"
  },
  {
    topic: "NOPD district breakdown",
    sql: "SELECT district, COUNT(*) as c FROM nola_pulse_kb.police_reports WHERE district IS NOT NULL GROUP BY district ORDER BY c DESC",
    hint: "Which NOPD districts are the busiest? The quietest? What does the map of policing look like?"
  },
  {
    topic: "the highest paid city employees",
    sql: "SELECT position_title, department, salary FROM nola_pulse_kb.employee_salaries WHERE salary IS NOT NULL ORDER BY salary DESC LIMIT 15",
    hint: "Who's making the most money on the city payroll? Public record. Let's look."
  },
  {
    topic: "streetlight complaints — the city in the dark",
    sql: "SELECT status, COUNT(*) as c FROM nola_pulse_kb.service_requests_311 WHERE LOWER(request_type) LIKE '%streetlight%' AND status IS NOT NULL GROUP BY status ORDER BY c DESC",
    hint: "How many streetlight complaints are still open? How many got closed? The gap tells a story."
  },
];

async function main() {
  await agent.run(async () => {
    const selected = ANGLES.slice(0, count);
    console.log(`Generating ${selected.length} articles...\n`);

    for (let i = 0; i < selected.length; i++) {
      const angle = selected[i];
      console.log(`[${i + 1}/${selected.length}] ${angle.topic}...`);

      let data: any[];
      try {
        data = await agent.queryKB(angle.sql);
      } catch {
        console.log(`  Skipped — query failed`);
        continue;
      }

      const article = await agent.think(
        `You are writing for NOLA Pulse, a New Orleans news outlet. You ARE the voice in this guide:\n\n${voiceGuide}\n\nRules:\n- This is a real news outlet. Don't announce humor or satire.\n- Every number must be from the data provided.\n- Lead with the most striking fact.\n- Write like you're telling a friend something you just found out.\n- Sarcasm when earned. Metaphors that are specific.\n- NO em-dashes. NO "delve", "landscape", "unpack", "nuanced".\n- If it sounds like AI wrote it, start over.`,
        `Write an article about: ${angle.topic}\n\nHint: ${angle.hint}\n\nData:\n${JSON.stringify(data, null, 2)}\n\n500-700 words. Real headline (not a joke headline). Compelling, specific, the kind of headline that makes you click.`,
        { maxTokens: 2000 }
      );

      // Extract headline from first line
      const lines = article.split("\n").filter((l) => l.trim());
      let headline = lines[0].replace(/^#+\s*/, "").replace(/^\*+/, "").replace(/\*+$/, "").trim();
      if (headline.length > 100) headline = headline.slice(0, 97) + "...";
      const body = lines.slice(1).join("\n").trim();

      await agent.submitDraft({
        type: "article",
        title: headline,
        body: article,
        insightId: null,
      });

      console.log(`  ✓ "${headline}"\n`);
    }

    console.log(`Done. ${selected.length} drafts in your content queue.`);
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
