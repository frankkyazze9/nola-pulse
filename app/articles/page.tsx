import { prisma } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ArticlesPage() {
  const articles = await prisma.article.findMany({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
    take: 20,
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold">
        <span className="text-accent">Daily</span> Article
      </h1>
      <p className="mb-8 text-muted">
        AI-generated civic analysis. The most interesting thing happening in New
        Orleans, explained by someone who actually lives here.
      </p>

      {articles.length === 0 ? (
        <div className="rounded-xl border border-card-border bg-card-bg p-8 text-center">
          <p className="mb-4 text-lg font-semibold">No articles yet</p>
          <p className="text-muted">
            Articles are generated daily and published after review.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {articles.map((article) => (
            <Link
              key={article.id}
              href={`/articles/${article.slug}`}
              className="group rounded-xl border border-card-border bg-card-bg p-6 transition-colors hover:border-accent"
            >
              <h2 className="mb-2 text-xl font-semibold group-hover:text-accent">
                {article.title}
              </h2>
              <p className="mb-3 text-sm text-muted">
                {article.body.slice(0, 200).replace(/[#*_]/g, "")}...
              </p>
              <p className="text-xs text-muted">
                {article.publishedAt
                  ? new Date(article.publishedAt).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
