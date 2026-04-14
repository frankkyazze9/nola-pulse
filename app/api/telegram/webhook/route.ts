/**
 * POST /api/telegram/webhook
 *
 * Receives Telegram Bot API updates. Validates the secret-token header,
 * checks the sender against the allowlist, then dispatches commands or
 * routes free-form text to the brain.
 *
 * Commands:
 *   /start           — greeting
 *   /help            — command list
 *   /case <title>    — create a case with the title as both title and brief
 *   /cases           — list active cases
 *   /project <title> — create a project
 *   /projects        — list active projects
 *   /status          — spend + scraper health
 *   anything else    — forwarded to the brain's interactive loop
 */

import { runBrainInteractive } from "@/lib/brain/runner";
import {
  createCase,
  createProject,
  listCases,
  listProjects,
} from "@/lib/brain/handlers";
import { getMonthToDateSpendByService } from "@/lib/spend";
import { prisma } from "@/lib/db";
import { isAllowedUser, sendChatAction, sendMessage } from "@/lib/telegram";
import { SpendCapExceededError } from "@/lib/claude/spend";
import {
  getOrCreateConversation,
  loadRecentMessages,
  saveMessage,
} from "@/lib/conversation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface TelegramUser {
  id: number;
  first_name?: string;
  username?: string;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: { id: number };
  text?: string;
  date: number;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export async function POST(request: Request) {
  // Validate webhook secret
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const headerSecret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!expectedSecret || headerSecret !== expectedSecret) {
    return new Response("unauthorized", { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return Response.json({ ok: true }); // ignore malformed
  }

  const msg = update.message;
  if (!msg || !msg.from || !msg.text) {
    return Response.json({ ok: true });
  }

  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  // Allowlist gate
  if (!isAllowedUser(userId)) {
    console.warn(`[telegram] unauthorized user ${userId} (${msg.from.username ?? msg.from.first_name}): "${text.slice(0, 60)}"`);
    await sendMessage(chatId, "Unauthorized.");
    return Response.json({ ok: true });
  }

  // Run the handler in the background so we return to Telegram quickly.
  // Telegram will retry if we don't 200 within ~30s.
  handleMessage(chatId, userId, text).catch((err) => {
    console.error("[telegram] handler error:", err);
  });

  return Response.json({ ok: true });
}

async function handleMessage(
  chatId: number,
  userId: number,
  text: string
): Promise<void> {
  try {
    await sendChatAction(chatId, "typing");

    // Command dispatch
    if (text === "/start") {
      await sendMessage(
        chatId,
        "Dark Horse agent online.\n\n" +
          "Ask me research questions in plain English, or use commands:\n" +
          "/help — list commands\n" +
          "/cases — your active investigations\n" +
          "/projects — your active campaigns\n" +
          "/case <title> — start a case\n" +
          "/project <title> — start a project\n" +
          "/status — spend and health"
      );
      return;
    }

    if (text === "/help") {
      await sendMessage(
        chatId,
        "Commands:\n" +
          "/case <title> — create a case (investigation)\n" +
          "/cases — list active cases\n" +
          "/project <title> — create a project (campaign/brand)\n" +
          "/projects — list active projects\n" +
          "/status — show spend and scraper health\n" +
          "/reset — clear conversation memory\n\n" +
          "Or just type a question. I'll research it and remember the conversation."
      );
      return;
    }

    if (text.startsWith("/case ")) {
      const title = text.slice("/case ".length).trim();
      if (!title) {
        await sendMessage(chatId, "Usage: /case <title>");
        return;
      }
      const c = await createCase({ title, brief: title });
      await sendMessage(
        chatId,
        `Case created: *${c.title}*\n\nID: \`${c.id}\`\n\nDescribe what you want me to investigate next and I'll start attaching evidence.`,
        { parseMode: "Markdown" }
      );
      return;
    }

    if (text === "/cases") {
      const cases = await listCases({ status: "active", limit: 20 });
      if (cases.length === 0) {
        await sendMessage(chatId, "No active cases. Start one with /case <title>.");
        return;
      }
      const lines = cases
        .map((c, i) => `${i + 1}. ${c.title} (\`${c.id.slice(-6)}\`)`)
        .join("\n");
      await sendMessage(chatId, `*Active cases:*\n${lines}`, {
        parseMode: "Markdown",
      });
      return;
    }

    if (text.startsWith("/project ")) {
      const title = text.slice("/project ".length).trim();
      if (!title) {
        await sendMessage(chatId, "Usage: /project <title>");
        return;
      }
      const p = await createProject({ title, kind: "campaign" });
      await sendMessage(
        chatId,
        `Project created: *${p.title}*\n\nID: \`${p.id}\`\n\nTell me the subject (candidate, brand) and I'll start the analysis.`,
        { parseMode: "Markdown" }
      );
      return;
    }

    if (text === "/projects") {
      const projects = await listProjects({ status: "active", limit: 20 });
      if (projects.length === 0) {
        await sendMessage(chatId, "No active projects. Start one with /project <title>.");
        return;
      }
      const lines = projects
        .map((p, i) => {
          const subject = p.subjectPerson
            ? ` — ${p.subjectPerson.givenName} ${p.subjectPerson.familyName}`
            : p.subjectOrg
            ? ` — ${p.subjectOrg.name}`
            : "";
          return `${i + 1}. ${p.title}${subject} (\`${p.id.slice(-6)}\`)`;
        })
        .join("\n");
      await sendMessage(chatId, `*Active projects:*\n${lines}`, {
        parseMode: "Markdown",
      });
      return;
    }

    if (text === "/reset") {
      const convId = await getOrCreateConversation("telegram", String(userId));
      await prisma.conversationMessage.deleteMany({
        where: { conversationId: convId },
      });
      await sendMessage(chatId, "Conversation memory cleared.");
      return;
    }

    if (text === "/status") {
      const spendByService = await getMonthToDateSpendByService();
      const totalSpend = Object.values(spendByService).reduce((a, b) => a + b, 0);
      const scraperRuns = await prisma.scraperRun.findMany({
        orderBy: { startedAt: "desc" },
        take: 5,
      });
      const spendLines =
        Object.entries(spendByService)
          .map(([svc, cost]) => `  ${svc}: $${cost.toFixed(2)}`)
          .join("\n") || "  (no spend yet)";
      const scraperLines = scraperRuns.length
        ? scraperRuns
            .map(
              (r) =>
                `  ${r.scraperName}: ${r.status} (${r.recordsUpserted}/${r.recordsFetched})`
            )
            .join("\n")
        : "  (no runs yet)";
      await sendMessage(
        chatId,
        `*MTD spend:* $${totalSpend.toFixed(2)}\n${spendLines}\n\n*Recent scrapers:*\n${scraperLines}`,
        { parseMode: "Markdown" }
      );
      return;
    }

    // Free-form text → brain, with conversation memory
    const conversationId = await getOrCreateConversation("telegram", String(userId));
    const priorMessages = await loadRecentMessages(conversationId);

    // Persist the user message before calling the brain so it's saved even
    // if the brain call fails.
    await saveMessage(conversationId, "user", text);

    const answer = await runBrainInteractive(text, { priorMessages });
    const response = answer.markdown || "(no answer)";

    await saveMessage(conversationId, "assistant", response);

    const footer =
      answer.sourcesConsulted.length > 0
        ? `\n\n_${answer.sourcesConsulted.length} source${answer.sourcesConsulted.length === 1 ? "" : "s"} consulted_`
        : "";

    await sendMessage(chatId, response + footer, { parseMode: "Markdown" });
  } catch (err) {
    if (err instanceof SpendCapExceededError) {
      await sendMessage(
        chatId,
        `Monthly spend cap exceeded: $${err.monthToDate.toFixed(2)} / $${err.cap}. Try again next month or raise the cap.`
      );
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[telegram] error handling message:", err);
    await sendMessage(chatId, `Error: ${message.slice(0, 500)}`);
  }
}
