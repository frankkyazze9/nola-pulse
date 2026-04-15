# Dark Horse — Data Gaps (Frank's manual actions for tomorrow)

These unlock real data sources. Each one I can't do without you because it requires account creation, API key provisioning, or curation of Louisiana-specific knowledge I can't verify myself. Each section is a full step-by-step.

---

## 1. Facebook Ad Library API (10 min) — UNLOCKS POLITICAL AD SPEND

**Why it matters:** Free access to every political ad run on Meta (Facebook + Instagram). Zero recurring cost. Lets us track who's spending on what for LA races, build opposition maps, and flag issue-campaign coordination.

**Steps:**
1. Go to [developers.facebook.com](https://developers.facebook.com/)
2. Log in with the Facebook account you want to use (personal is fine — this is dev-tool access)
3. Top right → My Apps → Create App
4. Use case: **Other** → App type: **Business**
5. App name: `Dark Horse Research` (or anything). Contact email: yours.
6. Once created, left sidebar → **Add products** → find **Ad Library API** → click Set Up
7. In the Ad Library API settings, get your **Access Token** (long string starting with `EAA...`)
8. Send me the token. I'll drop it in Secret Manager as `FACEBOOK_ACCESS_TOKEN` and wire up a daily cron.

The token is short-lived (~2 months) so we'll need to refresh it. I'll set a calendar reminder and add a warning to `/admin` when it expires.

---

## 2. Bluesky handles — UNLOCKS LA POLITICAL SOCIAL MEDIA (5 min)

**Why it matters:** Bluesky is where a chunk of the political class migrated from X. Placeholder handle list returns nothing. Real list = real posts.

**Steps:**
1. Open Bluesky (bsky.app or the app) — you don't even need an account for this, just visit the site
2. Paste me handles you know for any of these (if they're on Bluesky — not all will be):
   - Politicians: Jeff Landry, Helena Moreno, Jason Williams (OPDA), Susan Hutson (OPSO), any state reps/senators you follow, city council members
   - Journalists: The Lens staff, Louisiana Illuminator staff, Verite reporters, Gordon Russell (NOLA.com/Advocate), Tyler Bridges
   - Orgs: @louisianailluminator.bsky.social (guess), @thelens.bsky.social (guess), @veritenews.bsky.social (guess), Pelican Institute, LA Democratic Party, LA GOP
   - Any Louisiana political figures YOU already follow — doesn't have to be comprehensive, I can expand from there
3. Don't verify they exist — I'll prune 404s from the list automatically. Better to over-submit.

Once I have handles, I update `pipelines/scrapers/bluesky/handles.json` and the cron picks it up. Zero additional setup on your end.

---

## 3. LegiScan API key (2 min) — UNLOCKS LA LEGISLATURE DATA

**Why it matters:** Bills, votes, committee assignments, member profiles, roll-calls — all structured data from the LA Legislature. Free tier is 30K queries/month, plenty for us.

**Steps:**
1. Go to [legiscan.com/user/register](https://legiscan.com/user/register)
2. Create a free account (email + password)
3. After confirmation, log in → **API** tab → get your **API Key**
4. Send it to me. I set `LEGISCAN_API_KEY` in Secret Manager and I implement the scraper (the stub is there; I fill it in).

---

## 4. CourtListener API key (2 min — OPTIONAL) — HIGHER RATE LIMITS

**Why it matters:** The courtlistener scraper already works without a key (5 req/sec anonymous). A key raises it to 50 req/sec. Worth it if we're doing intensive court research on a specific candidate, otherwise skip.

**Steps:**
1. [courtlistener.com/sign-up/](https://www.courtlistener.com/sign-up/)
2. Free account, verify email
3. Profile → API → generate a token
4. Send it to me → I add as `COURTLISTENER_API_KEY` in Secret Manager

**Skip-for-now is fine.** No blocker.

---

## 5. FEC API key (2 min — OPTIONAL) — HIGHER RATE LIMITS

**Why it matters:** Same as CourtListener — DEMO_KEY works but is rate-limited to 30 req/hr. A real key is 1000 req/hr (or 7200 with an email request).

**Steps:**
1. [api.data.gov/signup/](https://api.data.gov/signup/)
2. Fill the form (name + email + how-you'll-use-it). Instant key.
3. Send it to me → I add as `FEC_API_KEY` in Secret Manager.

**Skip-for-now is fine** — I just ran FEC successfully with DEMO_KEY. We'd only hit the rate limit on a much bigger backfill.

---

## Priority order

**Do today/tomorrow if you can:**
1. **FB Ad Library** — biggest unlock (zero cost, instant useful data)
2. **Bluesky handles** — 5 min of typing, unlocks an entire source type
3. **LegiScan** — the LA Legislature is literally the core of political research

**Do when convenient:**
4. CourtListener key (nice-to-have)
5. FEC key (nice-to-have)

---

## What I'm doing without you

- ✅ Pre-ingest relevance classifier (live)
- ✅ Trimmed RSS feeds (dropped local TV stations, added Bayou Brief)
- ✅ Wikipedia election scraper (bypasses Ballotpedia CloudFront block)
- ⏳ Firing FEC with DEMO_KEY right now
- ⏳ Firing GDELT (political firehose) right now
- ⏳ Firing Wikipedia elections scraper to populate LA election structure
- ⏳ Deploy landing in ~5 min — relevance filter goes live
- Post-deploy: re-fire RSS scraper so backfill runs through the new relevance gate

No keys needed for any of those.
