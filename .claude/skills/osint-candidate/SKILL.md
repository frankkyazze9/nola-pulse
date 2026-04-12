---
name: osint-candidate
description: Standard workflow for adding a new political candidate to Dark Horse and producing their first dossier — which scrapers to trigger, how to fill each dossier section, how to surface coverage gaps.
---

# Adding a candidate to Dark Horse

This is the end-to-end workflow for onboarding a new Louisiana political figure into Dark Horse. Follow it when Christine says *"get me everything we have on Judge X"* or *"start a file on this new council candidate."*

## Step 1 — Create or look up the Person entity

Try to resolve to an existing `Person` first:

```sql
SELECT * FROM "Person"
WHERE "familyName" ILIKE '<surname>'
  AND ("givenName" ILIKE '<given>%' OR '<given>' = ANY("aliases"));
```

If no match, create a new row with as many identifiers as you can find:

- **OCD-ID** — `lib/ocd.ts` helpers. For LA offices, use the `ocd-person/...` format if known; otherwise leave null and let entity resolution fill it.
- **Wikidata QID** — query Wikidata SPARQL for Louisiana politicians matching the name. Populates aliases, date of birth, and office history.
- **FEC candidate ID** — look up on `api.open.fec.gov` by name + state LA. Only for federal candidates.
- **LA Ethics ID** — not stable; usually filled during `scraper-la-ethics-live` runs.

## Step 2 — Trigger the scrapers

Run these in order (parallelizable from step 3 onward):

1. **`scraper-fec --candidateName "<name>"`** — only if federal. Upserts candidate + committees + donations.
2. **`scraper-la-ethics-bootstrap`** — already loaded historical (1997-2021). Check the candidate shows up in `Donation` / `Organization` rows.
3. **`scraper-la-ethics-live --candidate "<id>"`** — pulls 2022-present filings for the candidate. Longest-running step; budget 10-30 minutes.
4. **`scraper-la-ethics-pfd --person "<id>"`** — Personal Financial Disclosures. PDFs flow into the document pipeline.
5. **`scraper-courtlistener --party "<name>"`** — federal courts.
6. **`scraper-nola-news-rss`** — incremental; runs nightly anyway. Check the `Document` table for the candidate's name.
7. **`scraper-gdelt --entity "<name>"`** — filters GDELT firehose for mentions.
8. **`scraper-nola-council-granicus`** — if they're a council member or frequent hearing attendee.
9. **`scraper-orleans-assessor --owner "<name>"`** — property records.

## Step 3 — Wait for entity resolution

After the scrapers write new Person/Organization rows, Splink runs on the nightly entity-resolution job. Inspect `EntityMatch` for any `needs_review` pairs involving the new candidate — resolve them via the admin UI (or SQL) before dossier generation.

## Step 4 — Generate the dossier

```bash
npm run test:dossier -- --personId <cuid>
```

This runs the brain in dossier mode. Output is structured JSON with every section populated where data exists.

## Step 5 — Review coverage gaps

The dossier JSON includes `coverageGaps[]` — sections the brain couldn't fill. Common gaps for LA candidates:

- **Personal finance** — only exists for candidates above the PFD threshold. Judges, statewide officials, and PSC members usually have them; school board members usually don't.
- **Court records** — Orleans Parish Civil Clerk requires the $700/yr subscription (Priority 3). Criminal is free via Clerk Connect.
- **Pre-2021 state-level campaign finance** — Accountability Project data stops in 2021; LA Ethics live scrape picks up from 2022.
- **Pre-Bluesky social media** — X API is pay-per-use, Meta is locked. Public statements from 2020-2023 may need manual curation.

Hand coverage gaps to Christine before delivering — "here's what we have, here's what we don't" is a professional norm.

## Step 6 — Iterate

For each gap:
- Is there a source we haven't scraped? → add it via `add-data-source` skill.
- Is there a scraper that failed? → check `ScraperRun` for error details.
- Is the data simply unavailable publicly? → note the gap, Christine can decide whether to FOIA.

## Canonical predicates for claims

When the brain extracts or writes claims, use a consistent predicate vocabulary so search_claims works cleanly:

- `holds_office` — Person holds/held Post
- `ran_for` — Person was candidate in Election
- `voted_for` / `voted_against` — Person voted on a bill (with bill ID in object)
- `donated_to` — Donor gave to Committee/Candidate
- `received_donation_from` — inverse
- `was_party_to` — Person in court case
- `owns` / `owned` — Ownership
- `was_quoted_saying` — public statement with context
- `attended` — hearing / event
- `employed_by` — employment history
- `associated_with` — general catch-all, use sparingly

Extend this vocabulary in `lib/brain/predicates.ts` when you have a genuinely new relation.
