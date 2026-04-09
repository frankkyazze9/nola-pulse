import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NOLA Pulse",
  description:
    "New Orleans news and data. Stories from 116,000+ public civic records. Updated daily.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col text-base leading-relaxed">
        <header className="border-b border-card-border">
          <div className="mx-auto max-w-2xl px-4 py-3">
            <div className="flex items-baseline justify-between">
              <a href="/" className="text-2xl font-bold tracking-tight no-underline text-foreground">
                NOLA PULSE
              </a>
              <nav className="flex gap-4 text-sm">
                <a href="/articles">Stories</a>
                <a href="/about">About</a>
              </nav>
            </div>
            <p className="text-xs text-muted mt-0.5">New Orleans news & data</p>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-card-border px-4 py-6 text-center text-xs text-muted">
          <p>NOLA Pulse &middot; data from <a href="https://data.nola.gov">data.nola.gov</a></p>
        </footer>
      </body>
    </html>
  );
}
