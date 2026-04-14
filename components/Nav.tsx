"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/cases", label: "Cases" },
  { href: "/projects", label: "Projects" },
  { href: "/elections", label: "Elections" },
  { href: "/research", label: "Research" },
  { href: "/admin", label: "Admin" },
];

export default function Nav() {
  const pathname = usePathname();

  // Don't show nav on the login page
  if (pathname === "/login") return null;

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className="border-b border-card-border bg-card-bg/30 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-2">
        <Link href="/" className="font-semibold text-sm mr-6 shrink-0">
          Dark Horse
        </Link>
        <div className="flex items-center gap-1 overflow-x-auto">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 text-sm rounded whitespace-nowrap transition-colors ${
                isActive(link.href)
                  ? "bg-accent text-white"
                  : "text-muted hover:text-foreground hover:bg-card-bg"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
