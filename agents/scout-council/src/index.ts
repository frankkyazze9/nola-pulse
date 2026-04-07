import { Agent } from "../../shared/agent-sdk";

const agent = new Agent({
  name: "scout-council",
  version: "1.0.0",
  type: "scout",
});

// New Orleans City Council meeting sources
const COUNCIL_SOURCES = {
  agendas: "https://council.nola.gov/meetings/",
  calendar: "https://nola.gov/council/meetings-calendar/",
};

interface MeetingRecord {
  meeting_date: string;
  meeting_type: string;
  title: string;
  slug: string;
  transcript_url: string | null;
  summary: string | null;
  key_decisions: string | null;
  attendance: string | null;
  ingested_at: string;
}

async function discoverMeetings(): Promise<MeetingRecord[]> {
  // TODO: Implement actual scraping of nola.gov council pages
  // For now, this is the template that shows the pattern.
  // Real implementation will:
  // 1. Fetch the council meeting calendar page
  // 2. Parse HTML for meeting dates, types, and document links
  // 3. Download any available transcripts/minutes PDFs
  // 4. Extract text from PDFs
  // 5. Return structured meeting records

  console.log(`[${agent.name}] Checking for new council meetings...`);
  console.log(`[${agent.name}] Sources: ${JSON.stringify(COUNCIL_SOURCES)}`);

  // Placeholder: return empty until we implement scraping
  return [];
}

async function summarizeMeeting(transcript: string, meetingDate: string): Promise<string> {
  return agent.think(
    "You are summarizing a New Orleans City Council meeting. Write in plain language. Be factual and specific. Focus on decisions, votes, and what matters to residents.",
    `Summarize this New Orleans City Council meeting from ${meetingDate}.

Structure:
## Key Decisions
What was voted on and what passed/failed.

## Notable Debates
Significant disagreements or heated discussions.

## Public Comment Highlights
What residents came to say.

## What to Watch
Upcoming votes, follow-up items, things that affect residents.

---
Transcript:
${transcript}`,
    { maxTokens: 3000 }
  );
}

async function main() {
  await agent.run(async () => {
    console.log(`[${agent.name}] Starting council scout run...`);

    // Discover new meetings
    const meetings = await discoverMeetings();

    if (meetings.length === 0) {
      console.log(`[${agent.name}] No new meetings found.`);
      return;
    }

    for (const meeting of meetings) {
      // Store raw transcript in Cloud Storage if available
      if (meeting.transcript_url) {
        // TODO: Download and store transcript
        // const transcript = await fetch(meeting.transcript_url).then(r => r.text());
        // const storagePath = `council/transcripts/${meeting.slug}.txt`;
        // await agent.storeDocument(storagePath, transcript);
      }

      // Store structured data in BigQuery
      await agent.insertKB("council_meetings", [meeting]);

      console.log(`[${agent.name}] Ingested meeting: ${meeting.title}`);
    }

    // Notify other agents that new council data is available
    await agent.publish("data.ingested", {
      source: "council",
      recordCount: meetings.length,
      meetingDates: meetings.map((m) => m.meeting_date),
    });

    console.log(`[${agent.name}] Completed. Ingested ${meetings.length} meetings.`);
  });
}

// Export for use as Cloud Run Job
export { main, summarizeMeeting };

// CLI execution
if (require.main === module) {
  main().catch((err) => {
    console.error(`[scout-council] Fatal error:`, err);
    process.exit(1);
  });
}
