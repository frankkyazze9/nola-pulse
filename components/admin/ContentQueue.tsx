"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase-client";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  query,
  orderBy,
} from "firebase/firestore";

interface ContentItem {
  id: string;
  type: "article" | "infographic" | "white_paper" | "tweet";
  title: string;
  body: string;
  insightId: string | null;
  createdBy: string;
  status: "draft" | "pending_review" | "approved" | "published" | "rejected";
  createdAt: string;
}

const typeIcons: Record<string, string> = {
  article: "📝",
  infographic: "📊",
  white_paper: "📄",
  tweet: "🐦",
};

const statusStyles: Record<string, string> = {
  pending_review: "bg-warning/20 text-warning",
  approved: "bg-success/20 text-success",
  published: "bg-accent/20 text-accent",
  rejected: "bg-danger/20 text-danger",
  draft: "bg-muted/20 text-muted",
};

export function ContentQueue() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("pending_review");

  useEffect(() => {
    const q = query(collection(db, "content-queue"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const updated: ContentItem[] = [];
      snapshot.forEach((doc) => {
        updated.push({ id: doc.id, ...doc.data() } as ContentItem);
      });
      setItems(updated);
    });
    return () => unsub();
  }, []);

  async function updateStatus(id: string, status: ContentItem["status"]) {
    await updateDoc(doc(db, "content-queue", id), {
      status,
      reviewedAt: new Date().toISOString(),
      reviewedBy: "frank",
    });
  }

  const filtered = items.filter((i) => (filter === "all" ? true : i.status === filter));

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {["pending_review", "approved", "published", "rejected", "all"].map(
          (f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-accent text-background"
                  : "bg-card-bg text-muted hover:text-foreground"
              }`}
            >
              {f === "pending_review"
                ? "Review"
                : f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== "all" && (
                <span className="ml-1.5 opacity-60">
                  ({items.filter((i) => i.status === f).length})
                </span>
              )}
            </button>
          )
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-card-border bg-card-bg p-8 text-center text-muted">
          {filter === "pending_review"
            ? "No content waiting for review. Agents will submit drafts here."
            : "No content in this category."}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-card-border bg-card-bg"
            >
              <div
                className="flex cursor-pointer items-center justify-between p-4"
                onClick={() =>
                  setExpanded(expanded === item.id ? null : item.id)
                }
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{typeIcons[item.type]}</span>
                  <div>
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="text-xs text-muted">
                      by {item.createdBy} &middot;{" "}
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[item.status]}`}
                >
                  {item.status.replace("_", " ")}
                </span>
              </div>

              {expanded === item.id && (
                <div className="border-t border-card-border p-4">
                  <div className="mb-4 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg bg-background p-4 text-sm">
                    {item.body}
                  </div>
                  {item.status === "pending_review" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateStatus(item.id, "approved")}
                        className="rounded-lg bg-success px-4 py-2 text-sm font-medium text-white"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => updateStatus(item.id, "rejected")}
                        className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                  {item.status === "approved" && (
                    <button
                      onClick={() => updateStatus(item.id, "published")}
                      className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background"
                    >
                      Publish
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
