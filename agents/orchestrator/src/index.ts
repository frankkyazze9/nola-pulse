/**
 * NOLA Pulse Orchestrator
 *
 * The central brain that runs all agents in coordinated sprints.
 * A sprint is a full cycle: scouts → analysts → creators → QA.
 *
 * Usage:
 *   npx tsx agents/orchestrator/src/index.ts sprint    # Run a full sprint
 *   npx tsx agents/orchestrator/src/index.ts scouts    # Run all scouts only
 *   npx tsx agents/orchestrator/src/index.ts analyze   # Run analysts only
 *   npx tsx agents/orchestrator/src/index.ts audit     # Run QA auditor only
 */

import { Agent } from "../../shared/agent-sdk";

const agent = new Agent({
  name: "orchestrator",
  version: "1.0.0",
  type: "analyst",
});

// Import all agents
async function runScouts() {
  console.log("\n🔍 PHASE 1: SCOUTS — Ingesting data...\n");

  const scouts = [
    { name: "scout-311", run: () => import("../../scout-311/src/index").then((m) => m.main()) },
    { name: "scout-str", run: () => import("../../scout-str/src/index").then((m) => m.main()) },
    { name: "scout-permits", run: () => import("../../scout-permits/src/index").then((m) => m.main()) },
    { name: "scout-crime", run: () => import("../../scout-crime/src/index").then((m) => m.main()) },
    { name: "scout-budget", run: () => import("../../scout-budget/src/index").then((m) => m.main()) },
    { name: "scout-blight", run: () => import("../../scout-blight/src/index").then((m) => m.main()) },
    { name: "scout-news", run: () => import("../../scout-news/src/index").then((m) => m.main()) },
  ];

  const results = await Promise.allSettled(scouts.map(async (s) => {
    try {
      await s.run();
      console.log(`  ✓ ${s.name} completed`);
      return { name: s.name, status: "success" };
    } catch (err) {
      console.log(`  ✗ ${s.name} failed: ${(err as Error).message}`);
      return { name: s.name, status: "failed", error: (err as Error).message };
    }
  }));

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  console.log(`\n  Scouts: ${succeeded}/${scouts.length} completed\n`);
  return results;
}

async function runAnalysts() {
  console.log("\n🧠 PHASE 2: ANALYSTS — Finding stories...\n");

  try {
    const storyFinder = await import("../../analyst-story-finder/src/index");
    await storyFinder.findTodaysStory();
    console.log("  ✓ Story Finder completed — article draft in queue\n");
  } catch (err) {
    console.log(`  ✗ Story Finder failed: ${(err as Error).message}\n`);
  }
}

async function runQA() {
  console.log("\n🔎 PHASE 3: QA — Auditing site...\n");

  try {
    const qa = await import("../../qa-auditor/src/index");
    await qa.main();
    console.log("  ✓ QA Auditor completed\n");
  } catch (err) {
    console.log(`  ✗ QA Auditor failed: ${(err as Error).message}\n`);
  }
}

async function runSprint() {
  console.log("═".repeat(60));
  console.log("  NOLA PULSE — SPRINT CYCLE");
  console.log(`  Started: ${new Date().toLocaleString()}`);
  console.log("═".repeat(60));

  await agent.run(async () => {
    // Phase 1: Scouts gather data
    await runScouts();

    // Phase 2: Analysts find stories
    await runAnalysts();

    // Phase 3: QA audits everything
    await runQA();

    console.log("═".repeat(60));
    console.log("  SPRINT COMPLETE");
    console.log(`  Finished: ${new Date().toLocaleString()}`);
    console.log("═".repeat(60));
  });
}

// CLI interface
const command = process.argv[2] || "sprint";

const commands: Record<string, () => Promise<void>> = {
  sprint: runSprint,
  scouts: async () => { await agent.run(() => runScouts().then(() => {})); },
  analyze: async () => { await agent.run(runAnalysts); },
  audit: async () => { await agent.run(runQA); },
};

if (!commands[command]) {
  console.error(`Unknown command: ${command}`);
  console.error("Available: sprint, scouts, analyze, audit");
  process.exit(1);
}

commands[command]().catch((err) => {
  console.error("Orchestrator fatal:", err);
  process.exit(1);
});
