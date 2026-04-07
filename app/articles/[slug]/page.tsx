export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <article>
        <h1 className="mb-4 text-3xl font-bold">Article</h1>
        <p className="text-muted">Article slug: {slug}</p>
        <div className="mt-8 rounded-xl border border-card-border bg-card-bg p-8 text-center">
          <p className="text-muted">Article content will appear here.</p>
        </div>
      </article>
    </div>
  );
}
