"use client";

import { useEffect, useState } from "react";

interface Stats {
  agents: number;
  pendingReview: number;
  published: number;
  total: number;
}

export function StatsBar() {
  const [stats, setStats] = useState<Stats>({ agents: 0, pendingReview: 0, published: 0, total: 0 });

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/agents-status").then((r) => r.json()),
      fetch("/api/admin/content-queue").then((r) => r.json()),
    ]).then(([agents, content]) => {
      setStats({
        agents: agents.length,
        pendingReview: content.filter((c: any) => c.status === "pending_review").length,
        published: content.filter((c: any) => c.status === "published").length,
        total: content.length,
      });
    }).catch(() => {});
  }, []);

  return (
    <div className="grid grid-cols-4 gap-3 text-center">
      <div className="border border-card-border p-3">
        <p className="text-2xl font-bold">{stats.agents}</p>
        <p className="text-xs text-muted">Agents</p>
      </div>
      <div className="border border-card-border p-3">
        <p className="text-2xl font-bold">{stats.pendingReview}</p>
        <p className="text-xs text-muted">Pending Review</p>
      </div>
      <div className="border border-card-border p-3">
        <p className="text-2xl font-bold">{stats.published}</p>
        <p className="text-xs text-muted">Published</p>
      </div>
      <div className="border border-card-border p-3">
        <p className="text-2xl font-bold">{stats.total}</p>
        <p className="text-xs text-muted">Total Content</p>
      </div>
    </div>
  );
}
