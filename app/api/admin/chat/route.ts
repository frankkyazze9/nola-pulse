import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { BigQuery } from "@google-cloud/bigquery";

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const bigquery = new BigQuery({ projectId: "nola-ai-innovation" });

const SYSTEM_PROMPT = `You are the NOLA Pulse AI assistant — Frank's command center copilot. You have direct access to a civic data knowledge base for New Orleans containing 116,000+ records across these tables:

- service_requests_311: 311 complaints (potholes, drainage, trash, streetlights)
- str_permits: 4,000+ active short-term rental licenses
- building_permits: 15,000+ permits
- demolitions: 3,900+ demolished properties
- police_reports: 55,000+ NOPD incident reports
- use_of_force: 4,700+ use-of-force incidents
- blight_cases: 5,600+ code enforcement cases
- blight_violations: 19,400+ violations
- news_articles: local media articles
- elected_officials: city council, mayor, DA, sheriff profiles
- tax_revenue: sales tax and revenue data
- employee_salaries: city employee compensation
- business_licenses: business registrations

When asked about data, write BigQuery SQL queries to answer. Return the SQL in a <sql> tag so the system can execute it.

Example: "How many STR licenses are in the Marigny?"
<sql>SELECT COUNT(*) as count FROM nola_pulse_kb.str_permits WHERE LOWER(neighborhood) LIKE '%marigny%'</sql>

You can also:
- Analyze data and find patterns
- Suggest article topics based on what's interesting
- Help Frank plan content strategy
- Answer questions about New Orleans civic data
- Generate tweet drafts or article outlines

Be direct, conversational, and data-driven. You're Frank's right hand.`;

interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: Request) {
  const { messages } = (await request.json()) as { messages: Message[] };

  // Check for SQL queries in the conversation — execute them and add results
  const enrichedMessages: Message[] = [];

  for (const msg of messages) {
    enrichedMessages.push(msg);
  }

  // First, get Claude's response
  const response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: enrichedMessages.map((m) => ({ role: m.role, content: m.content })),
  });

  const assistantText = response.content[0].type === "text" ? response.content[0].text : "";

  // Check if Claude wants to run a SQL query
  const sqlMatch = assistantText.match(/<sql>([\s\S]*?)<\/sql>/);
  if (sqlMatch) {
    const sql = sqlMatch[1].trim();
    try {
      const [rows] = await bigquery.query({ query: sql });
      const resultText = JSON.stringify(rows, null, 2);

      // Get Claude to interpret the results
      const followUp = await claude.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [
          ...enrichedMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
          { role: "assistant" as const, content: assistantText },
          { role: "user" as const, content: `Here are the query results:\n\n${resultText}\n\nNow interpret these results in plain language. Be specific with numbers. No SQL tags this time.` },
        ],
      });

      const interpretation = followUp.content[0].type === "text" ? followUp.content[0].text : "";
      return NextResponse.json({
        message: interpretation,
        sql,
        rawResults: rows.slice(0, 20),
      });
    } catch (err) {
      return NextResponse.json({
        message: `${assistantText}\n\n(Query failed: ${(err as Error).message})`,
        sql,
        error: (err as Error).message,
      });
    }
  }

  return NextResponse.json({ message: assistantText });
}
