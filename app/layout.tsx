import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NOLA Pulse — New Orleans Memes Backed by Real Data",
  description:
    "Satirical articles, memes, and comedy about New Orleans — powered by 116,000+ real civic records. The Onion meets data.nola.gov.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Nav />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-card-border px-6 py-8 text-center text-sm text-muted">
          <p>NOLA Pulse — Satire. Data. Chaos.</p>
        </footer>
      </body>
    </html>
  );
}
