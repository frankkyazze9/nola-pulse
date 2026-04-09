"use client";

import { useEffect, useState } from "react";

interface AgentStatus {
  id: string;
  status: "running" | "idle" | "error";
  details: string | null;
  lastRun: string;
  version: string;
  type: string;
}

export function AgentStatusGrid() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);

  useEffect(() => {
    fetch("/api/admin/agents-status")
      .then((r) => r.json())
      .then(setAgents)
      .catch(() => {});
  }, []);

  if (agents.length === 0) {
    return <p className="text-sm text-muted">No agents registered yet.</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      {agents.map((agent) => (
        <div key={agent.id} className="flex items-center justify-between border border-card-border px-3 py-2 text-xs">
          <span className="font-mono">{agent.id}</span>
          <div className="flex items-center gap-3">
            <span className="text-muted">{agent.type}</span>
            <span className={agent.status === "error" ? "text-danger font-bold" : agent.status === "running" ? "text-blue-600" : "text-muted"}>
              {agent.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
