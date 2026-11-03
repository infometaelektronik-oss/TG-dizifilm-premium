/**
 * Media Crawler Service
 * Extracts authorized HLS (.m3u8), MP4, and DASH media candidates from web pages and JSON endpoints.
 * Integrates directly with the user-provided media_crawler.py logic and the native database.
 */

import { loadStore, saveStore } from "@/db/native-db";
import { pickUserAgent } from "@/lib/scraper-fetch.server";

const MEDIA_RE = /(?:https?:)?\/\/[^\s<>"'`\\]+?\.(?:m3u8?|mp4|mpd)(?:\?[^\s<>"'`\\]*)?|(?:\.{0,2}\/)?[\w./%+@~-]+\.(?:m3u8?|mp4|mpd)(?:\?[^\s<>"'`\\]*)?/gi;

export type MediaCandidate = {
  url: string;
  kind: "hls" | "mp4" | "dash" | "playlist";
  sources: string[];
  evidence: string[];
  drm_detected: boolean;
  http_status?: number | null;
  title?: string;
};

export type CrawlResult = {
  ok: boolean;
  generated_at_unix: number;
  pages_visited: number;
  media: MediaCandidate[];
  importedCount: number;
  errors: Array<{ url: string; reason: string }>;
};

function mediaKind(url: string, contentType: string = ""): "hls" | "mp4" | "dash" | "playlist" | null {
  const mime = contentType.split(";")[0].trim().toLowerCase();
  if (mime.includes("mpegurl")) return "hls";
  if (mime.includes("dash")) return "dash";
  if (mime.includes("mp4")) return "mp4";

  const lower = url.toLowerCase();
  if (lower.includes(".m3u8")) return "hls";
  if (lower.includes(".m3u")) return "playlist";
  if (lower.includes(".mp4")) return "mp4";
  if (lower.includes(".mpd")) return "dash";
  return null;
}

function extractMediaUrls(html: string, baseUrl: string): string[] {
  const set = new Set<string>();
  const matches = html.match(MEDIA_RE) || [];
  for (const m of matches) {
    try {
      const abs = new URL(m, baseUrl).toString();
      if (mediaKind(abs)) set.add(abs);
    } catch {
      // ignore
    }
  }

  // Also check <video src="...">, <source src="...">, <iframe src="...">
  const tagRe = /<(?:video|source|iframe)[^>]+src=["']([^"']+)["']/gi;
  let tagMatch;
  while ((tagMatch = tagRe.exec(html)) !== null) {
    try {
      const abs = new URL(tagMatch[1], baseUrl).toString();
      if (mediaKind(abs)) set.add(abs);
    } catch {
      // ignore
    }
  }

  return Array.from(set);
}

export async function runMediaCrawl(
  targetUrl: string,
  opts: {
    allowHosts?: string[];
    importToStreams?: boolean;
    category?: "Live TV" | "Movies" | "Series" | "Radio";
  } = {}
): Promise<CrawlResult> {
  const errors: Array<{ url: string; reason: string }> = [];
  const mediaMap = new Map<string, MediaCandidate>();
  let pagesVisited = 0;
  let pageTitle = "";

  try {
    const parsed = new URL(targetUrl);
    const host = parsed.hostname;
    const allowed = new Set([host, ...(opts.allowHosts || [])]);

    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": pickUserAgent(),
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.7",
      },
      signal: AbortSignal.timeout(20000),
    });

    pagesVisited = 1;
    const contentType = res.headers.get("content-type") || "";

    if (!res.ok) {
      errors.push({ url: targetUrl, reason: `HTTP ${res.status}: ${res.statusText}` });
    } else if (contentType.includes("json")) {
      const text = await res.text();
      const urls = extractMediaUrls(text, targetUrl);
      for (const u of urls) {
        const kind = mediaKind(u) || "hls";
        mediaMap.set(u, {
          url: u,
          kind,
          sources: [targetUrl],
          evidence: ["json_api"],
          drm_detected: false,
          http_status: 200,
        });
      }
    } else {
      const html = await res.text();
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) pageTitle = titleMatch[1].trim();

      const urls = extractMediaUrls(html, targetUrl);
      const isDrm = /SAMPLE-AES|KEYFORMAT\s*=|<ContentProtection/i.test(html);

      for (const u of urls) {
        const kind = mediaKind(u) || "hls";
        mediaMap.set(u, {
          url: u,
          kind,
          sources: [targetUrl],
          evidence: ["rendered_html"],
          drm_detected: isDrm,
          http_status: 200,
          title: pageTitle || host,
        });
      }
    }
  } catch (err: any) {
    errors.push({ url: targetUrl, reason: err.message || String(err) });
  }

  const mediaList = Array.from(mediaMap.values());
  let importedCount = 0;

  if (opts.importToStreams && mediaList.length > 0) {
    const store = loadStore();
    if (!Array.isArray(store.user_streams)) {
      store.user_streams = [];
    }

    const targetCategory = opts.category || "Live TV";

    for (const item of mediaList) {
      const existingIdx = store.user_streams.findIndex((s) => s.source_url === item.url);
      const title = item.title || pageTitle || `Medya Akışı (${item.kind.toUpperCase()})`;
      const streamType = item.kind === "mp4" ? "MP4" : "HLS";

      const record = {
        id: existingIdx >= 0 ? store.user_streams[existingIdx].id : `crawler-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title,
        normalized_title: title.toLowerCase(),
        source_url: item.url,
        category: targetCategory,
        sub_category: "Keşfedilen Akış",
        stream_type: streamType,
        poster_url: null,
        logo_url: null,
        backdrop_url: null,
        description: `Media Crawler ile keşfedildi: ${item.sources[0] || targetUrl}`,
        channel_group: "Media Crawler",
        country: "Türkiye",
        is_foreign: false,
        is_active: true,
        tags: ["media-crawler", item.kind, ...(item.drm_detected ? ["drm-detected"] : [])],
        updated_at: new Date().toISOString(),
        created_at: existingIdx >= 0 ? store.user_streams[existingIdx].created_at : new Date().toISOString(),
      };

      if (existingIdx >= 0) {
        store.user_streams[existingIdx] = { ...store.user_streams[existingIdx], ...record };
      } else {
        store.user_streams.unshift(record);
      }
      importedCount++;
    }

    saveStore(store);
  }

  return {
    ok: errors.length === 0 || mediaList.length > 0,
    generated_at_unix: Math.floor(Date.now() / 1000),
    pages_visited: pagesVisited,
    media: mediaList,
    importedCount,
    errors,
  };
}
