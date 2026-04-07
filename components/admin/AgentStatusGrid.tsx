"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase-client";
import { collection, onSnapshot } from "firebase/firestore";

interface AgentStatus {
  id: string;
  status: "running" | "idle" | "error";
  details: string | null;
  lastRun: string;
  version: string;
  type: string;
}

const statusColors = {
  running: "bg-blue-500",
  idle: "bg-success",
  error: "bg-danger",
};

const statusLabels = {
  running: "Running",
  idle: "Idle",
  error: "Error",
};

export function AgentStatusGrid() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "agents"), (snapshot) => {
      const updated: AgentStatus[] = [];
      snapshot.forEach((doc) => {
        updated.push({ id: doc.id, ...doc.data() } as AgentStatus);
      });
      updated.sort((a, b) => a.id.localeCompare(b.id));
      setAgents(updated);
    });
    return () => unsub();
  }, []);

  if (agents.length === 0) {
    return (
      <div className="rounded-xl border border-card-border bg-card-bg p-6 text-center text-muted">
        No agents registered yet. Agents will appear here when they first run.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {agents.map((agent) => (
        <div
          key={agent.id}
          className="rounded-xl border border-card-border bg-card-bg p-4"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-sm font-semibold">{agent.id}</span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium text-white ${statusColors[agent.status]}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${agent.status === "running" ? "animate-pulse bg-white" : "bg-white/60"}`}
              />
              {statusLabels[agent.status]}
            </span>
          </div>
          <p className="text-xs text-muted">
            Type: {agent.type} &middot; v{agent.version}
          </p>
          {agent.details && (
            <p
              className={`mt-2 text-xs ${agent.status === "error" ? "text-danger" : "text-muted"}`}
            >
              {agent.details}
            </p>
          )}
          <p className="mt-2 text-xs text-muted">
            Last run: {new Date(agent.lastRun).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}
