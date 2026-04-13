"use client";

const TOOL_LABELS: Record<string, string> = {
  search_people: "Searching people",
  get_person: "Loading person details",
  search_documents: "Searching documents",
  get_document: "Reading document",
  search_claims: "Checking claims",
  get_donations: "Looking up donations",
  get_court_cases: "Checking court records",
  get_news: "Searching news coverage",
  get_hearings: "Searching hearing transcripts",
  get_public_opinion: "Checking public opinion",
  web_search: "Searching the web",
};

interface ToolStep {
  name: string;
  status: "running" | "done" | "error";
}

interface ToolProgressProps {
  steps: ToolStep[];
  thinking: boolean;
}

export default function ToolProgress({ steps, thinking }: ToolProgressProps) {
  if (steps.length === 0 && !thinking) return null;

  return (
    <div className="mb-4 ml-2">
      <div className="space-y-1">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-muted">
            <span className="w-4 text-center">
              {step.status === "running" ? (
                <span className="inline-block animate-spin">&#9696;</span>
              ) : step.status === "error" ? (
                <span className="text-danger">&#10007;</span>
              ) : (
                <span className="text-success">&#10003;</span>
              )}
            </span>
            <span>{TOOL_LABELS[step.name] ?? step.name}</span>
          </div>
        ))}
        {thinking && steps.every((s) => s.status !== "running") && (
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="w-4 text-center">
              <span className="inline-block animate-pulse">&#9679;</span>
            </span>
            <span>Analyzing...</span>
          </div>
        )}
      </div>
    </div>
  );
}
