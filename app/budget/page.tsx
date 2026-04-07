export default function BudgetPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold">
        <span className="text-accent">Budget</span> Explorer
      </h1>
      <p className="mb-8 text-muted">
        Where the city&apos;s money actually goes. Interactive, searchable, and
        impossible to spin. Every department, every fund, every line item.
      </p>

      <div className="rounded-xl border border-card-border bg-card-bg p-8 text-center">
        <p className="mb-4 text-lg font-semibold">Budget data loading soon</p>
        <p className="text-muted">
          Will ingest the city&apos;s adopted budget and render it as a
          searchable, sortable table with interactive Sankey flow charts showing
          where money flows from fund to department to program.
        </p>
      </div>
    </div>
  );
}
