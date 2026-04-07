"use client";

import { useState, useRef, useEffect } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sql?: string;
  rawResults?: Record<string, unknown>[];
}

export function AiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: data.message,
          sql: data.sql,
          rawResults: data.rawResults,
        },
      ]);
    } catch {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "Failed to get response. Check the console." },
      ]);
    }

    setLoading(false);
  }

  return (
    <div className="flex h-[500px] flex-col rounded-xl border border-card-border bg-card-bg">
      <div className="border-b border-card-border px-4 py-3">
        <h3 className="font-semibold">
          <span className="text-accent">AI</span> Command Center
        </h3>
        <p className="text-xs text-muted">
          Ask questions about NOLA data. I can query 116K+ civic records.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-sm text-muted">
              <p className="mb-3">Try asking:</p>
              <div className="flex flex-col gap-2">
                {[
                  "How many STR licenses are in the French Quarter?",
                  "What are the top use of force types by NOPD?",
                  "Which council district has the most blight cases?",
                  "Write me a tweet about 311 complaints",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); }}
                    className="rounded-lg bg-background px-3 py-2 text-left text-xs hover:text-accent"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`mb-3 ${msg.role === "user" ? "text-right" : ""}`}
          >
            <div
              className={`inline-block max-w-[85%] rounded-xl px-4 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-accent text-background"
                  : "bg-background text-foreground"
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.sql && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted">
                    SQL Query
                  </summary>
                  <pre className="mt-1 overflow-x-auto rounded bg-card-bg p-2 text-xs">
                    {msg.sql}
                  </pre>
                </details>
              )}
              {msg.rawResults && msg.rawResults.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted">
                    Raw Data ({msg.rawResults.length} rows)
                  </summary>
                  <pre className="mt-1 max-h-40 overflow-auto rounded bg-card-bg p-2 text-xs">
                    {JSON.stringify(msg.rawResults, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="mb-3">
            <div className="inline-block rounded-xl bg-background px-4 py-2 text-sm text-muted">
              Querying knowledge base...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-card-border p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask about New Orleans data..."
            className="flex-1 rounded-lg border border-card-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
