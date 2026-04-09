import { FeatureCard } from "@/components/FeatureCard";

const features = [
  {
    href: "/articles",
    title: "The Picayune (Satire)",
    description:
      "Onion-style articles about New Orleans. Fake headlines, real data. The news the city deserves.",
    status: "live" as const,
    icon: "📰",
  },
  {
    href: "/dashboard",
    title: "The Numbers",
    description:
      "Real civic data that's so bad it's funny. 311 complaints, blight cases, and other evidence that God has a sense of humor.",
    status: "live" as const,
    icon: "📊",
  },
  {
    href: "/displacement",
    title: "Airbnb vs Actual Humans",
    description:
      "4,090 STR licenses and counting. A neighborhood-by-neighborhood look at who's winning: tourists or residents. (Spoiler: tourists.)",
    status: "live" as const,
    icon: "🏘️",
  },
  {
    href: "/blackout",
    title: "Entergy Bingo",
    description:
      "304,178 outages in 2025. At this point the power going out IS the New Orleans experience.",
    status: "live" as const,
    icon: "⚡",
  },
  {
    href: "/floods",
    title: "Flood Roulette",
    description:
      "$939M in drainage upgrades needed. 7% funded. Catch basins haven't been cleaned since the 90s. Good luck out there.",
    status: "live" as const,
    icon: "🌊",
  },
  {
    href: "/budget",
    title: "Where the Money Goes",
    description:
      "City salaries, tax revenue, and business licenses. Someone's getting paid. Let's find out who.",
    status: "live" as const,
    icon: "💰",
  },
  {
    href: "/entities",
    title: "Who Runs This City",
    description:
      "Every elected official, what they oversee, and the data on their watch. Public servants, public record.",
    status: "live" as const,
    icon: "🏛️",
  },
  {
    href: "/forum",
    title: "Suggest a Meme",
    description:
      "Got a New Orleans experience that needs to be roasted? Drop it here.",
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
          New Orleans memes backed by real civic data. Because the only way to
          deal with 355-day pothole response times is to laugh about it.
        </p>
        <p className="mt-4 text-sm text-muted">
          Satire. Data. Chaos. For the people who actually live here.
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
