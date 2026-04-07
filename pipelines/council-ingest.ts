import Anthropic from "@anthropic-ai/sdk";

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function summarizeCouncilMeeting(transcript: string) {
  const message = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 3000,
    system:
      "You are summarizing a New Orleans City Council meeting. Write in plain language that any resident can understand. Be factual and specific. Focus on what actually happened, not procedural fluff.",
    messages: [
      {
        role: "user",
        content: `Summarize this New Orleans City Council meeting transcript. Structure your summary with these sections:

## Key Decisions
What was voted on and what passed/failed.

## Notable Debates
Any significant disagreements or heated discussions.

## Public Comment Highlights
What residents came to say (if any public comment in transcript).

## What to Watch
Upcoming votes, follow-up items, or things that will affect residents.

---

Transcript:
${transcript}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type");
  }

  return content.text;
}

// CLI execution
const isMainModule =
  typeof require !== "undefined" && require.main === module;

if (isMainModule) {
  const transcript =
    process.argv[2] || "No transcript provided. Pass transcript as argument.";
  summarizeCouncilMeeting(transcript)
    .then((summary) => {
      console.log("--- Council Meeting Summary ---\n");
      console.log(summary);
    })
    .catch((err) => {
      console.error("Failed to summarize:", err);
      process.exit(1);
    });
}
