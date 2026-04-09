import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const articles = await prisma.article.findMany({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
    take: 20,
  });

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <p className="text-xs text-muted mb-6">{today}</p>

      {articles.length === 0 ? (
        <p className="text-muted">No stories yet. Check back tomorrow.</p>
      ) : (
        <div>
          {articles.map((article, i) => (
            <div key={article.id}>
              <article className="py-4">
                <a
                  href={`/articles/${article.slug}`}
                  className="no-underline hover:underline"
                >
                  <h2 className={`font-bold leading-tight ${i === 0 ? "text-2xl mb-2" : "text-lg mb-1"}`}>
                    {article.title}
                  </h2>
                </a>
                {i === 0 && (
                  <p className="text-sm text-muted mb-1">
                    {article.body
                      .replace(/^#.*\n/m, "")
                      .replace(/[#*_`]/g, "")
                      .trim()
                      .slice(0, 300)}...
                  </p>
                )}
                <p className="text-xs text-muted">
                  {article.publishedAt
                    ? new Date(article.publishedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    : ""}
                </p>
              </article>
              {i < articles.length - 1 && <hr />}
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 pt-4 border-t border-card-border text-xs text-muted">
        <p>
          All data sourced from{" "}
          <a href="https://data.nola.gov">data.nola.gov</a>.
          {" "}116,000+ public records and counting.
        </p>
      </div>
    </div>
  );
}
