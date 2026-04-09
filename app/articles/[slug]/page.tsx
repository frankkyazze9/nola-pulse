import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const article = await prisma.article.findUnique({
    where: { slug },
  });

  if (!article || article.status !== "published") {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <article>
        <h1 className="text-3xl font-bold leading-tight mb-2">
          {article.title}
        </h1>
        <p className="text-xs text-muted mb-8">
          {article.publishedAt
            ? new Date(article.publishedAt).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })
            : ""}
        </p>
        <div className="whitespace-pre-wrap leading-7 text-foreground">
          {article.body
            .replace(/^#.*\n/m, "")
            .replace(/^#+\s/gm, "")
            .trim()}
        </div>
      </article>
      <div className="mt-12 pt-4 border-t border-card-border">
        <a href="/" className="text-sm">&larr; Back to stories</a>
      </div>
    </div>
  );
}
