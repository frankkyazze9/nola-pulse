import Link from "next/link";

interface FeatureCardProps {
  href: string;
  title: string;
  description: string;
  status: "live" | "coming-soon";
  icon: string;
}

export function FeatureCard({
  href,
  title,
  description,
  status,
  icon,
}: FeatureCardProps) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-card-border bg-card-bg p-6 transition-colors hover:border-accent"
    >
      <div className="mb-3 text-3xl">{icon}</div>
      <h3 className="mb-2 text-lg font-semibold text-foreground group-hover:text-accent">
        {title}
      </h3>
      <p className="mb-3 text-sm text-muted">{description}</p>
      {status === "coming-soon" && (
        <span className="inline-block rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
          Coming Soon
        </span>
      )}
    </Link>
  );
}
