import { Agent } from "../../shared/agent-sdk";

const agent = new Agent({
  name: "qa-auditor",
  version: "1.0.0",
  type: "analyst",
});

const SITE_URL =
  process.env.SITE_URL ||
  "https://nola-pulse-845570509325.us-south1.run.app";

interface PageAudit {
  url: string;
  status: number;
  hasContent: boolean;
  dataPoints: number;
  issues: string[];
  suggestions: string[];
}

interface AuditReport {
  timestamp: string;
  pagesAudited: number;
  pagesWithData: number;
  pagesWithIssues: number;
  totalDataPoints: number;
  kbRecordCounts: Record<string, number>;
  pageResults: PageAudit[];
  systemIssues: string[];
  improvements: string[];
}

const PAGES_TO_AUDIT = [
  { path: "/", name: "Landing Page", expectData: false },
  { path: "/dashboard", name: "Dashboard", expectData: true },
  { path: "/council", name: "Council Whisperer", expectData: true },
  { path: "/articles", name: "Articles", expectData: true },
  { path: "/blackout", name: "Blackout Prediction", expectData: false },
  { path: "/floods", name: "Flood Predictions", expectData: false },
  { path: "/displacement", name: "Displacement Tracker", expectData: false },
  { path: "/entities", name: "Entity Predictions", expectData: false },
  { path: "/budget", name: "Budget Explorer", expectData: false },
  { path: "/forum", name: "Community Forum", expectData: false },
];

async function auditPage(
  path: string,
  name: string,
  expectData: boolean
): Promise<PageAudit> {
  const url = `${SITE_URL}${path}`;
  const issues: string[] = [];
  const suggestions: string[] = [];

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "NOLAPulse-QA-Auditor/1.0" },
    });

    const html = await res.text();

    // Check basic health
    if (res.status !== 200) {
      issues.push(`HTTP ${res.status}`);
    }

    // Check if page has real content vs placeholder
    const hasContent =
      !html.includes("Coming Soon") &&
      !html.includes("No articles yet") &&
      !html.includes("No meetings summarized") &&
      !html.includes("loading soon");

    // Count data points (numbers in stat cards)
    const numberMatches = html.match(
      /text-3xl font-bold[^>]*>([0-9,]+)</g
    );
    const dataPoints = numberMatches ? numberMatches.length : 0;

    // Check for zero values that shouldn't be zero
    if (expectData && dataPoints === 0) {
      issues.push(`No data points rendered on ${name}`);
      suggestions.push(`Check BigQuery connectivity and data pipeline for ${name}`);
    }

    // Check for error messages in HTML
    if (html.includes("Error") || html.includes("error")) {
      const errorContext = html.match(/.{0,50}[Ee]rror.{0,50}/)?.[0];
      if (errorContext && !errorContext.includes("next-error")) {
        issues.push(`Possible error on page: ${errorContext.slice(0, 80)}`);
      }
    }

    // Check if page content is actually visible (not just shell)
    const bodyContent = html.match(/<main[^>]*>([\s\S]*?)<\/main>/)?.[1] || "";
    if (bodyContent.length < 100) {
      issues.push("Page body suspiciously short — may not be rendering");
    }

    // Specific checks per page type
    if (path === "/dashboard" && expectData) {
      if (!html.includes("311") && !html.includes("Service Request")) {
        issues.push("Dashboard missing 311 data section");
      }
      if (!html.includes("STR") && !html.includes("Licenses")) {
        issues.push("Dashboard missing STR data section");
      }
      if (!html.includes("Blight")) {
        issues.push("Dashboard missing blight data section");
      }
    }

    return {
      url,
      status: res.status,
      hasContent,
      dataPoints,
      issues,
      suggestions,
    };
  } catch (err) {
    return {
      url,
      status: 0,
      hasContent: false,
      dataPoints: 0,
      issues: [`Fetch failed: ${(err as Error).message}`],
      suggestions: ["Check if site is deployed and accessible"],
    };
  }
}

async function auditKnowledgeBase(): Promise<Record<string, number>> {
  const tables = [
    "service_requests_311",
    "str_permits",
    "building_permits",
    "demolitions",
    "police_reports",
    "use_of_force",
    "blight_cases",
    "blight_violations",
    "news_articles",
    "elected_officials",
    "insights",
  ];

  const counts: Record<string, number> = {};

  for (const table of tables) {
    try {
      const result = await agent.queryKB(
        `SELECT COUNT(*) as count FROM nola_pulse_kb.${table}`
      );
      counts[table] = (result[0] as any)?.count || 0;
    } catch {
      counts[table] = -1; // Error
    }
  }

  return counts;
}

