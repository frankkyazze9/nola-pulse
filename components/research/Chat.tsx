"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ChatMessage from "./ChatMessage";
import ToolProgress from "./ToolProgress";
import PersonSearch from "./PersonSearch";

interface Source {
  documentId: string;
  title?: string;
  sourceUrl?: string;
  sourceSystem?: string;
  publishedAt?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

interface ToolStep {
  name: string;
  status: "running" | "done" | "error";
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [toolSteps, setToolSteps] = useState<ToolStep[]>([]);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, toolSteps, scrollToBottom]);

  async function handleSubmit(questionOverride?: string) {
    const question = (questionOverride ?? input).trim();
    if (!question || isStreaming) return;

    setInput("");
    setError(null);
    setToolSteps([]);
    setThinking(false);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    setThinking(true);

    try {
      const res = await fetch("/api/brain/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Request failed" }));
        throw new Error(err.message ?? err.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6);
          try {
            const event = JSON.parse(json);
            handleEvent(event);
          } catch {
            // skip malformed events
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsStreaming(false);
      setThinking(false);
      inputRef.current?.focus();
    }
  }

  function handleEvent(
    event: { type: string; [key: string]: unknown },
  ) {
    switch (event.type) {
      case "thinking":
        setThinking(true);
        break;

      case "tool_call":
        setToolSteps((prev) => [
          ...prev,
          { name: event.name as string, status: "running" },
        ]);
        break;

      case "tool_result":
        setToolSteps((prev) =>
          prev.map((s) =>
            s.name === event.name && s.status === "running"
              ? { ...s, status: (event.isError ? "error" : "done") as ToolStep["status"] }
              : s
          )
        );
        break;

      case "answer": {
        setThinking(false);
        const data = event.data as {
          markdown?: string;
          sourcesConsulted?: Source[];
        };
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data?.markdown ?? JSON.stringify(data, null, 2),
          sources: data?.sourcesConsulted,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setToolSteps([]);
        break;
      }

      case "error":
        setError(event.message as string);
        setThinking(false);
        setToolSteps([]);
        break;
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handlePersonSelect(person: {
    givenName: string;
    familyName: string;
  }) {
    const question = `Tell me about ${person.givenName} ${person.familyName}. What do we know?`;
    handleSubmit(question);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-card-border bg-card-bg/50">
        <h1 className="text-lg font-semibold">Dark Horse Research</h1>
        <PersonSearch onSelect={handlePersonSelect} />
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-2"
      >
        {messages.length === 0 && !isStreaming && (
          <div className="text-center text-muted py-20">
            <p className="text-lg mb-2">Ask Dark Horse anything.</p>
            <p className="text-sm">
              Try: &ldquo;Who are the current Orleans Parish judges?&rdquo; or
              &ldquo;What donations has [name] received?&rdquo;
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            role={msg.role}
            content={msg.content}
            sources={msg.sources}
          />
        ))}

        {isStreaming && (
          <ToolProgress steps={toolSteps} thinking={thinking} />
        )}

        {error && (
          <div className="mx-2 px-4 py-3 bg-danger/10 border border-danger/30 rounded text-sm text-danger">
            {error}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-card-border px-4 py-3 bg-card-bg/30">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            rows={1}
            disabled={isStreaming}
            className="flex-1 px-3 py-2 text-sm border border-card-border rounded resize-none bg-background text-foreground placeholder:text-muted focus:outline-none focus:border-accent disabled:opacity-50"
            style={{ minHeight: "2.5rem", maxHeight: "8rem" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
            }}
          />
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isStreaming || !input.trim()}
            className="px-4 py-2 text-sm font-medium bg-accent text-white rounded hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isStreaming ? "Thinking..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
