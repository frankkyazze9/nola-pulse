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
    <div className="mx-auto max-w-3xl px-6 py-12">
      <article>
        <h1 className="mb-4 text-3xl font-bold">{article.title}</h1>
        <p className="mb-8 text-sm text-muted">
          {article.publishedAt
            ? new Date(article.publishedAt).toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            : ""}
        </p>
        <div className="prose prose-invert max-w-none whitespace-pre-wrap text-foreground leading-relaxed">
          {article.body}
        </div>
      </article>
    </div>
  );
}
