/**
 * Core Stream Engine API Client & Autonomous Synchronizer
 * Fetches verified Live TV, Radio, Movies, and Series from a central Core Stream Engine API,
 * intelligently categorizes them, and persists them into the local native database.
 */

import { loadStore, saveStore } from "@/db/native-db";

export type CoreEngineSyncResult = {
  ok: boolean;
  totalFetched: number;
  newOrUpdated: number;
  categories: {
    liveTv: number;
    radio: number;
    movies: number;
    series: number;
  };
  genres: Record<string, number>;
  lastSynced: string;
  error?: string;
};

export type CoreEngineConfig = {
  apiUrl: string;
  apiKey: string;
  autoSync: boolean;
  syncIntervalMinutes: number;
  lastSyncedAt: string | null;
  lastStats: CoreEngineSyncResult | null;
};

export async function getCoreEngineConfig(): Promise<CoreEngineConfig> {
  const store = loadStore();
  const settings = store.app_settings || [];
  const map = new Map<string, any>(settings.map((s) => [s.key, s.value]));

  return {
    apiUrl: map.get("core_stream_engine_api_url") || "",
    apiKey: map.get("core_stream_engine_api_key") || "",
    autoSync: map.get("core_stream_engine_auto_sync") !== false,
    syncIntervalMinutes: Number(map.get("core_stream_engine_sync_interval")) || 30,
    lastSyncedAt: map.get("last_core_engine_sync_at") || null,
    lastStats: map.get("last_core_engine_sync_stats") || null,
  };
}

export async function saveCoreEngineConfig(config: Partial<CoreEngineConfig>): Promise<void> {
  const store = loadStore();
  if (!Array.isArray(store.app_settings)) {
    store.app_settings = [];
  }

  const updates: Array<{ key: string; value: any }> = [];
  if (config.apiUrl !== undefined) updates.push({ key: "core_stream_engine_api_url", value: config.apiUrl.trim() });
  if (config.apiKey !== undefined) updates.push({ key: "core_stream_engine_api_key", value: config.apiKey.trim() });
  if (config.autoSync !== undefined) updates.push({ key: "core_stream_engine_auto_sync", value: !!config.autoSync });
  if (config.syncIntervalMinutes !== undefined) updates.push({ key: "core_stream_engine_sync_interval", value: Number(config.syncIntervalMinutes) || 30 });
  if (config.lastSyncedAt !== undefined) updates.push({ key: "last_core_engine_sync_at", value: config.lastSyncedAt });
  if (config.lastStats !== undefined) updates.push({ key: "last_core_engine_sync_stats", value: config.lastStats });

  for (const item of updates) {
    const idx = store.app_settings.findIndex((s) => s.key === item.key);
    if (idx >= 0) {
      store.app_settings[idx] = { ...store.app_settings[idx], value: item.value, updated_at: new Date().toISOString() };
    } else {
      store.app_settings.push({ key: item.key, value: item.value, updated_at: new Date().toISOString() });
    }
  }

  saveStore(store);
}

/**
 * Intelligent categorization of raw items from Core Stream Engine
 */
