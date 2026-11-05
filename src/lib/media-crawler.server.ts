/**
 * Media Crawler & Film/Dizi Stream Ingestion Engine
 * Handles direct media URLs, M3U8/M3U playlists, web pages (FilmCehennemi, Kanal D, DiziPal, video embeds),
 * and multi-movie catalog listings.
 * Directly ingests into user_streams and connects them with home page rows (Filmler, Popüler Diziler, vb.).
 */

import { loadStore, saveStore } from "@/db/native-db";
import { pickUserAgent } from "@/lib/scraper-fetch.server";
import { parseM3U } from "@/lib/m3u-parser";
import { classify } from "@/lib/media-classifier";

const MEDIA_RE =
  /(?:https?:)?\/\/[^\s<>"'`\\]+?\.(?:m3u8?|mp4|mpd|webm)(?:\?[^\s<>"'`\\]*)?|(?:\.{0,2}\/)?[\w./%+@~-]+\.(?:m3u8?|mp4|mpd|webm)(?:\?[^\s<>"'`\\]*)?/gi;

export type MediaCandidate = {
  url: string;
  kind: "hls" | "mp4" | "dash" | "playlist";
  sources: string[];
  evidence: string[];
  drm_detected: boolean;
  http_status?: number | null;
  title?: string;
  poster?: string | null;
  category?: "Live TV" | "Movies" | "Series" | "Radio";
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
  if (lower.includes(".webm")) return "mp4";
  return null;
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/\s*[-–|]\s*(?:Full HD|1080p|720p|İzle|Tek Parça|DiziPal|Dizibox|Dizilla|Hdfilmcehennemi|Filmcehennemi|Film).*$/i, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

/**
 * Extracts movie & series catalog cards from HTML listings (e.g. FilmCehennemi, Kanal D, Dizi siteleri)
 */
function extractCatalogCards(
  html: string,
  baseUrl: string,
  defaultCategory?: "Live TV" | "Movies" | "Series" | "Radio"
): MediaCandidate[] {
  const candidates: MediaCandidate[] = [];
  const seenUrls = new Set<string>();

  // Pattern A: <a href="..." ...><img src="..." alt="Film Adı" ...>
  const cardRe = /<a[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?<img[^>]+(?:src|data-src|data-original)=["']([^"']+)["'][^>]*alt=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = cardRe.exec(html)) !== null) {
    try {
      const itemUrl = new URL(m[1], baseUrl).toString();
      const poster = new URL(m[2], baseUrl).toString();
      const rawTitle = m[3]?.trim();
      if (!rawTitle || rawTitle.length < 2 || seenUrls.has(itemUrl)) continue;

      const title = cleanTitle(rawTitle);
      if (title.length < 2) continue;
      seenUrls.add(itemUrl);

      const isSeries = /dizi|bolum|sezon/i.test(itemUrl) || /dizi/i.test(title);
      const category = defaultCategory || (isSeries ? "Series" : "Movies");

      candidates.push({
        url: itemUrl,
        kind: "hls",
        sources: [baseUrl],
        evidence: ["catalog_card"],
        drm_detected: false,
        http_status: 200,
        title,
        poster,
        category,
      });
    } catch {
      // ignore
    }
  }

  // Pattern B: FilmCehennemi specific cards
  // <div class="poster-media"...><a href="..."><img ...></a><div class="poster-title"><a ...>Film Adı</a>
  if (candidates.length === 0 && html.includes("filmcehennemi")) {
    const fcRe = /<a[^>]+href=["'](https?:\/\/[^"']*filmcehennemi[^"']*\/[^"']+)["'][^>]*title=["']([^"']+)["']/gi;
    let fcMatch: RegExpExecArray | null;
    while ((fcMatch = fcRe.exec(html)) !== null) {
      try {
        const itemUrl = fcMatch[1];
        const rawTitle = cleanTitle(fcMatch[2]);
        if (rawTitle && !seenUrls.has(itemUrl) && !itemUrl.includes("/sayfa/")) {
          seenUrls.add(itemUrl);
          candidates.push({
            url: itemUrl,
            kind: "hls",
            sources: [baseUrl],
            evidence: ["filmcehennemi_catalog"],
            drm_detected: false,
            http_status: 200,
            title: rawTitle,
            category: defaultCategory || "Movies",
          });
        }
      } catch {
        // ignore
      }
    }
  }

  return candidates.slice(0, 50); // limit to top 50 items per crawl
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

  // Split multiple URLs if provided in single input (comma, space, or newline separated)
  const urlsToProcess = targetUrl
    .split(/[\r\n,]+/)
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//i.test(u));

  if (urlsToProcess.length === 0 && targetUrl.trim()) {
    urlsToProcess.push(targetUrl.trim());
  }

  for (const rawUrl of urlsToProcess) {
    const trimmedUrl = rawUrl;
    let pageTitle = "";
    let pagePoster: string | null = null;

    // 1. Direct Stream URL Check (.m3u8, .mp4, .mpd)
    const directKind = mediaKind(trimmedUrl);
    if (directKind && directKind !== "playlist") {
      const filename = trimmedUrl.split("/").pop()?.split("?")[0] || "Film/Medya Akışı";
      mediaMap.set(trimmedUrl, {
        url: trimmedUrl,
        kind: directKind,
        sources: [trimmedUrl],
        evidence: ["direct_url"],
        drm_detected: false,
        http_status: 200,
        title: cleanTitle(decodeURIComponent(filename).replace(/\.[a-z0-9]+$/i, "")),
        category: opts.category,
      });
      continue;
    }

    // 2. Fetch the target URL
    try {
      pagesVisited++;
      const res = await fetch(trimmedUrl, {
        method: "GET",
        headers: {
          "User-Agent": pickUserAgent(),
          Accept: "*/*",
          "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.7",
          Referer: trimmedUrl,
        },
        signal: AbortSignal.timeout(20000),
      });

      const contentType = (res.headers.get("content-type") || "").toLowerCase();
      const bodyText = await res.text();

      // 2A. M3U / M3U8 Playlist
      if (bodyText.includes("#EXTM3U") || bodyText.includes("#EXTINF")) {
        const entries = parseM3U(bodyText);
        for (const entry of entries) {
          const k = mediaKind(entry.url) || "hls";
          mediaMap.set(entry.url, {
            url: entry.url,
            kind: k,
            sources: [trimmedUrl],
            evidence: ["m3u_playlist"],
            drm_detected: false,
            http_status: 200,
            title: entry.title,
            poster: entry.tvgLogo || null,
            category: opts.category,
          });
        }
      } else if (contentType.includes("json")) {
        // 2B. JSON API
        const matches = bodyText.match(MEDIA_RE) || [];
        for (const m of matches) {
          try {
            const abs = new URL(m, trimmedUrl).toString();
            const k = mediaKind(abs) || "hls";
            mediaMap.set(abs, {
              url: abs,
              kind: k,
              sources: [trimmedUrl],
              evidence: ["json_api"],
              drm_detected: false,
              http_status: 200,
              category: opts.category,
            });
          } catch {
            // ignore
          }
        }
      } else {
        // 2C. HTML Page
        const titleMatch =
          bodyText.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
          bodyText.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) pageTitle = cleanTitle(titleMatch[1]);

        const posterMatch =
          bodyText.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
          bodyText.match(/<video[^>]+poster=["']([^"']+)["']/i);
        if (posterMatch) {
          try {
            pagePoster = new URL(posterMatch[1], trimmedUrl).toString();
          } catch {
            pagePoster = posterMatch[1];
          }
        }

        // Direct stream links in HTML
        const matches = bodyText.match(MEDIA_RE) || [];
        for (const m of matches) {
          try {
            const abs = new URL(m, trimmedUrl).toString();
            const k = mediaKind(abs) || "hls";
            mediaMap.set(abs, {
              url: abs,
              kind: k,
              sources: [trimmedUrl],
              evidence: ["rendered_html"],
              drm_detected: false,
              http_status: 200,
              title: pageTitle,
              poster: pagePoster,
              category: opts.category,
            });
          } catch {
            // ignore
          }
        }

        // Player configurations: file: "...", source: "..."
        const configRe = /(?:file|source|src|stream|video_url)\s*:\s*["']([^"']+\.(?:m3u8?|mp4)[^"']*)["']/gi;
        let confMatch;
        while ((confMatch = configRe.exec(bodyText)) !== null) {
          try {
            const abs = new URL(confMatch[1], trimmedUrl).toString();
            const k = mediaKind(abs) || "hls";
            mediaMap.set(abs, {
              url: abs,
              kind: k,
              sources: [trimmedUrl],
              evidence: ["player_config"],
              drm_detected: false,
              http_status: 200,
              title: pageTitle,
              poster: pagePoster,
              category: opts.category,
            });
          } catch {
            // ignore
          }
        }

        // Check embedded iframe players
        const iframeRe = /<iframe[^>]+src=["']([^"']+)["']/gi;
        let iframeMatch;
        const iframeUrls: string[] = [];
        while ((iframeMatch = iframeRe.exec(bodyText)) !== null) {
          try {
            const abs = new URL(iframeMatch[1], trimmedUrl).toString();
            if (/player|embed|stream|video|watch|v\//i.test(abs)) {
              iframeUrls.push(abs);
            }
          } catch {
            // ignore
          }
        }

        if (iframeUrls.length > 0 && mediaMap.size === 0) {
          for (const iframeUrl of iframeUrls.slice(0, 2)) {
            try {
              const ifRes = await fetch(iframeUrl, {
                headers: { "User-Agent": pickUserAgent(), Referer: trimmedUrl },
                signal: AbortSignal.timeout(8000),
              });
              if (ifRes.ok) {
                const ifHtml = await ifRes.text();
                const ifMatches = ifHtml.match(MEDIA_RE) || [];
                for (const m of ifMatches) {
                  const abs = new URL(m, iframeUrl).toString();
                  const k = mediaKind(abs) || "hls";
                  mediaMap.set(abs, {
                    url: abs,
                    kind: k,
                    sources: [trimmedUrl, iframeUrl],
                    evidence: ["iframe_embed"],
                    drm_detected: false,
                    http_status: 200,
                    title: pageTitle,
                    poster: pagePoster,
                    category: opts.category,
                  });
                }
              }
            } catch {
              // ignore
            }
          }
        }

        // 2D. Catalog / Category Index Detection (e.g. FilmCehennemi, Kanal D, listing pages)
        // If no direct video file was found, parse individual movie/series cards from the catalog page!
        if (mediaMap.size === 0) {
          const cards = extractCatalogCards(bodyText, trimmedUrl, opts.category);
          for (const card of cards) {
            mediaMap.set(card.url, card);
          }
        }
      }
    } catch (err: any) {
      errors.push({ url: trimmedUrl, reason: err.message || String(err) });
    }
  }

  const mediaList = Array.from(mediaMap.values());
  let importedCount = 0;

  // 3. Import discovered streams into Database and ensure they show on Home Page
  if (opts.importToStreams !== false && mediaList.length > 0) {
    const store = loadStore();
    if (!Array.isArray(store.user_streams)) {
      store.user_streams = [];
    }

    const { logAudit } = await import("@/lib/audit.server");

    for (const item of mediaList) {
      const existingIdx = store.user_streams.findIndex((s) => s.source_url === item.url);
      const title = item.title || "İçe Aktarılan Medya";
      const classified = classify(title, item.url, "Media Crawler");

      const category = opts.category || item.category || classified.category || "Movies";
      let subCategory = classified.subCategory;
      if (category === "Movies") subCategory = "Sinema";
      else if (category === "Series") subCategory = "Dizi";

      const streamType = item.kind === "mp4" ? "MP4" : "HLS";
      const now = new Date().toISOString();

      const record = {
        id: existingIdx >= 0 ? store.user_streams[existingIdx].id : `crawler-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title,
        normalized_title: title.toLowerCase(),
        source_url: item.url,
        category,
        sub_category: subCategory,
        stream_type: streamType,
        poster_url: item.poster || null,
        logo_url: item.poster || null,
        backdrop_url: item.poster || null,
        description: `Media Crawler ile aktarıldı (${category}). Kaynak: ${item.sources[0] || targetUrl}`,
        channel_group: category === "Movies" ? "Filmler" : category === "Series" ? "Diziler" : "Ulusal",
        country: classified.country || "Türkiye",
        is_foreign: classified.isForeign ?? false,
        is_active: true,
        status: "active",
        quarantine_reason: null,
        failure_count: 0,
        manual_lock: true,
        tags: ["media-crawler", category.toLowerCase(), streamType.toLowerCase()],
        updated_at: now,
        created_at: existingIdx >= 0 ? store.user_streams[existingIdx].created_at : now,
      };

      if (existingIdx >= 0) {
        store.user_streams[existingIdx] = { ...store.user_streams[existingIdx], ...record };
      } else {
        store.user_streams.unshift(record);
      }
      importedCount++;

      // Also ensure the stream is attached to the relevant home row
      if (store.home_rows && store.home_row_items) {
        const targetRow = store.home_rows.find((r: any) =>
          category === "Movies"
            ? r.title.toLowerCase().includes("film") || r.rule?.category === "Movies"
            : category === "Series"
              ? r.title.toLowerCase().includes("dizi") || r.rule?.category === "Series"
              : r.title.toLowerCase().includes("ulusal")
        );
        if (targetRow) {
          const existsInRow = store.home_row_items.some((it: any) => it.row_id === targetRow.id && it.stream_id === record.id);
          if (!existsInRow) {
            store.home_row_items.unshift({ row_id: targetRow.id, stream_id: record.id, position: 0 });
          }
        }
      }
    }

    saveStore(store);

    await logAudit({
      action: "crawler.import",
      source: "crawler",
      level: "success",
      message: `Media Crawler: ${importedCount} içerik başarıyla aktarıldı (${opts.category || "Otomatik"}).`,
    });
  }

  return {
    ok: mediaList.length > 0 || errors.length === 0,
    generated_at_unix: Math.floor(Date.now() / 1000),
    pages_visited: pagesVisited,
    media: mediaList,
    importedCount,
    errors,
  };
}
