"use client";

export default function LoginPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-sm rounded-xl border border-card-border bg-card-bg p-8 text-center">
        <h1 className="mb-2 text-2xl font-bold">
          <span className="text-accent">Command</span> Center
        </h1>
        <p className="mb-6 text-sm text-muted">
          Sign in to access the NOLA Pulse admin panel.
        </p>
        <a
          href="/api/auth/signin/google"
          className="inline-block rounded-lg bg-accent px-6 py-3 font-medium text-background transition-colors hover:bg-accent-hover"
        >
          Sign in with Google
        </a>
      </div>
    </div>
  );
}
