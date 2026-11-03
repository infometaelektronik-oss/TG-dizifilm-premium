// SERVER-ONLY: Tam otonom kazıyıcı çekirdeği.
// Kullanıcı hiçbir link girmez — sistem `scraper_seeds` tablosundan sırayla çeker,
// M3U ise parse+upsert eder, HTML ise ileriki iterasyonda AI ile ayrıştırılır.
//
// Yalnızca `.server.ts` uzantısı taşıyan modüller ya da handler gövdeleri içinde
// dinamik import ile yüklenebilir. Client bundle'a ASLA sızmamalı.

import { parseM3U, sanitizeText, sanitizeUrl, detectSeries } from "@/lib/m3u-parser";
import { smartFetch, sleep, jitterMs } from "@/lib/scraper-fetch.server";
import { classify } from "@/lib/media-classifier";
import { countryFromSeedUrl, countryFromTvgId } from "@/lib/seed-country";
import { crawlUrlSpecter, extractPageMeta, extractStreamCandidates } from "@/lib/url-specter.server";

export type AutoScanResult = {
  processedSeeds: number;
  savedItems: number;
  failed: number;
  errors: string[];
};

// Set per scan from admin settings: when true new rows go live without approval.
let autoPublish = false;

export async function runAutonomousScan(batchSize = 3): Promise<AutoScanResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { logAudit } = await import("@/lib/audit.server");
  const { readAppSettings } = await import("@/lib/app-settings.server");
  const settings = await readAppSettings();
  if (!settings.scraperEnabled) {
    return { processedSeeds: 0, savedItems: 0, failed: 0, errors: ["Tarayıcı yönetim panelinden kapatıldı"] };
  }
  autoPublish = settings.autoPublish;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: seeds, error } = await (supabaseAdmin as any)
    .from("scraper_seeds")
    .select("id,url,hint,force_category,priority")
    .eq("disabled", false)
    .is("deleted_at", null)
    .order("last_scanned_at", { ascending: true, nullsFirst: true })
    .order("priority", { ascending: false })
    .limit(batchSize);

  if (error) throw new Error(error.message);

  const summary: AutoScanResult = { processedSeeds: 0, savedItems: 0, failed: 0, errors: [] };
  await logAudit({
    action: "scraper.start",
    source: "scraper",
    message: `Otonom tarama başladı (${(seeds || []).length} tohum)`,
  });

  for (const seed of seeds || []) {
    summary.processedSeeds++;
    await sleep(jitterMs(500, 1500));
    try {
      const res = await smartFetch(seed.url);
      const body = await res.text();
      const looksLikeM3U = body.trim().startsWith("#EXTM3U") || /\.m3u8?(\?|$)/i.test(seed.url);
      const seedCountry = countryFromSeedUrl(seed.url);
      let inserted = 0;
      if (/radio-browser\.info/i.test(seed.url) && body.trim().startsWith("[")) {
        inserted = await ingestRadioBrowser(body, seedCountry);
      } else if (looksLikeM3U) {
        inserted = await ingestM3U(body, seed.force_category as string | null, seedCountry);
      } else {
        inserted = await ingestHtmlSeed(seed.url, body);
      }
      summary.savedItems += inserted;
      await logAudit({
        action: "scraper.seed_ok",
        source: "scraper",
        level: "success",
        entity: "scraper_seeds",
        entityId: seed.id,
        message: `${seed.url} tarandı · ${inserted} yeni kayıt karantinaya alındı`,
      });
      const { data: currentSeed } = await supabaseAdmin
        .from("scraper_seeds")
        .select("success_count")
        .eq("id", seed.id)
        .maybeSingle();
      await supabaseAdmin
        .from("scraper_seeds")
        .update({
          last_scanned_at: new Date().toISOString(),
          last_error: null,
          success_count: (currentSeed?.success_count ?? 0) + 1,
        })
        .eq("id", seed.id);
    } catch (e) {
      summary.failed++;
      const msg = e instanceof Error ? e.message : String(e);
      if (summary.errors.length < 5) summary.errors.push(`${seed.url}: ${msg}`);
      await logAudit({
        action: "scraper.seed_error",
        source: "scraper",
        level: "error",
        entity: "scraper_seeds",
        entityId: seed.id,
        message: `${seed.url} taranamadı: ${msg.slice(0, 200)}`,
      });
      const { data: currentSeed } = await supabaseAdmin
        .from("scraper_seeds")
        .select("failure_count")
        .eq("id", seed.id)
        .maybeSingle();
      await supabaseAdmin
        .from("scraper_seeds")
        .update({
          last_scanned_at: new Date().toISOString(),
          last_error: msg.slice(0, 300),
          failure_count: (currentSeed?.failure_count ?? 0) + 1,
        })
        .eq("id", seed.id);
    }
  }

  await logAudit({
    action: "scraper.finish",
    source: "scraper",
    level: summary.failed > 0 ? "warn" : "success",
    message: `Tarama bitti · ${summary.processedSeeds} tohum · ${summary.savedItems} yeni kayıt · ${summary.failed} hata`,
    meta: { ...summary },
  });

  return summary;
}

