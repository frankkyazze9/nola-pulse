export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="mb-6 text-3xl font-bold">About</h1>
      <div className="space-y-4 text-muted leading-relaxed">
        <p>
          NOLA Pulse covers New Orleans through data. We pull from public city
          records — 311 complaints, building permits, police reports, code
          enforcement cases, short-term rental licenses — and write about what
          the numbers actually say.
        </p>
        <p>
          Every stat we cite comes from{" "}
          <a href="https://data.nola.gov" className="text-accent hover:underline">
            data.nola.gov
          </a>
          , the city&apos;s open data portal. We don&apos;t make numbers up.
          We don&apos;t need to — the real ones are interesting enough.
        </p>
        <p>
          New stories published daily. Updated by machines, reviewed by humans.
        </p>
      </div>
    </div>
  );
}
