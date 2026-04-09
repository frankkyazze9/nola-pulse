# NOLA Pulse — Content Engine Spec

## Pipeline

```
DATA SCOUTS          TREND SCOUT          
    │                    │                 
    ▼                    ▼                 
┌────────────────────────────────────┐    
│         REPORTER AGENT             │    
│  Finds scoops by crossing civic    │    
│  data with trending topics.        │    
│  Output: story pitch (headline,    │    
│  angle, data points, format)       │    
└─────────────┬──────────────────────┘    
              │                           
              ▼                           
┌────────────────────────────────────┐    
│         EDITOR AGENT               │    
│  Quality gate. Checks:             │    
│  - Is it surprising? (not obvious) │    
│  - Is it corny? (kill it)          │    
│  - Does it match Frank's voice?    │    
│  - Are the numbers real?           │    
│  - Would someone share this?       │    
│  Output: approved/rejected pitch   │    
└─────────────┬──────────────────────┘    
              │ (approved only)           
              ▼                           
┌────────────────────────────────────┐    
│         PUNCH-UP WRITER            │    
│  Takes approved pitch, writes      │    
│  the piece in Frank's voice.       │    
│  Uses VOICE.md religiously.        │    
│  Adds: sarcasm, metaphors, the    │    
│  thing people are thinking but     │    
│  won't say. Surprising.            │    
│  Output: finished article/meme     │    
└─────────────┬──────────────────────┘    
              │                           
              ▼                           
┌────────────────────────────────────┐    
│         FRANK (Human Review)       │    
│  Admin dashboard content queue.    │    
│  Approve / Edit / Kill.            │    
└─────────────┬──────────────────────┘    
              │ (approved only)           
              ▼                           
┌────────────────────────────────────┐    
│         PUBLISHER                  │    
│  → Website                         │    
│  → Twitter/X                       │    
│  → (future) Instagram, TikTok     │    
└────────────────────────────────────┘    
```

## Agent Roles

### Data Scouts (existing)
What they do now. Pull civic records from data.nola.gov into BigQuery.
Run daily on schedule. No changes needed.

### Trend Scout (NEW)
Monitors what's trending in pop culture and memes:
- Reddit r/NewOrleans, r/memes trending posts
- Google Trends for New Orleans-related queries
- imgflip trending meme templates
- Twitter/X trending topics in New Orleans
- Local news RSS for breaking stories

Output: trending topics with relevance scores.
Stored in BigQuery `nola_pulse_kb.trends` table.

### Reporter Agent (NEW)
The brain. Crosses civic data with trending topics to find scoops:
- "Entergy outages are trending on Twitter AND we have 304K outage records"
- "STR debate is in the news AND we have 4,090 license records by neighborhood"
- "Pothole meme is trending AND we have 311 data showing 355-day response times"

Evaluates: Is this interesting? Would someone care? Is there an angle nobody's covered?

Output: story pitch with headline, angle, supporting data, suggested format (article, infographic, meme).

### Editor Agent (NEW)
Quality gate. Kills bad ideas before they waste writer time.

Checks:
1. **Surprise factor** — if the reader's reaction is "duh", kill it
2. **Corniness detector** — if it reads like AI comedy, kill it
3. **Voice match** — does the angle fit Frank's voice? (reference VOICE.md)
4. **Data accuracy** — are the numbers real and cited correctly?
5. **Shareability** — would someone text this to a friend?
6. **Timing** — is this relevant right now?

Output: approved pitch (with editor notes) or rejection with reason.

### Punch-Up Writer (NEW)
Takes an approved pitch and writes the final piece.

Rules:
- VOICE.md is law
- Sarcasm when earned, never forced
- Metaphors that land (not "life is a journey" — specific, weird, Frank)
- Say the thing people are thinking
- Randomness is human — non sequiturs, unexpected angles
- NO em-dashes (Frank doesn't use them)
- NO "delve", "landscape", "unpack", "nuanced"
- If it sounds like AI wrote it, burn it

Output formats:
- Article (500-800 words)
- Short take (2-3 paragraphs)
- Infographic copy (headline + stats + caption)
- Tweet (under 280 chars)

## Content Formats

### Articles
500-800 words. Data-driven reporting in Frank's voice.
Reads like a real article from someone who lives here.

### Infographics
Visual data cards. Clean design, one big stat, context line.
For social sharing. Generated as SVG/HTML.

### Memes
Trending meme format + NOLA civic data.
Example: Drake meme template → "Fixing potholes" (nah) vs "Studying potholes for 355 days" (yeah)

Requires: meme template API (imgflip), text overlay, trend awareness.

### Short Takes
2-3 paragraph quick hits. For when the data point is interesting
but doesn't need a full article. Think tweet-length but with more room.

## Trend Sources

### Free APIs
- **imgflip Meme API** — trending templates, text overlay generation
- **Google Trends** — trending searches, related queries
- **Reddit JSON** — r/NewOrleans/.json for trending local posts
- **RSS feeds** — NOLA.com, WWNO, The Lens

### Future (paid/auth required)
- Twitter/X API (keys pending — GH issue #2)
- TikTok trending (no public API, would need scraping)

## Autonomy Model

The pipeline runs daily at 5am CT:
1. Data scouts refresh BigQuery
2. Trend scout checks what's trending
3. Reporter generates 3-5 story pitches
4. Editor approves/rejects each (target: 1-2 approved per day)
5. Punch-up writer creates the pieces
6. Drafts land in Frank's admin queue
7. Frank reviews during morning coffee
8. Approved → auto-publish to site (and Twitter when ready)

Frank's approval is the bottleneck by design. The engine proposes,
Frank disposes. Over time, as the editor agent learns what Frank
approves, the approval rate should increase.
