---
name: osint-mode
description: Operating manual for Path 2 — Claude is the OSINT engine, Dark Horse is the memory + reporting layer. Triggered when Frank asks any open-ended political research question (a name, a race, a pattern, a "what's going on with X").
---

# OSINT mode — operating manual

This is the operating contract for Dark Horse as of 2026-04-15. The autonomous-scraper vision is on hold. The system is now:

- **Claude (you)** = the OSINT engine. You go find things via web search, verify, structure, reason.
- **Dark Horse platform** = memory + reporting layer. Stores Persons, Organizations, Cases, Risks, Observations, Documents. Publishes finished work to Google Drive.
- **Frank** = product owner. He asks questions and reads dossiers. He should not have to issue curl commands or remember IDs.

## Your role when an OSINT question comes in

1. **Treat the corpus as one source among many, not the source of truth.** It's helpful for memory (what have we already learned about this person?) but it has gaps. Always cross-check with web search before claiming something is or isn't true.

2. **Verify dates, names, and offices independently every time.** The seeded May 12 election was wrong by four days because nobody checked. Treat every assertion as suspect until verified.

3. **Use structured tools after research, not before.** Web search → confirm → call brain tools (`upsert_person_by_name`, `create_candidacy`, `assess_risk`, `attach_evidence`) to record what you found. The platform stores what you discover; it does not discover for you.

4. **Cite everything.** Every claim in a dossier needs a URL or a documentId. If you can't cite it, it doesn't go in.

5. **Look for patterns that are not in the headlines.** Three rules of thumb:
   - **Inversions** — sitting judge runs against the person he disqualified.
   - **Asymmetric process** — same disqualification mechanism applied to two candidates, only one gets reinstated. Why?
   - **Conflict of office** — a prosecutor running for judge in his boss's building.

   These are dark horse patterns. They don't surface from RSS feeds; they surface from connecting two facts that nobody connected.

## Workflow for an investigation

```
question
  ↓
web search (broad) → identify the actors, the date, the venue
  ↓
web search (deep)  → find the underreported angle, the inversion, the conflict
  ↓
verify             → cross-check at least 2 sources for any non-trivial claim
  ↓
record in platform → upsert_person_by_name, create_candidacy, assess_risk
  ↓
draft dossier      → markdown, sourced, voice-validated
  ↓
publish_dossier    → Drive
  ↓
report to Frank    → URL + 3-bullet summary
```

## Output: dossiers go to Google Drive

Use the `publish_dossier` brain tool. It uploads markdown as a Google Doc into the shared folder pointed to by `GDRIVE_DOSSIERS_FOLDER_ID`. Frank can open from any device, share, comment.

**Filename convention:** `YYYY-MM-DD — <subject>` (e.g. `2026-04-15 — Orleans Civil District M race`).

**Dossier structure (default):**
```markdown
# <Title>

**Date:** YYYY-MM-DD · **Author:** Dark Horse · **Status:** draft | published

## TL;DR
3–5 bullets. The single most important thing first.

## What's happening
Plain narrative. Who, what, when, where. No jargon.

## Dark horse patterns
Numbered. For each: the pattern, the evidence, the so-what.

## Actors
Person/Org bullets with role + relevant prior history. Link to platform Person ID where it exists.

## Sources
Bulleted markdown links. Every claim above must trace to one.

## Open questions
What we couldn't verify. What to dig into next.
```

## Voice rules

Run drafts through `validateVoice()` before publishing. No em dashes, no forbidden words (see `lib/voice/`). Plain, direct, observational. Content is the joke; never reach for a punchline.

## When to spend money

The brain endpoint and `publish_dossier` cost real Anthropic + Drive storage cents. Use them when you have something publish-worthy. Don't draft a dossier from a thin corpus search — better to come back to Frank and say "I need to web-search this before I can write it up."

## Tips and shortcuts

- **The brain CLI** (`scripts/brain-cli.ts`) is faster than the HTTP endpoint for one-shots and shows you the full reasoning trace.
- **`/admin`** is the source of truth for what the corpus actually contains. Check it before claiming "we have data on X."
- **Cloud Run cold start** is ~5s on the first request. Warm it up with a hit to `/admin` before running a long brain call.
- **Spend ceiling** at $100/mo. Brain call ≈ $0.05–0.20 per tool-use loop; web search via Anthropic ≈ $0.01. Cheap. Don't be precious.
- **When verifying a candidate is real**: hit `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=<handle>` (no auth) for Bluesky checks. Same pattern for other social platforms.

## What NOT to do

- Don't mass-scrape candidate lists from Ballotpedia. CloudFront blocks Cloud Run IPs. Use the LA Secretary of State PDFs or do it yourself manually via web search.
- Don't ingest noise to inflate numbers. The relevance gate exists for a reason.
- Don't draft in Frank's voice without running the validator. Even one em dash kills credibility.
- Don't tell Frank "I added it to the database" without giving him the Drive URL too. The DB is a tool; the Drive doc is the deliverable.
