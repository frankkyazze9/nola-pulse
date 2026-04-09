import { prisma } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home() {
  const articles = await prisma.article.findMany({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
    take: 10,
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-12">
        <h1 className="mb-3 text-4xl font-bold tracking-tight">
          <span className="text-accent">NOLA</span> Pulse
        </h1>
        <p className="text-muted">
          New Orleans news and data. Updated daily.
        </p>
      </div>

      {articles.length === 0 ? (
        <p className="text-muted">Stories coming soon.</p>
      ) : (
        <div className="flex flex-col gap-10">
          {articles.map((article, i) => (
            <article key={article.id}>
              <Link href={`/articles/${article.slug}`} className="group">
                <h2
                  className={`mb-2 font-bold leading-tight group-hover:text-accent ${
                    i === 0 ? "text-3xl" : "text-xl"
                  }`}
                >
                  {article.title}
                </h2>
              </Link>
              <p className="mb-2 text-sm leading-relaxed text-muted">
                {article.body
                  .replace(/^#.*\n/m, "")
                  .replace(/[#*_`]/g, "")
                  .trim()
                  .slice(0, 250)}
                ...
              </p>
              <p className="text-xs text-muted">
                {article.publishedAt
                  ? new Date(article.publishedAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  : ""}
              </p>
              {i < articles.length - 1 && (
                <div className="mt-10 border-b border-card-border" />
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
