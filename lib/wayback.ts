/**
 * Internet Archive Wayback Machine helpers.
 *
 * Dark Horse calls `savePageNow()` on every scraped URL so there is a
 * public, citable, permanent copy of any source a dossier cites. If the
 * Wayback call fails, the scraper continues — provenance is best-effort
 * but not blocking.
 */

const USER_AGENT = "DarkHorse/1.0 (+internal political research tool)";

/**
 * Trigger a fresh capture via SavePageNow. Returns the resulting Wayback URL
 * or null on failure. Usually takes 2-10 seconds.
 */
export async function savePageNow(url: string): Promise<string | null> {
  try {
    const response = await fetch("https://web.archive.org/save/" + url, {
      method: "GET",
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) return null;
    const finalUrl = response.url;
    return finalUrl.startsWith("https://web.archive.org/web/") ? finalUrl : null;
  } catch (err) {
    console.warn(`[wayback] savePageNow failed for ${url}:`, err);
    return null;
  }
}

/**
 * Return the most recent Wayback snapshot for a URL, or null if none exists.
 */
export async function getLatestSnapshot(url: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`,
      {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (!response.ok) return null;
    const data = (await response.json()) as {
      archived_snapshots?: { closest?: { available: boolean; url: string } };
    };
    return data.archived_snapshots?.closest?.available
      ? data.archived_snapshots.closest.url
      : null;
  } catch {
    return null;
  }
}

/**
 * Get or create a snapshot. Returns an existing snapshot if available,
 * otherwise tries to create one.
 */
export async function archiveUrl(url: string): Promise<string | null> {
  const existing = await getLatestSnapshot(url);
  if (existing) return existing;
  return savePageNow(url);
}
