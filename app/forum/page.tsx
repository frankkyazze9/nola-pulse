export default function ForumPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold">
        <span className="text-accent">Community</span> Forum
      </h1>
      <p className="mb-8 text-muted">
        Suggest the next AI project for New Orleans. What tool would make your
        life easier, hold power accountable, or keep people safe? Vote on
        what matters most.
      </p>

      <div className="mb-8 rounded-xl border border-card-border bg-card-bg p-6">
        <h2 className="mb-4 text-lg font-semibold">Suggest a Project</h2>
        <form className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Your name"
            className="rounded-lg border border-card-border bg-background px-4 py-2 text-foreground placeholder:text-muted"
            disabled
          />
          <input
            type="text"
            placeholder="Project title"
            className="rounded-lg border border-card-border bg-background px-4 py-2 text-foreground placeholder:text-muted"
            disabled
          />
          <textarea
            placeholder="Describe the AI tool you'd like to see built for New Orleans..."
            rows={4}
            className="rounded-lg border border-card-border bg-background px-4 py-2 text-foreground placeholder:text-muted"
            disabled
          />
          <button
            type="submit"
            className="self-start rounded-lg bg-accent px-6 py-2 font-medium text-background opacity-50"
            disabled
          >
            Submit (Coming Soon)
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-card-border bg-card-bg p-8 text-center">
        <p className="text-muted">
          Community suggestions will appear here. No account required to post.
        </p>
      </div>
    </div>
  );
}
