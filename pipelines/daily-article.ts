import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function loadVoiceGuide(): string {
  return readFileSync(join(process.cwd(), "data", "voice.md"), "utf-8");
}

export async function generateDailyArticle(context?: string) {
  const voiceGuide = loadVoiceGuide();
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const message = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: `You are writing a daily civic article about New Orleans as Frank Kyazze. Follow this voice guide EXACTLY:\n\n${voiceGuide}\n\nToday's date: ${today}`,
    messages: [
      {
        role: "user",
        content: `Write today's NOLA Pulse daily article. Pick the most interesting or urgent civic topic happening in New Orleans right now.

${context ? `Here's today's data context:\n${context}` : "Use your knowledge of current New Orleans civic issues — infrastructure, Entergy, housing displacement, city council, drainage, education, or whatever feels most relevant today."}

The article should be 500-800 words. Open with a specific moment or fact, not a thesis. Write like you're talking to a friend at a bar who cares about this city. Include at least one stat or data point. End on resonance, not resolution.`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type");
  }

  return {
    body: content.text,
    generatedAt: new Date().toISOString(),
  };
}