async function generateImprovements(
  report: AuditReport
): Promise<string[]> {
  const improvements: string[] = [];

  // Check for empty KB tables
  for (const [table, count] of Object.entries(report.kbRecordCounts)) {
    if (count === 0) {
      improvements.push(
        `KB table '${table}' is empty — scout may not have run or data source may be unavailable`
      );
    } else if (count === -1) {
      improvements.push(
        `KB table '${table}' query failed — check BigQuery permissions`
      );
    }
  }

  // Check data freshness
  const totalRecords = Object.values(report.kbRecordCounts)
    .filter((c) => c > 0)
    .reduce((a, b) => a + b, 0);
  if (totalRecords < 1000) {
    improvements.push(
      `Only ${totalRecords} total KB records — run full scout backfill`
    );
  }

  // Check page issues
  for (const page of report.pageResults) {
    if (page.issues.length > 0) {
      improvements.push(
        `${page.url}: ${page.issues.join("; ")}`
      );
    }
  }

  // Use Claude for deeper analysis
  if (report.pageResults.some((p) => p.issues.length > 0)) {
    const aiSuggestions = await agent.think(
      "You are a QA engineer auditing a civic tech platform called NOLA Pulse. Analyze the audit report and suggest concrete fixes. Be specific — name files, functions, and exact issues.",
      `Audit Report:\n${JSON.stringify(report, null, 2)}\n\nList the top 3 most critical issues to fix, with specific actionable steps.`
    );
    improvements.push(`AI Analysis:\n${aiSuggestions}`);
  }

  return improvements;
}

async function runAudit(): Promise<AuditReport> {
  console.log(`[${agent.name}] Starting full site audit...`);

  // Audit all pages in parallel
  const pageResults = await Promise.all(
    PAGES_TO_AUDIT.map((p) => auditPage(p.path, p.name, p.expectData))
  );

  // Audit knowledge base
  console.log(`[${agent.name}] Auditing knowledge base...`);
  const kbRecordCounts = await auditKnowledgeBase();

  const report: AuditReport = {
    timestamp: new Date().toISOString(),
    pagesAudited: pageResults.length,
    pagesWithData: pageResults.filter((p) => p.hasContent).length,
    pagesWithIssues: pageResults.filter((p) => p.issues.length > 0).length,
    totalDataPoints: pageResults.reduce((sum, p) => sum + p.dataPoints, 0),
    kbRecordCounts,
    pageResults,
    systemIssues: [],
    improvements: [],
  };

  // Generate improvements
  console.log(`[${agent.name}] Generating improvement suggestions...`);
  report.improvements = await generateImprovements(report);

  return report;
}

async function main() {
  await agent.run(async () => {
    const report = await runAudit();

    // Store report
    await agent.storeDocument(
      `qa/audit-${new Date().toISOString().split("T")[0]}.json`,
      JSON.stringify(report, null, 2)
    );

    // Submit as insight for the admin dashboard
    await agent.submitInsight({
      type: "pattern",
      headline: `QA Audit: ${report.pagesWithIssues} pages with issues, ${Object.values(report.kbRecordCounts).filter(c => c > 0).reduce((a, b) => a + b, 0).toLocaleString()} KB records`,
      summary: [
        `Audited ${report.pagesAudited} pages.`,
        `${report.pagesWithData} have live data, ${report.pagesWithIssues} have issues.`,
        `Knowledge base: ${Object.entries(report.kbRecordCounts).map(([t, c]) => `${t}: ${c.toLocaleString()}`).join(", ")}`,
        report.improvements.length > 0
          ? `\n\nImprovements needed:\n${report.improvements.map((i) => `- ${i}`).join("\n")}`
          : "\nNo critical issues found.",
      ].join("\n"),
      dataPoints: Object.entries(report.kbRecordCounts).map(([table, count]) => ({
        label: table,
        value: count.toLocaleString(),
        source: "BigQuery",
      })),
      relevance: report.pagesWithIssues > 0 ? 90 : 50,
      topics: ["qa", "system"],
      suggestedFormats: ["tweet"],
    });

    // Print report
    console.log(`\n${"=".repeat(60)}`);
    console.log(`QA AUDIT REPORT — ${report.timestamp}`);
    console.log(`${"=".repeat(60)}`);
    console.log(`Pages Audited:     ${report.pagesAudited}`);
    console.log(`Pages with Data:   ${report.pagesWithData}`);
    console.log(`Pages with Issues: ${report.pagesWithIssues}`);
    console.log(`Total Data Points: ${report.totalDataPoints}`);
    console.log(`\nKnowledge Base:`);
    for (const [table, count] of Object.entries(report.kbRecordCounts)) {
      const status = count > 0 ? "✓" : count === 0 ? "✗" : "⚠";
      console.log(`  ${status} ${table}: ${count.toLocaleString()}`);
    }
    if (report.improvements.length > 0) {
      console.log(`\nImprovements:`);
      for (const imp of report.improvements) {
        console.log(`  → ${imp}`);
      }
    }
    console.log(`${"=".repeat(60)}\n`);
  });
}

export { main, runAudit };

if (require.main === module) {
  main().catch((err) => {
    console.error(`[qa-auditor] Fatal:`, err);
    process.exit(1);
  });
}
