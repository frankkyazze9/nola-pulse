"use client";

import Link from "next/link";
import { useState } from "react";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/council", label: "Council Whisperer" },
  { href: "/blackout", label: "Blackout" },
  { href: "/floods", label: "Floods" },
  { href: "/displacement", label: "Displacement" },
  { href: "/entities", label: "Entities" },
  { href: "/budget", label: "Budget" },
  { href: "/articles", label: "Articles" },
  { href: "/forum", label: "Forum" },
];

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="border-b border-card-border bg-card-bg">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-bold tracking-tight">
          <span className="text-accent">NOLA</span> Pulse
        </Link>

        <button
          className="text-muted hover:text-foreground md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? "Close" : "Menu"}
        </button>

        <div className="hidden gap-6 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      {open && (
        <div className="flex flex-col gap-2 border-t border-card-border px-6 py-4 md:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted transition-colors hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
