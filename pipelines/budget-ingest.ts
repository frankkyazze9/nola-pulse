/**
 * City Budget Data Ingest
 *
 * Parses New Orleans' adopted budget (typically PDF or Excel) and loads
 * line items into the budget_line_items table.
 *
 * TODO:
 * - Download budget document from city website
 * - Parse PDF/Excel into structured data
 * - Map to: fiscalYear, department, fund, category, description, amount
 * - Upsert into database
 */

export async function ingestBudgetData(filePath?: string) {
  console.log("Budget ingest not yet implemented");
  console.log("Need:");
  console.log("  - City budget document (PDF or Excel)");
  console.log(
    "  - Source: https://www.nola.gov/administration/budget/"
  );
  console.log("  - PDF parsing library (pdf-parse) or Excel parser (xlsx)");

  return { status: "not_implemented", lineItems: 0 };
}

const isMainModule =
  typeof require !== "undefined" && require.main === module;

if (isMainModule) {
  ingestBudgetData(process.argv[2])
    .then((result) => console.log(result))
    .catch((err) => {
      console.error("Ingest failed:", err);
      process.exit(1);
    });
}
