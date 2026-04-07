export default async function CouncilMeetingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-4 text-3xl font-bold">Council Meeting</h1>
      <p className="text-muted">Meeting slug: {slug}</p>
      <div className="mt-8 rounded-xl border border-card-border bg-card-bg p-8 text-center">
        <p className="text-muted">Meeting summary will appear here once ingested.</p>
      </div>
    </div>
  );
}
