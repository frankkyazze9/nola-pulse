import { FeatureCard } from "@/components/FeatureCard";

const features = [
  {
    href: "/dashboard",
    title: "NOLA Pulse Dashboard",
    description:
      "Real-time civic data — infrastructure stats, city KPIs, and the numbers nobody talks about.",
    status: "coming-soon" as const,
    icon: "📊",
  },
  {
    href: "/council",
    title: "Council Whisperer",
    description:
      "AI-generated summaries of city council meetings. What they said, what they meant, what it means for you.",
    status: "coming-soon" as const,
    icon: "🏛️",
  },
  {
    href: "/blackout",
    title: "Blackout Prediction",
    description:
      "Predicting power outages before Entergy tells you. Because 304,178 outages a year is not acceptable.",
    status: "coming-soon" as const,
    icon: "⚡",
  },
  {
    href: "/floods",
    title: "Flood Predictions",
    description:
      "Flood risk by neighborhood, pump station status, and drainage reality checks.",
    status: "coming-soon" as const,
    icon: "🌊",
  },
  {
    href: "/displacement",
    title: "Displacement Tracker",
    description:
      "Tracking where people are being pushed out — STRs, evictions, demolitions, and the quiet erasure of neighborhoods.",
    status: "coming-soon" as const,
    icon: "🏘️",
  },
  {
    href: "/entities",
    title: "Entity Predictions",
    description:
      "Tracking organizations, contracts, and the money trail through New Orleans.",
    status: "coming-soon" as const,
    icon: "🔍",
  },
  {
    href: "/budget",
    title: "Budget Explorer",
    description:
      "Where the city's money actually goes. Interactive, searchable, and impossible to spin.",
    status: "coming-soon" as const,
    icon: "💰",
  },
  {
    href: "/articles",
    title: "Daily Article",
    description:
      "AI-generated daily civic analysis written in Frank's voice. Data meets storytelling.",
    status: "coming-soon" as const,
    icon: "📝",
  },
  {
    href: "/forum",
    title: "Community Forum",
    description:
      "Suggest the next AI project for New Orleans. Vote on what matters most.",
    status: "coming-soon" as const,
    icon: "💬",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="mb-16 text-center">
        <h1 className="mb-4 text-5xl font-bold tracking-tight">
          <span className="text-accent">NOLA</span> Pulse
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-muted">
          AI-powered civic intelligence for New Orleans. Data that holds power
          accountable, predictions that keep people safe, and tools that make
          government accessible.
        </p>
        <p className="mt-4 text-sm text-muted">
          Built by Frank Kyazze — for the people who actually live here.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <FeatureCard key={feature.href} {...feature} />
        ))}
      </div>
    </div>
  );
}
