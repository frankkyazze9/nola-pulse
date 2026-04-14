/**
 * Bluesky scraper.
 *
 * Pulls public posts from Louisiana political figures on Bluesky via the AT
 * Protocol. Free, no API key, no rate cliff. Bluesky is the single best-kept
 * free secret in 2026 political OSINT — the LA political class is actively
 * migrating there.
 *
 * Tracked handles live in `pipelines/scrapers/bluesky/handles.json`. On each
 * run we walk every handle, fetch its public feed via `getAuthorFeed` (no auth
 * required), and ingest each post as a `social_post` Document. Posts older
 * than 90 days are skipped on first run so back-fills don't blow up.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AtpAgent } from "@atproto/api";
import type {
  AppBskyFeedDefs,
  AppBskyFeedGetAuthorFeed,
} from "@atproto/api";
import { retry, runScraper, type ScraperDefinition } from "@/lib/scraper/base";
import { ingestDocument } from "@/lib/ingest/document-pipeline";

const BSKY_PUBLIC_SERVICE = "https://public.api.bsky.app";
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const POSTS_PER_HANDLE = 100;

interface HandlesFile {
  handles: string[];
}

interface BlueskyPostRecord {
  text?: string;
  createdAt?: string;
  facets?: Array<{
    features?: Array<{
      $type?: string;
      did?: string;
      uri?: string;
      tag?: string;
    }>;
  }>;
  reply?: { parent?: { uri?: string }; root?: { uri?: string } };
}

function loadHandles(): string[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = join(here, "handles.json");
  const data = JSON.parse(readFileSync(path, "utf-8")) as HandlesFile;
  return data.handles ?? [];
}

function postUri(handle: string, uri: string): string {
  // at://did:plc:.../app.bsky.feed.post/<rkey> → https://bsky.app/profile/<handle>/post/<rkey>
  const match = uri.match(/\/app\.bsky\.feed\.post\/([^/]+)$/);
  const rkey = match?.[1] ?? uri;
  return `https://bsky.app/profile/${handle}/post/${rkey}`;
}

function extractMentions(record: BlueskyPostRecord): string[] {
  const mentions: string[] = [];
  for (const facet of record.facets ?? []) {
    for (const feature of facet.features ?? []) {
      if (feature.$type === "app.bsky.richtext.facet#mention" && feature.did) {
        mentions.push(feature.did);
      }
    }
  }
  return mentions;
}

export const bluesky: ScraperDefinition = {
  name: "scraper-bluesky",
  sourceSystem: "bluesky",
  rateLimitPerSec: 5,
  async run(_args, ctx) {
    const handles = loadHandles();
    if (handles.length === 0) {
      ctx.logError("No handles configured in handles.json");
      return;
    }

    const agent = new AtpAgent({ service: BSKY_PUBLIC_SERVICE });
    const cutoff = Date.now() - MAX_AGE_MS;

    for (const handle of handles) {
      try {
        await ctx.rateLimit.wait();
        const response = await retry<AppBskyFeedGetAuthorFeed.Response>(() =>
          agent.getAuthorFeed({
            actor: handle,
            limit: POSTS_PER_HANDLE,
            filter: "posts_with_replies",
          })
        );

        const feed = response.data.feed ?? [];
        ctx.stats.recordsFetched += feed.length;
        await ctx.saveRaw(`${handle}.json`, response.data);

        for (const item of feed) {
          try {
            await ingestPost(item, handle, cutoff, ctx);
          } catch (err) {
            ctx.logError(err, { handle, uri: item.post?.uri });
          }
        }
      } catch (err) {
        ctx.logError(err, { handle });
      }
    }
  },
};

async function ingestPost(
  item: AppBskyFeedDefs.FeedViewPost,
  handle: string,
  cutoff: number,
  ctx: Parameters<typeof bluesky.run>[1]
): Promise<void> {
  const post = item.post;
  if (!post) return;

  const record = post.record as BlueskyPostRecord;
  const text = (record.text ?? "").trim();
  if (!text) return;

  const createdAt = record.createdAt ? new Date(record.createdAt) : new Date(post.indexedAt);
  if (createdAt.getTime() < cutoff) return;

  const mentions = extractMentions(record);
  const sourceUrl = postUri(handle, post.uri);

  const result = await ingestDocument({
    sourceUrl,
    sourceSystem: "bluesky",
    docType: "social_post",
    title: `Bluesky post by @${handle}`,
    publishedAt: createdAt,
    textContent: text,
    metadata: {
      handle,
      authorDid: post.author?.did,
      authorDisplayName: post.author?.displayName,
      uri: post.uri,
      cid: post.cid,
      replyCount: post.replyCount ?? 0,
      repostCount: post.repostCount ?? 0,
      likeCount: post.likeCount ?? 0,
      quoteCount: post.quoteCount ?? 0,
      mentions,
      isReply: Boolean(record.reply),
      replyParentUri: record.reply?.parent?.uri,
      replyRootUri: record.reply?.root?.uri,
    },
  });

  if (!result.skipped) ctx.stats.recordsUpserted++;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runScraper(bluesky, {}).then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  });
}