function classifyItem(raw: any): {
  category: "Live TV" | "Radio" | "Movies" | "Series";
  genre: string;
  streamType: "HLS" | "MP4" | "AUDIO";
  isForeign: boolean;
  country: string;
} {
  const title = String(raw.title || raw.name || "").toLowerCase();
  const rawCat = String(raw.category || raw.type || raw.group || "").toLowerCase();
  const genre = String(raw.genre || raw.sub_category || raw.subCategory || "").toLowerCase();
  const url = String(raw.source_url || raw.url || raw.stream_url || "");

  let category: "Live TV" | "Radio" | "Movies" | "Series" = "Live TV";

  if (rawCat.includes("radio") || rawCat.includes("radyo") || genre.includes("radyo") || raw.is_radio) {
    category = "Radio";
  } else if (rawCat.includes("series") || rawCat.includes("dizi") || raw.series_title || raw.season != null) {
    category = "Series";
  } else if (rawCat.includes("movie") || rawCat.includes("film") || rawCat.includes("sinema") || genre.includes("film")) {
    category = "Movies";
  } else if (rawCat.includes("live") || rawCat.includes("canlı") || rawCat.includes("tv")) {
    category = "Live TV";
  } else if (/(sezon|season|bölüm|ep\b|s0[1-9]|s[1-9])/i.test(title)) {
    category = "Series";
  } else if (/(film|movie|1080p|720p)/i.test(rawCat)) {
    category = "Movies";
  }

  // Detect Genre (Drama, Bilim Kurgu, etc.)
  let matchedGenre = "Genel";
  const haystack = `${title} ${rawCat} ${genre} ${Array.isArray(raw.tags) ? raw.tags.join(" ") : ""}`;

  if (/bilim\s*kurgu|sci-?fi|uzay/i.test(haystack)) matchedGenre = "Bilim Kurgu";
  else if (/drama|dram\b/i.test(haystack)) matchedGenre = "Drama";
  else if (/aksiyon|action/i.test(haystack)) matchedGenre = "Aksiyon";
  else if (/komedi|comedy/i.test(haystack)) matchedGenre = "Komedi";
  else if (/korku|horror|gerilim|thriller/i.test(haystack)) matchedGenre = "Korku & Gerilim";
  else if (/belgesel|documentary/i.test(haystack)) matchedGenre = "Belgesel";
  else if (/çocuk|cocuk|kids|animasyon|animation|anime/i.test(haystack)) matchedGenre = "Animasyon & Çocuk";
  else if (/romantik|romance|aşk/i.test(haystack)) matchedGenre = "Romantik";
  else if (/haber|news/i.test(haystack)) matchedGenre = "Haber";
  else if (/spor|sports/i.test(haystack)) matchedGenre = "Spor";
  else if (category === "Radio") matchedGenre = "Ulusal Radyo";
  else if (category === "Live TV") matchedGenre = "Ulusal TV";

  // Stream type
  let streamType: "HLS" | "MP4" | "AUDIO" = "HLS";
  if (category === "Radio") {
    streamType = /m3u8/i.test(url) ? "HLS" : "AUDIO";
  } else if (/\.mp4(\?|$)/i.test(url)) {
    streamType = "MP4";
  }

  // Country
  const country = raw.country || (/(tr|turkey|türkiye|türk)/i.test(haystack) ? "Türkiye" : "Yabancı");
  const isForeign = country !== "Türkiye";

  return { category, genre: matchedGenre, streamType, isForeign, country };
}

/**
 * Execute synchronous or background sync from the configured Core Stream Engine API
 */
