export default async function ForumPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-4 text-3xl font-bold">Forum Post</h1>
      <p className="text-muted">Post ID: {id}</p>
      <div className="mt-8 rounded-xl border border-card-border bg-card-bg p-8 text-center">
        <p className="text-muted">Post details will appear here.</p>
      </div>
    </div>
  );
}
