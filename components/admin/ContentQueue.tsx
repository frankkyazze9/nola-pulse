"use client";

import { useEffect, useState } from "react";

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
  pending_review: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  published: "bg-blue-100 text-blue-800",
  rejected: "bg-red-100 text-red-800",
  draft: "bg-gray-100 text-gray-600",
};

export function ContentQueue() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("pending_review");
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/admin/content-queue");
    const data = await res.json();
    setItems(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function updateStatus(id: string, status: string) {
    await fetch("/api/admin/content-queue", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    load();
  }

  async function publishToSite(id: string) {
    await fetch("/api/admin/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentId: id }),
    });
    load();
  }

  const filtered = items.filter((i) =>
    filter === "all" ? true : i.status === filter
  );

  if (loading) return <p className="text-sm text-muted">Loading queue...</p>;

  return (
    <div>
      <div className="mb-4 flex gap-2 flex-wrap">
        {["pending_review", "approved", "published", "rejected", "all"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`border px-3 py-1 text-xs ${
              filter === f ? "bg-foreground text-background" : "border-card-border text-muted"
            }`}
          >
            {f === "pending_review" ? "Review" : f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== "all" && ` (${items.filter((i) => i.status === f).length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted py-8 text-center">
          {filter === "pending_review"
            ? "No content waiting for review."
            : "Nothing here."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((item) => (
            <div key={item.id} className="border border-card-border">
              <div
                className="flex cursor-pointer items-center justify-between p-3"
                onClick={() => setExpanded(expanded === item.id ? null : item.id)}
              >
                <div className="flex items-center gap-2">
                  <span>{typeIcons[item.type] || "📄"}</span>
                  <div>
                    <p className="text-sm font-bold">{item.title}</p>
                    <p className="text-xs text-muted">
                      {item.createdBy} &middot;{" "}
                      {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 ${statusStyles[item.status] || ""}`}>
                  {item.status.replace("_", " ")}
                </span>
              </div>

              {expanded === item.id && (
                <div className="border-t border-card-border p-3">
                  <pre className="mb-3 max-h-80 overflow-y-auto whitespace-pre-wrap bg-card-bg p-3 text-xs leading-relaxed">
                    {item.body}
                  </pre>
                  <div className="flex gap-2">
                    {item.status === "pending_review" && (
                      <>
                        <button onClick={() => updateStatus(item.id, "approved")} className="bg-green-700 text-white px-3 py-1 text-xs">Approve</button>
                        <button onClick={() => updateStatus(item.id, "rejected")} className="bg-red-700 text-white px-3 py-1 text-xs">Reject</button>
                      </>
                    )}
                    {item.status === "approved" && (
                      <button onClick={() => publishToSite(item.id)} className="bg-foreground text-background px-3 py-1 text-xs">Publish to Site</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
