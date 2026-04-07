"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase-client";
import { collection, onSnapshot } from "firebase/firestore";

interface Stats {
  totalAgents: number;
  runningAgents: number;
  errorAgents: number;
  pendingReview: number;
  publishedToday: number;
}

export function StatsBar() {
  const [stats, setStats] = useState<Stats>({
    totalAgents: 0,
    runningAgents: 0,
    errorAgents: 0,
    pendingReview: 0,
    publishedToday: 0,
  });

  useEffect(() => {
    const unsubAgents = onSnapshot(collection(db, "agents"), (snapshot) => {
      let total = 0, running = 0, errors = 0;
      snapshot.forEach((doc) => {
        total++;
        const data = doc.data();
        if (data.status === "running") running++;
        if (data.status === "error") errors++;
      });
      setStats((s) => ({ ...s, totalAgents: total, runningAgents: running, errorAgents: errors }));
    });

    const unsubContent = onSnapshot(collection(db, "content-queue"), (snapshot) => {
      let pending = 0, published = 0;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === "pending_review") pending++;
        if (data.status === "published" && new Date(data.createdAt) >= todayStart) published++;
      });
      setStats((s) => ({ ...s, pendingReview: pending, publishedToday: published }));
    });

    return () => { unsubAgents(); unsubContent(); };
  }, []);

  const statCards = [
    { label: "Agents", value: stats.totalAgents, sub: `${stats.runningAgents} running` },
    { label: "Errors", value: stats.errorAgents, color: stats.errorAgents > 0 ? "text-danger" : "text-success" },
    { label: "Pending Review", value: stats.pendingReview, color: stats.pendingReview > 0 ? "text-warning" : "text-muted" },
    { label: "Published Today", value: stats.publishedToday },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {statCards.map((stat) => (
        <div key={stat.label} className="rounded-xl border border-card-border bg-card-bg p-4">
          <p className="text-xs text-muted">{stat.label}</p>
          <p className={`text-2xl font-bold ${stat.color || "text-foreground"}`}>{stat.value}</p>
          {stat.sub && <p className="text-xs text-muted">{stat.sub}</p>}
        </div>
      ))}
    </div>
  );
}
