"use client";

import Link from "next/link";

export function Nav() {
  return (
    <nav className="border-b border-card-border bg-card-bg">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-bold tracking-tight">
          <span className="text-accent">NOLA</span> Pulse
        </Link>
        <div className="flex gap-6">
          <Link
            href="/articles"
            className="text-sm text-muted transition-colors hover:text-foreground"
          >
            Stories
          </Link>
          <Link
            href="/about"
            className="text-sm text-muted transition-colors hover:text-foreground"
          >
            About
          </Link>
        </div>
      </div>
    </nav>
  );
}
