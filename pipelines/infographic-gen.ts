import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function loadVoiceGuide(): string {
  return readFileSync(join(process.cwd(), "data", "voice.md"), "utf-8");
}

export async function generateInfographicCopy(dataPoint: string) {
  const voiceGuide = loadVoiceGuide();

  const message = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    system: `You are writing comedic infographic copy about New Orleans civic data as Frank Kyazze. Follow this voice guide:\n\n${voiceGuide}\n\nYou're making content for Twitter/X. It needs to be funny, shareable, and based on real data. Think @lookatthisfuckinstreet energy meets data journalism.`,
    messages: [
      {
        role: "user",
        content: `Write infographic copy for this data point:\n\n${dataPoint}\n\nReturn:\n1. A punchy headline (under 10 words)\n2. A comedic subtitle\n3. The key stat, formatted big\n4. A one-liner tweet to go with it`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type");
  }

  return content.text;
}
