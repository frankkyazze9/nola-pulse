#!/usr/bin/env tsx
/**
 * Local CLI for the Dark Horse brain — talk to Claude without booting Next.
 *
 * Usage:
 *   tsx scripts/brain-cli.ts ask "what has Judge Calogero ruled on since 2024?"
 *   tsx scripts/brain-cli.ts dossier <personId>
 *
 * Requires the same env as the Next server:
 *   ANTHROPIC_API_KEY
 *   DATABASE_URL
 *   EMBEDDING_SERVICE_URL
 */

import { generateDossier, runBrainInteractive } from "../lib/brain/runner";
import { getMonthToDateSpend } from "../lib/spend";

async function main(): Promise<number> {
  const [, , subcommand, ...rest] = process.argv;

  if (!subcommand) {
    printUsage();
    return 1;
  }

  const mtdBefore = await getMonthToDateSpend();
  process.stderr.write(`[brain-cli] month-to-date spend: $${mtdBefore.toFixed(2)}\n`);

  if (subcommand === "ask") {
    const question = rest.join(" ").trim();
    if (!question) {
      process.stderr.write("error: missing question\n");
      printUsage();
      return 1;
    }
    const answer = await runBrainInteractive(question);
    process.stdout.write(JSON.stringify(answer, null, 2) + "\n");
  } else if (subcommand === "dossier") {
    const personId = rest[0]?.trim();
    if (!personId) {
      process.stderr.write("error: missing personId\n");
      printUsage();
      return 1;
    }
    const dossier = await generateDossier(personId);
    process.stdout.write(JSON.stringify(dossier, null, 2) + "\n");
  } else {
    process.stderr.write(`unknown subcommand: ${subcommand}\n`);
    printUsage();
    return 1;
  }

  const mtdAfter = await getMonthToDateSpend();
  process.stderr.write(
    `[brain-cli] month-to-date spend after run: $${mtdAfter.toFixed(2)} (delta $${(mtdAfter - mtdBefore).toFixed(4)})\n`
  );
  return 0;
}

function printUsage(): void {
  process.stderr.write(
    "usage:\n" +
      "  tsx scripts/brain-cli.ts ask <question>\n" +
      "  tsx scripts/brain-cli.ts dossier <personId>\n"
  );
}

main().then((code) => process.exit(code)).catch((err) => {
  console.error(err);
  process.exit(1);
});
