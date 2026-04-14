/**
 * Per-channel, per-user conversation memory.
 *
 * Store user messages + assistant responses so the brain has context across
 * turns. Keep the last N messages (or bounded by char length) to avoid
 * ballooning input tokens.
 */

import { prisma } from "./db";
import type { PriorMessage } from "./brain/runner";

/** Max messages (user + assistant combined) to replay per call. */
const MAX_HISTORY = 12;

/** Hard cap on total chars of history replayed, to keep costs predictable. */
const MAX_HISTORY_CHARS = 12_000;

export async function getOrCreateConversation(
  channel: "telegram" | "web",
  externalUserId: string
): Promise<string> {
  const existing = await prisma.conversation.findUnique({
    where: { channel_externalUserId: { channel, externalUserId } },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.conversation.create({
    data: { channel, externalUserId },
    select: { id: true },
  });
  return created.id;
}

export async function loadRecentMessages(
  conversationId: string
): Promise<PriorMessage[]> {
  const rows = await prisma.conversationMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: MAX_HISTORY,
    select: { role: true, content: true },
  });

  // rows is newest-first; reverse to chronological
  const chronological = rows.reverse();

  // Trim to char budget, prioritizing the most recent messages
  let total = 0;
  const keptInReverse: PriorMessage[] = [];
  for (let i = chronological.length - 1; i >= 0; i--) {
    const row = chronological[i];
    total += row.content.length;
    if (total > MAX_HISTORY_CHARS) break;
    keptInReverse.push({
      role: row.role as "user" | "assistant",
      content: row.content,
    });
  }
  return keptInReverse.reverse();
}

export async function saveMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  await prisma.conversationMessage.create({
    data: { conversationId, role, content },
  });
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
}
