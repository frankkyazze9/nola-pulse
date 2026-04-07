import { AgentStatusGrid } from "@/components/admin/AgentStatusGrid";
import Link from "next/link";

export default function AgentsPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8 flex items-center gap-4">
        <Link href="/admin" className="text-muted hover:text-foreground">
          &larr; Command Center
        </Link>
      </div>

      <h1 className="mb-2 text-3xl font-bold">
        <span className="text-accent">Agent</span> Management
      </h1>
      <p className="mb-8 text-muted">
        Monitor agent status, view execution history, and trigger manual runs.
      </p>

      <AgentStatusGrid />

      <div className="mt-8 rounded-xl border border-card-border bg-card-bg p-6">
        <h2 className="mb-4 text-lg font-semibold">Agent Roster</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left text-muted">
                <th className="pb-3 pr-4">Agent</th>
                <th className="pb-3 pr-4">Type</th>
                <th className="pb-3 pr-4">Schedule</th>
                <th className="pb-3 pr-4">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {[
                { name: "scout-council", type: "Scout", schedule: "Daily 6am CT", desc: "Ingests city council meetings, agendas, votes" },
                { name: "scout-entergy", type: "Scout", schedule: "Every 30min (storm) / Daily", desc: "Scrapes Entergy outage data by zip code" },
                { name: "scout-housing", type: "Scout", schedule: "Weekly", desc: "STR permits, property sales, evictions" },
                { name: "scout-budget", type: "Scout", schedule: "Monthly", desc: "City budget documents and contract awards" },
                { name: "scout-news", type: "Scout", schedule: "Every 2hrs", desc: "Local media RSS feeds and press releases" },
                { name: "analyst-story-finder", type: "Analyst", schedule: "Daily 7am CT", desc: "Identifies the most compelling daily narrative" },
                { name: "analyst-pattern-detector", type: "Analyst", schedule: "Daily", desc: "Finds recurring patterns across datasets" },
                { name: "creator-article-writer", type: "Creator", schedule: "On insight", desc: "Generates daily articles in Frank's voice" },
                { name: "creator-infographic", type: "Creator", schedule: "On insight", desc: "Creates comedic data infographics" },
                { name: "publisher-website", type: "Publisher", schedule: "On approval", desc: "Publishes approved content to the site" },
                { name: "publisher-twitter", type: "Publisher", schedule: "On approval", desc: "Posts to Twitter/X" },
              ].map((a) => (
                <tr key={a.name}>
                  <td className="py-3 pr-4 font-mono text-xs">{a.name}</td>
                  <td className="py-3 pr-4 text-xs text-muted">{a.type}</td>
                  <td className="py-3 pr-4 text-xs text-muted">{a.schedule}</td>
                  <td className="py-3 pr-4 text-xs text-muted">{a.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