export async function syncCoreStreamEngine(customUrl?: string, customKey?: string): Promise<CoreEngineSyncResult> {
  const config = await getCoreEngineConfig();
  const targetUrl = (customUrl || config.apiUrl || "").trim();
  const apiKey = (customKey || config.apiKey || "").trim();

  if (!targetUrl) {
    return {
      ok: false,
      totalFetched: 0,
      newOrUpdated: 0,
      categories: { liveTv: 0, radio: 0, movies: 0, series: 0 },
      genres: {},
      lastSynced: new Date().toISOString(),
      error: "Core Stream Engine API adresi girilmedi. Lütfen yönetim panelinden API URL'si girin.",
    };
  }

  try {
    const headers: Record<string, string> = {
      "User-Agent": "TGDiziFilm-CoreEngine/2.0",
      Accept: "application/json, text/plain, */*",
    };
    if (apiKey) {
      if (/^[a-zA-Z0-9_-]{20,}$/.test(apiKey)) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      } else {
        headers["x-api-key"] = apiKey;
      }
    }

    const response = await fetch(targetUrl, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      throw new Error(`Core Stream Engine HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";
    let items: any[] = [];

    if (contentType.includes("json")) {
      const data = await response.json();
      if (Array.isArray(data)) {
        items = data;
      } else if (data && typeof data === "object") {
        if (Array.isArray(data.streams)) items = data.streams;
        else if (Array.isArray(data.channels)) items = data.channels;
        else if (Array.isArray(data.data)) items = data.data;
        else if (Array.isArray(data.items)) items = data.items;
        else if (Array.isArray(data.results)) items = data.results;
      }
    } else {
      // Might be M3U text
      const text = await response.text();
      if (text.startsWith("#EXTM3U") || text.includes("#EXTINF")) {
        const { parseM3U } = await import("@/lib/m3u-parser");
        const parsed = parseM3U(text);
        items = parsed.map((p) => ({
          title: p.title,
          source_url: p.url,
          logo_url: p.tvgLogo || null,
          poster_url: p.tvgLogo || null,
          group: p.groupTitle || null,
          category: p.groupTitle || null,
        }));
      }
    }

    if (items.length === 0) {
      return {
        ok: true,
        totalFetched: 0,
        newOrUpdated: 0,
        categories: { liveTv: 0, radio: 0, movies: 0, series: 0 },
        genres: {},
        lastSynced: new Date().toISOString(),
      };
    }

    const store = loadStore();
    if (!Array.isArray(store.user_streams)) {
      store.user_streams = [];
    }

    let updatedCount = 0;
    const catCounts = { liveTv: 0, radio: 0, movies: 0, series: 0 };
    const genreCounts: Record<string, number> = {};

    for (const raw of items) {
      const sourceUrl = (raw.source_url || raw.url || raw.stream_url || "").trim();
      const title = (raw.title || raw.name || "").trim();
      if (!sourceUrl || !title) continue;

      const { category, genre, streamType, isForeign, country } = classifyItem(raw);

      // Tally
      if (category === "Live TV") catCounts.liveTv++;
      else if (category === "Radio") catCounts.radio++;
      else if (category === "Movies") catCounts.movies++;
      else if (category === "Series") catCounts.series++;

      genreCounts[genre] = (genreCounts[genre] || 0) + 1;

      const existingIdx = store.user_streams.findIndex(
        (s) => s.source_url === sourceUrl || (s.title.toLowerCase() === title.toLowerCase() && s.category === category)
      );

      const streamRecord = {
        id: existingIdx >= 0 ? store.user_streams[existingIdx].id : `cse-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title,
        normalized_title: title.toLowerCase(),
        source_url: sourceUrl,
        category,
        sub_category: genre,
        stream_type: streamType,
        poster_url: raw.poster_url || raw.poster || raw.logo_url || raw.logo || null,
        logo_url: raw.logo_url || raw.logo || raw.poster_url || null,
        backdrop_url: raw.backdrop_url || raw.backdrop || raw.poster_url || null,
        description: raw.description || raw.overview || `${category} - ${genre} (Core Stream Engine)`,
        channel_group: raw.channel_group || raw.group || genre,
        country,
        is_foreign: isForeign,
        is_active: raw.is_active !== false,
        release_year: Number(raw.year || raw.release_year) || (category === "Live TV" || category === "Radio" ? null : new Date().getFullYear()),
        imdb_rating: Number(raw.imdb || raw.rating || raw.imdb_rating) || null,
        series_title: raw.series_title || (category === "Series" ? title : null),
        season: raw.season != null ? Number(raw.season) : null,
        episode: raw.episode != null ? Number(raw.episode) : null,
        tags: Array.from(new Set(["core-stream-engine", category.toLowerCase(), genre.toLowerCase(), ...(Array.isArray(raw.tags) ? raw.tags : [])])),
        updated_at: new Date().toISOString(),
        created_at: existingIdx >= 0 ? store.user_streams[existingIdx].created_at : new Date().toISOString(),
      };

      if (existingIdx >= 0) {
        store.user_streams[existingIdx] = { ...store.user_streams[existingIdx], ...streamRecord };
      } else {
        store.user_streams.unshift(streamRecord);
      }
      updatedCount++;
    }

    saveStore(store);

    const result: CoreEngineSyncResult = {
      ok: true,
      totalFetched: items.length,
      newOrUpdated: updatedCount,
      categories: catCounts,
      genres: genreCounts,
      lastSynced: new Date().toISOString(),
    };

    // Save audit log
    if (Array.isArray(store.audit_logs)) {
      store.audit_logs.unshift({
        id: `audit-${Date.now()}`,
        action: "core_engine.sync",
        source: "system",
        level: "success",
        message: `Core Stream Engine senkronizasyonu tamamlandı: ${updatedCount} içerik güncellendi.`,
        meta: result,
        created_at: new Date().toISOString(),
      });
      saveStore(store);
    }

    // Save status in settings
    await saveCoreEngineConfig({
      lastSyncedAt: result.lastSynced,
      lastStats: result,
    });

    return result;
  } catch (error: any) {
    console.error("[Core Stream Engine Sync] Error:", error);
    const failResult: CoreEngineSyncResult = {
      ok: false,
      totalFetched: 0,
      newOrUpdated: 0,
      categories: { liveTv: 0, radio: 0, movies: 0, series: 0 },
      genres: {},
      lastSynced: new Date().toISOString(),
      error: error.message || String(error),
    };
    return failResult;
  }
}
