"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/admin");
      router.refresh();
    } else {
      setError("Wrong password.");
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-24">
      <h1 className="mb-6 text-2xl font-bold">Admin</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="mb-3 w-full border border-card-border bg-card-bg px-3 py-2 text-sm"
          autoFocus
        />
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        <button
          type="submit"
          className="w-full bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
