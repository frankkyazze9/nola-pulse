import { StatsBar } from "@/components/admin/StatsBar";
import { AgentStatusGrid } from "@/components/admin/AgentStatusGrid";
import { ContentQueue } from "@/components/admin/ContentQueue";
import Link from "next/link";

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            <span className="text-accent">Command</span> Center
          </h1>
          <p className="text-muted">NOLA Pulse Agent Operations</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/content"
            className="rounded-lg bg-card-bg px-4 py-2 text-sm font-medium text-muted hover:text-foreground"
          >
            Content Queue
          </Link>
          <Link
            href="/admin/kb"
            className="rounded-lg bg-card-bg px-4 py-2 text-sm font-medium text-muted hover:text-foreground"
          >
            Knowledge Base
          </Link>
          <Link
            href="/admin/agents"
            className="rounded-lg bg-card-bg px-4 py-2 text-sm font-medium text-muted hover:text-foreground"
          >
            Agents
          </Link>
        </div>
      </div>

      <div className="mb-8">
        <StatsBar />
      </div>

      <div className="mb-8">
        <h2 className="mb-4 text-xl font-semibold">Agent Status</h2>
        <AgentStatusGrid />
      </div>

      <div>
        <h2 className="mb-4 text-xl font-semibold">Content Review Queue</h2>
        <ContentQueue />
      </div>
    </div>
  );
}
