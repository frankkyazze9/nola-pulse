"use client";

import { useSyncExternalStore } from "react";

function daysBetween(targetISO: string): number {
  return Math.ceil(
    (new Date(targetISO).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
}

// Subscribe-with-never-changes: we just want the client-side render to
// recompute after hydration. useSyncExternalStore returns the server
// snapshot during SSR and the client snapshot post-hydration.
const subscribe = () => () => {};

function useDaysUntil(date: string): number | null {
  return useSyncExternalStore(
    subscribe,
    () => daysBetween(date), // client snapshot
    () => null // server snapshot — renders as "unknown" on SSR
  );
}

export default function CountdownBadge({ date }: { date: string }) {
  const daysUntil = useDaysUntil(date);

  if (daysUntil === null) {
    return (
      <span className="px-2 py-0.5 text-xs rounded bg-card-bg text-muted">
        &nbsp;
      </span>
    );
  }

  if (daysUntil < 0) {
    return (
      <span className="px-2 py-0.5 text-xs rounded bg-muted/20 text-muted">
        {Math.abs(daysUntil)}d ago
      </span>
    );
  }
  const color =
    daysUntil <= 7
      ? "bg-danger/20 text-danger"
      : daysUntil <= 30
      ? "bg-warning/20 text-warning"
      : "bg-card-bg text-muted";
  return (
    <span className={`px-2 py-0.5 text-xs rounded ${color}`}>
      {daysUntil === 0 ? "today" : `${daysUntil}d`}
    </span>
  );
}

export function CountdownText({ date }: { date: string }) {
  const daysUntil = useDaysUntil(date);
  if (daysUntil === null) return null;
  if (daysUntil < 0) return <> · {Math.abs(daysUntil)} days ago</>;
  if (daysUntil === 0) return <> · today</>;
  return <> · {daysUntil} days away</>;
}