/** Admin panelindeki "Eğer / İse" kurallarını taze kazınan satırlara uygular. */
async function runAutomation(rows: Record<string, unknown>[]): Promise<void> {
  try {
    const { loadAutomationRules, applyRules, bumpRuleHits } = await import("@/lib/automation.server");
    const rules = await loadAutomationRules();
    if (rules.length === 0) return;
    const hits: string[] = [];
    for (const row of rows) {
      const { matched } = applyRules(rules, row);
      hits.push(...matched);
    }
    await bumpRuleHits(hits);
  } catch {
    // Kural motoru hatası kazımayı durdurmasın
  }
}

async function ingestHtmlSeed(seedUrl: string, initialBody?: string): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const crawled = initialBody ? { html: initialBody, finalUrl: seedUrl } : await crawlUrlSpecter(seedUrl);
  const baseUrl = crawled.finalUrl || seedUrl;
  const streams = extractStreamCandidates(crawled.html, baseUrl).slice(0, 24);
  const meta = extractPageMeta(crawled.html, baseUrl);
  if (streams.length === 0) return 0;
  const host = new URL(baseUrl).hostname.replace(/^www\./, "");
  const rows = streams.map((streamUrl, index) => {
    const heuristic = classify(meta.title || host, streamUrl, host);
    const series = detectSeries(meta.title || host, host);
    const poster = sanitizeUrl(meta.og || meta.twitter || meta.biggestImg);
    return {
      title: sanitizeText(index === 0 ? meta.title || host : `${meta.title || host} ${index + 1}`, 120) || host,
      source_url: sanitizeUrl(streamUrl),
      category: series ? "Series" : heuristic.category,
      stream_type: heuristic.streamType,
      poster_url: poster,
      logo_url: poster,
      backdrop_url: poster,
      description: `Otonom URL Specter taraması: ${sanitizeText(baseUrl, 200)}`,
      channel_group: sanitizeText(host, 80),
      country: heuristic.country,
      is_foreign: heuristic.isForeign,
      tags: Array.from(new Set([...heuristic.tags, "url-specter", host])),
      is_active: autoPublish,
      quarantine_reason: autoPublish ? null : "auto_specter_pending_health_check",
      health_score: 0,
      series_title: series?.title || null,
      season: series?.season ?? null,
      episode: series?.episode ?? null,
      published_at: new Date().toISOString(),
    };
  }).filter((row) => row.source_url);
  if (rows.length === 0) return 0;
  await runAutomation(rows as unknown as Record<string, unknown>[]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from("user_streams")
    .upsert(rows, { onConflict: "source_url", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

type RadioStation = { name?: string; url_resolved?: string; url?: string; favicon?: string; tags?: string; countrycode?: string; codec?: string };

/** Radio Browser (açık radyo dizini) JSON yanıtını radyo kayıtlarına çevirir. */
async function ingestRadioBrowser(body: string, seedCountry: string | null): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { ISO_COUNTRY_TR } = await import("@/lib/seed-country");
  let list: RadioStation[] = [];
  try { list = JSON.parse(body) as RadioStation[]; } catch { return 0; }
  const rows = list
    .map((st) => {
      const url = sanitizeUrl(st.url_resolved || st.url);
      if (!url || !/^https:\/\//i.test(url)) return null;
      const country = seedCountry || ISO_COUNTRY_TR[(st.countrycode || "").toLowerCase()] || null;
      return {
        title: sanitizeText(st.name, 120) || "Radyo",
        source_url: url,
        category: "Radio",
        stream_type: /m3u8/i.test(url) ? "HLS" : "AUDIO",
        poster_url: sanitizeUrl(st.favicon),
        logo_url: sanitizeUrl(st.favicon),
        channel_group: "Radyo",
        country,
        is_foreign: country !== "Türkiye",
        tags: ["radio-browser", ...(st.tags || "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 4)],
        is_active: autoPublish,
        quarantine_reason: autoPublish ? null : "auto_seed_pending_health_check",
        health_score: 0,
        published_at: new Date().toISOString(),
      };
    })
    .filter(Boolean) as Record<string, unknown>[];
  let saved = 0;
  for (let i = 0; i < rows.length; i += 100) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from("user_streams")
      .upsert(rows.slice(i, i + 100), { onConflict: "source_url", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(error.message);
    saved += data?.length ?? 0;
  }
  return saved;
}

/** Ülkesi kesin bilinen kaynaklarda, admin kilitlemediyse yanlış ülke etiketlerini düzeltir. */
async function fixCountries(urls: string[], country: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  for (let i = 0; i < urls.length; i += 200) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any)
      .from("user_streams")
      .update({ country, is_foreign: country !== "Türkiye" })
      .in("source_url", urls.slice(i, i + 200))
      .eq("manual_lock", false);
  }
}

async function ingestM3U(content: string, forceCategory: string | null, seedCountry: string | null = null): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const parsed = parseM3U(content).filter((e) => /^https?:\/\//i.test(e.url));
  if (parsed.length === 0) return 0;

  const rows = parsed
    .map((e) => {
      const heuristic = classify(e.title, e.url, e.groupTitle);
      const exactCountry = seedCountry || countryFromTvgId(e.tvgId);
      if (exactCountry) {
        heuristic.country = exactCountry;
        heuristic.isForeign = exactCountry !== "Türkiye";
      }
      const series = detectSeries(e.title, e.groupTitle);
      const sourceUrl = sanitizeUrl(e.url);
      if (!sourceUrl) return null;
      const cat =
        (forceCategory as "Live TV" | "Series" | "Movies" | "Radio" | null) ||
        (series ? "Series" : heuristic.category);
      return {
        title: sanitizeText(e.title, 120) || "Untitled",
        source_url: sourceUrl,
        category: cat,
        stream_type: heuristic.streamType,
        poster_url: sanitizeUrl(e.tvgLogo),
        logo_url: sanitizeUrl(e.tvgLogo),
        channel_group: sanitizeText(e.groupTitle, 80),
        sub_category: e.subCategory || null,
        country: heuristic.country,
        is_foreign: heuristic.isForeign,
        // Otonom bulgular karantinaya düşer, cron health-sweep terfi ettirir
        is_active: autoPublish,
        quarantine_reason: autoPublish ? null : "auto_seed_pending_health_check",
        health_score: 0,
        series_title: series?.title || null,
        season: series?.season ?? null,
        episode: series?.episode ?? null,
        published_at: new Date().toISOString(),
        __exact: Boolean(exactCountry),
      };
    })
    .filter(Boolean) as Record<string, unknown>[];

  await runAutomation(rows);

  // Kesin ülke bilgisi varsa eski yanlış etiketleri düzelt (kilitli kayıtlara dokunmaz)
  const byCountry = new Map<string, string[]>();
  for (const r of rows) {
    const c = r.country as string | null;
    if (!c || !(seedCountry || r.__exact)) continue;
    byCountry.set(c, [...(byCountry.get(c) || []), r.source_url as string]);
  }
  for (const r of rows) delete r.__exact;
  for (const [c, urls] of byCountry) await fixCountries(urls, c);

  let saved = 0;
  const chunk = 100;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from("user_streams")
      .upsert(slice, { onConflict: "source_url", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(error.message);
    saved += data?.length ?? 0;
  }
  return saved;
}
