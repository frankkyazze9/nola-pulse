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
  title: "NOLA Pulse — New Orleans Civic Intelligence",
  description:
    "AI-powered civic dashboard for New Orleans. Council summaries, outage predictions, displacement tracking, budget exploration, and more.",
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
          <p>
            NOLA Pulse — Built by{" "}
            <span className="text-foreground">Frank Kyazze</span> for New
            Orleans
          </p>
        </footer>
      </body>
    </html>
  );
}
