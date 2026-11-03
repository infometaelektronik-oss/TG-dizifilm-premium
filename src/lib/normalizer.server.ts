// SERVER-ONLY: AI İsim Temizleme ve Logolama (AI Channel Normalizer)
// Kazıyıcının getirdiği "TR_ATV_1080p_v3" gibi isimleri "ATV HD" gibi temiz
// isimlere dönüştürür ve açık logo paketinden logo eşler.

import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

export type NormalizeResult = {
  scanned: number;
  updated: number;
  logosMatched: number;
  usedAi: boolean;
  samples: { from: string; to: string }[];
};

const NOISE = [
  /\b(hevc|h26[45]|fhd|uhd|sd|hd|4k|1080p?|720p?|480p?|360p?|2160p?)\b/gi,
  /\b(v\d+|backup|yedek|test|new|old|mirror|source|kaynak)\b/gi,
  /\b(tr|turkiye|türkiye|turkey)[_\-|:]\s*/gi,
  /[\[\](){}]/g,
];

/** AI yoksa devreye giren deterministik temizleyici. */
export function heuristicClean(raw: string): string {
  let t = ` ${raw} `.replace(/[_|]+/g, " ").replace(/\s+/g, " ");
  for (const re of NOISE) t = t.replace(re, " ");
  t = t.replace(/\s*[-–]\s*$/, "").replace(/\s+/g, " ").trim();
  if (!t) t = raw.trim();
  const isChannelish = /^[a-zçğıöşü0-9 .]+$/i.test(t) && t.length <= 22;
  if (isChannelish) {
    t = t
      .split(" ")
      .map((w) => (w.length <= 4 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
      .join(" ");
    if (/1080|fhd|hd/i.test(raw) && !/HD$/.test(t)) t = `${t} HD`;
  }
  return t.slice(0, 90);
}

function logoSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/\bhd\b|\bfhd\b|\b4k\b/g, "")
    .replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g")
    .replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[şŞ]/g, "s")
    .replace(/[üÜ]/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Açık kaynak tv-logos paketinden logo adresi dener. */
export async function matchLogo(title: string, isForeign: boolean): Promise<string | null> {
  const slug = logoSlug(title);
  if (!slug) return null;
  const countries = isForeign ? ["united-kingdom", "united-states", "germany"] : ["turkey"];
  for (const country of countries) {
    const url = `https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/${country}/${slug}-tr.png`;
    const alt = `https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/${country}/${slug}.png`;
    for (const candidate of [alt, url]) {
      try {
        const res = await fetch(candidate, {
          method: "HEAD",
          redirect: "follow",
          signal: AbortSignal.timeout(1200),
        });
        if (res.ok) return candidate;
      } catch {
        /* yoksay */
      }
    }
  }
  return null;
}

async function aiClean(titles: string[]): Promise<Record<string, string>> {
  if (titles.length === 0) return {};
  try {
    const { callGemini } = await import("@/lib/gemini.server");
    const text = await callGemini(
      JSON.stringify({ titles: titles.slice(0, 60) }),
      "Sen bir IPTV kanal/içerik ismi temizleyicisisin. Kodlama artıklarını (TR_, _1080p, v3, backup, HEVC) at, marka adını doğru büyük harflerle yaz. Örnek: TR_ATV_1080p_v3 -> ATV HD. Yalnızca JSON obje döndür: {\"orijinal\":\"temiz\"}. Başka metin yazma."
    );
    if (!text) return {};
    const clean = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
    const parsed = JSON.parse(clean) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function runNormalizer(limit = 40): Promise<NormalizeResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { logAudit } = await import("@/lib/audit.server");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows, error } = await (supabaseAdmin as any)
    .from("user_streams")
    .select("id,title,normalized_title,logo_url,poster_url,is_foreign")
    .eq("manual_lock", false)
    .is("deleted_at", null)
    .is("ai_normalized_at", null)
    .limit(limit);
  if (error) throw new Error(error.message);

  const list = (rows || []) as {
    id: string;
    title: string;
    logo_url: string | null;
    poster_url: string | null;
    is_foreign: boolean;
  }[];
  const out: NormalizeResult = { scanned: list.length, updated: 0, logosMatched: 0, usedAi: false, samples: [] };
  if (list.length === 0) return out;

  let map: Record<string, string> = {};
  try {
    map = await aiClean(list.map((r) => r.title));
    out.usedAi = Object.keys(map).length > 0;
  } catch {
    map = {};
  }

  for (const row of list) {
    const clean = (map[row.title] || heuristicClean(row.title)).trim().slice(0, 90) || row.title;
    let logo = row.logo_url;
    if (!logo) {
      const found = await matchLogo(clean, row.is_foreign);
      if (found) {
        logo = found;
        out.logosMatched++;
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any)
      .from("user_streams")
      .update({
        title: clean,
        normalized_title: clean.toLowerCase(),
        logo_url: logo,
        poster_url: row.poster_url || logo,
        ai_normalized_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    out.updated++;
    if (out.samples.length < 8 && clean !== row.title) out.samples.push({ from: row.title, to: clean });
  }

  await logAudit({
    action: "ai.normalize",
    source: "system",
    level: "success",
    message: `AI isim temizleme · ${out.updated} kayıt düzeltildi · ${out.logosMatched} logo eşlendi${out.usedAi ? "" : " (yapay zeka yanıt vermedi, kural motoru kullanıldı)"}`,
    meta: { ...out },
  });
  return out;
}
