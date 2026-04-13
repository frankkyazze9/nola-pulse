"use client";

interface Source {
  documentId: string;
  title?: string;
  sourceUrl?: string;
  sourceSystem?: string;
  publishedAt?: string;
}

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  timestamp?: string;
}

export default function ChatMessage({
  role,
  content,
  sources,
}: ChatMessageProps) {
  if (role === "user") {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[80%] rounded-lg px-4 py-3 bg-accent text-white">
          <p className="whitespace-pre-wrap text-sm">{content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="max-w-[90%] rounded-lg px-4 py-3 bg-card-bg border border-card-border">
        <div
          className="prose prose-sm max-w-none text-foreground [&_a]:text-accent [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_p]:my-2 [&_ul]:my-2 [&_li]:my-0.5"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        />
        {sources && sources.length > 0 && (
          <div className="mt-3 pt-3 border-t border-card-border">
            <p className="text-xs text-muted font-semibold mb-1">Sources:</p>
            <ul className="space-y-0.5">
              {sources.map((s, i) => (
                <li key={i} className="text-xs text-muted">
                  {s.sourceUrl ? (
                    <a
                      href={s.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      {s.title || s.sourceUrl}
                    </a>
                  ) : (
                    <span>{s.title || s.documentId}</span>
                  )}
                  {s.sourceSystem && (
                    <span className="ml-1 text-muted/60">
                      [{s.sourceSystem}]
                    </span>
                  )}
                  {s.publishedAt && (
                    <span className="ml-1 text-muted/60">
                      {new Date(s.publishedAt).toLocaleDateString()}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br>")
    .replace(/^/, "<p>")
    .replace(/$/, "</p>")
    .replace(/<p><\/p>/g, "")
    .replace(/<p>(<h[123]>)/g, "$1")
    .replace(/(<\/h[123]>)<\/p>/g, "$1")
    .replace(/<p>(<ul>)/g, "$1")
    .replace(/(<\/ul>)<\/p>/g, "$1");
}
