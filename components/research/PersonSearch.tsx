"use client";

import { useState, useRef, useEffect } from "react";

interface PersonResult {
  id: string;
  givenName: string;
  familyName: string;
  middleName?: string;
  suffix?: string;
  party?: string;
  aliases?: string[];
}

interface PersonSearchProps {
  onSelect: (person: PersonResult) => void;
}

export default function PersonSearch({ onSelect }: PersonSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/people?q=${encodeURIComponent(value)}&limit=8`
        );
        if (res.ok) {
          const data = (await res.json()) as { results: PersonResult[] };
          setResults(data.results);
          setOpen(data.results.length > 0);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
  }

  function handleSelect(person: PersonResult) {
    setOpen(false);
    setQuery("");
    setResults([]);
    onSelect(person);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Search people..."
        className="w-full sm:w-64 px-3 py-1.5 text-sm border border-card-border rounded bg-background text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
      />
      {loading && (
        <span className="absolute right-3 top-2 text-xs text-muted animate-pulse">
          ...
        </span>
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-50 top-full left-0 mt-1 w-full sm:w-80 bg-background border border-card-border rounded shadow-lg max-h-60 overflow-y-auto">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => handleSelect(p)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-card-bg border-b border-card-border last:border-0"
              >
                <span className="font-medium">
                  {p.givenName} {p.middleName ? `${p.middleName} ` : ""}
                  {p.familyName}
                  {p.suffix ? ` ${p.suffix}` : ""}
                </span>
                {p.party && (
                  <span className="ml-2 text-muted text-xs">({p.party})</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
