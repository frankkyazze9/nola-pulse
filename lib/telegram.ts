/**
 * Minimal Telegram Bot API client for Dark Horse.
 *
 * We don't need the full `grammy`/`node-telegram-bot-api` surface — just
 * sendMessage + sendChatAction. Keep dependencies small.
 */

const API_BASE = "https://api.telegram.org";
const MAX_MESSAGE_LENGTH = 4096;

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN not set");
  return t;
}

export async function sendMessage(
  chatId: number,
  text: string,
  opts: { parseMode?: "Markdown" | "MarkdownV2" | "HTML"; replyToMessageId?: number } = {}
): Promise<void> {
  // Split long messages so nothing gets dropped.
  const chunks = splitForTelegram(text);
  for (const chunk of chunks) {
    await fetch(`${API_BASE}/bot${token()}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunk,
        ...(opts.parseMode ? { parse_mode: opts.parseMode } : {}),
        ...(opts.replyToMessageId ? { reply_to_message_id: opts.replyToMessageId } : {}),
        disable_web_page_preview: true,
      }),
    });
  }
}

export async function sendChatAction(
  chatId: number,
  action: "typing" | "upload_document" = "typing"
): Promise<void> {
  await fetch(`${API_BASE}/bot${token()}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action }),
  });
}

export function isAllowedUser(userId: number): boolean {
  const list = (process.env.TELEGRAM_ALLOWED_USERS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.includes(String(userId));
}

function splitForTelegram(text: string): string[] {
  if (text.length <= MAX_MESSAGE_LENGTH) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > MAX_MESSAGE_LENGTH) {
    // Prefer splitting on paragraph or sentence boundary
    let cut = remaining.lastIndexOf("\n\n", MAX_MESSAGE_LENGTH);
    if (cut < MAX_MESSAGE_LENGTH / 2) cut = remaining.lastIndexOf("\n", MAX_MESSAGE_LENGTH);
    if (cut < MAX_MESSAGE_LENGTH / 2) cut = remaining.lastIndexOf(". ", MAX_MESSAGE_LENGTH);
    if (cut < MAX_MESSAGE_LENGTH / 2) cut = MAX_MESSAGE_LENGTH;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}
