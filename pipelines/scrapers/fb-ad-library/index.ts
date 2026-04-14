/**
 * Facebook Ad Library scraper.
 *
 * Pulls political / issue ads that ran in Louisiana from Meta's free Ad
 * Library Graph API. Useful for tracking paid political messaging spend,
 * advertiser identity, targeting, and ad creative — data the FEC never sees
 * because these ads don't go through a federal committee.
 *
 * Docs: https://www.facebook.com/ads/library/api/
 * Required env: FACEBOOK_ACCESS_TOKEN (user access token with ads_read).
 *
 * Run:
 *   npm run scraper:fb-ad-library -- [--days 30] [--searchTerms "mayor"]
 */

import { retry, runScraper, type ScraperDefinition } from "@/lib/scraper/base";
import { ingestDocument } from "@/lib/ingest/document-pipeline";

const FB_API_BASE = "https://graph.facebook.com/v21.0/ads_archive";

interface FbAdLibraryArgs {
  /** Window in days. Default 30. */
  days?: number;
  /** Optional keyword filter. Default is empty (return all ads). */
  searchTerms?: string;
}

interface FbAd {
  id: string;
  page_id?: string;
  page_name?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_creative_link_descriptions?: string[];
  ad_creation_time?: string;
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  ad_snapshot_url?: string;
  currency?: string;
  impressions?: { lower_bound?: string; upper_bound?: string };
  spend?: { lower_bound?: string; upper_bound?: string };
  languages?: string[];
  publisher_platforms?: string[];
  delivery_by_region?: Array<{ region?: string; percentage?: string }>;
  demographic_distribution?: Array<{
    age?: string;
    gender?: string;
    percentage?: string;
  }>;
  bylines?: string;
  target_ages?: string[];
  target_gender?: string;
  target_locations?: Array<{ name?: string; type?: string }>;
}

interface FbAdsResponse {
  data?: FbAd[];
  paging?: { cursors?: { after?: string }; next?: string };
  error?: { message?: string; type?: string; code?: number };
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const fbAdLibrary: ScraperDefinition<FbAdLibraryArgs> = {
  name: "scraper-fb-ad-library",
  sourceSystem: "fb_ads",
  rateLimitPerSec: 1,
  async run(args, ctx) {
    const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
    if (!accessToken) {
      ctx.logError("FACEBOOK_ACCESS_TOKEN env var is required but not set.");
      return;
    }

    const days = args.days ?? 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const fields = [
      "id",
      "page_id",
      "page_name",
      "ad_creative_bodies",
      "ad_creative_link_titles",
      "ad_creative_link_descriptions",
      "ad_creation_time",
      "ad_delivery_start_time",
      "ad_delivery_stop_time",
      "ad_snapshot_url",
      "currency",
      "impressions",
      "spend",
      "languages",
      "publisher_platforms",
      "delivery_by_region",
      "demographic_distribution",
      "bylines",
      "target_ages",
      "target_gender",
      "target_locations",
    ].join(",");

    let cursor: string | undefined;
    let pageIndex = 0;
    const MAX_PAGES = 50;

    do {
      await ctx.rateLimit.wait();

      const url = new URL(FB_API_BASE);
      url.searchParams.set("access_token", accessToken);
      url.searchParams.set("ad_reached_countries", "US");
      url.searchParams.set("ad_active_status", "ALL");
      url.searchParams.set("ad_type", "POLITICAL_AND_ISSUE_ADS");
      url.searchParams.set("ad_delivery_date_min", toIsoDate(since));
      url.searchParams.set("fields", fields);
      url.searchParams.set("limit", "100");
      // Restrict delivery to Louisiana. The Graph API accepts ISO-3166-2
      // subdivision codes via `delivery_by_region` filter.
      url.searchParams.set("search_terms", args.searchTerms ?? "");
      url.searchParams.set("search_page_ids", "");
      // Delivery region filter — Louisiana state code.
      url.searchParams.set(
        "ad_reached_locations",
        JSON.stringify([{ country: "US", region: "Louisiana" }])
      );
      if (cursor) url.searchParams.set("after", cursor);

      let data: FbAdsResponse;
      try {
        data = await retry(async () => {
          const response = await fetch(url.toString(), {
            signal: AbortSignal.timeout(30_000),
          });
          if (!response.ok) {
            throw new Error(
              `FB Ad Library ${response.status}: ${await response.text().catch(() => "")}`
            );
          }
          return (await response.json()) as FbAdsResponse;
        });
      } catch (err) {
        ctx.logError(err, { page: pageIndex });
        break;
      }

      if (data.error) {
        ctx.logError(new Error(data.error.message ?? "FB API error"), {
          type: data.error.type,
          code: data.error.code,
        });
        break;
      }

      const ads = data.data ?? [];
      ctx.stats.recordsFetched += ads.length;
      await ctx.saveRaw(`ads-page-${pageIndex}.json`, data);

      for (const ad of ads) {
        try {
          await ingestAd(ad, ctx);
        } catch (err) {
          ctx.logError(err, { adId: ad.id });
        }
      }

      cursor = data.paging?.cursors?.after;
      pageIndex++;
    } while (cursor && pageIndex < MAX_PAGES);
  },
};

async function ingestAd(
  ad: FbAd,
  ctx: Parameters<typeof fbAdLibrary.run>[1]
): Promise<void> {
  const body = (ad.ad_creative_bodies ?? []).join("\n\n").trim();
  const linkTitles = (ad.ad_creative_link_titles ?? []).join(" / ");
  const linkDescs = (ad.ad_creative_link_descriptions ?? []).join(" / ");
  const textContent = [body, linkTitles, linkDescs].filter(Boolean).join("\n\n").trim();
  if (!textContent) return;

  const sourceUrl =
    ad.ad_snapshot_url ?? `https://www.facebook.com/ads/library/?id=${ad.id}`;
  const publishedAt = ad.ad_delivery_start_time
    ? new Date(ad.ad_delivery_start_time)
    : ad.ad_creation_time
      ? new Date(ad.ad_creation_time)
      : undefined;

  const title = ad.page_name
    ? `FB ad by ${ad.page_name}`
    : `Facebook Ad Library #${ad.id}`;

  const result = await ingestDocument({
    sourceUrl,
    sourceSystem: "fb_ads",
    docType: "social_post",
    title,
    publishedAt,
    textContent,
    metadata: {
      adId: ad.id,
      pageId: ad.page_id,
      pageName: ad.page_name,
      bylines: ad.bylines,
      currency: ad.currency,
      spend: ad.spend,
      impressions: ad.impressions,
      deliveryStart: ad.ad_delivery_start_time,
      deliveryStop: ad.ad_delivery_stop_time,
      adSnapshotUrl: ad.ad_snapshot_url,
      languages: ad.languages,
      publisherPlatforms: ad.publisher_platforms,
      targeting: {
        ages: ad.target_ages,
        gender: ad.target_gender,
        locations: ad.target_locations,
      },
      deliveryByRegion: ad.delivery_by_region,
      demographicDistribution: ad.demographic_distribution,
    },
  });

  if (!result.skipped) ctx.stats.recordsUpserted++;
}

function parseArgs(): FbAdLibraryArgs {
  const parsed: Record<string, string> = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i]?.replace(/^--/, "");
    const value = process.argv[i + 1];
    if (key && value) parsed[key] = value;
  }
  return {
    days: parsed.days ? Number(parsed.days) : undefined,
    searchTerms: parsed.searchTerms,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runScraper(fbAdLibrary, parseArgs()).then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  });
}
