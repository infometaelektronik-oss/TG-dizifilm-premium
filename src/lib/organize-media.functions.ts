import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminRole } from "@/lib/admin-auth";

export type OrganizedMediaLink = {
  originalUrl: string;
  url: string;
  title: string;
  seriesTitle: string;
  season: number;
  episode: number;
  episodeTitle: string;
  durationSeconds?: number;
  pageUrl?: string;
  confidence: number;
};

type Candidate = {
  url: string;
  pageUrl?: string;
  context: string;
  durationSeconds?: number;
};

const inputSchema = z.object({
  text: z.string().max(400_000).optional().default(""),
  archiveUrls: z.array(z.string().trim().url()).max(12).optional().default([]),
  maxPages: z.number().int().min(1).max(60).optional().default(24),
});

const VIDEO_RE = /https?:\/\/[^\s"'<>()]+?\.(?:m3u8|mp4)(?:\?[^\s"'<>()]*)?/gi;
const PAGE_RE = /https?:\/\/[^\s"'<>()]+/gi;
const HREF_RE = /href=["']([^"']+)["']/gi;
const SHORT_RE = /fragman|trailer|teaser|shorts?|tanıtım|tanitim|preview|ön izleme|on izleme|özet|ozet|kamera arkası|kamera arkasi|klip/i;
const LONG_RE = /tam\s*bölüm|tam\s*bolum|full\s*bölüm|full\s*bolum|tek\s*parça|tek\s*parca|sezon|season|bölüm\s*\d+|bolum\s*\d+|s\d{1,2}\s*e\d{1,3}|\b\d+\.\s*bölüm|\b\d+\.\s*bolum/i;

function cleanUrl(url: string) {
  return url.replace(/[),.;\]]+$/g, "");
}

function secondsFromTime(value: string): number | undefined {
  const parts = value.split(":").map((p) => Number.parseInt(p, 10));
  if (parts.some(Number.isNaN)) return undefined;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return undefined;
}

function secondsFromIso(value: string): number | undefined {
  const match = value.match(/P(?:T)?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!match) return undefined;
  return (Number(match[1] || 0) * 3600) + (Number(match[2] || 0) * 60) + Number(match[3] || 0);
}

function inferDuration(context: string): number | undefined {
  const iso = context.match(/P(?:T)?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i)?.[0];
  const fromIso = iso ? secondsFromIso(iso) : undefined;
  if (fromIso) return fromIso;

  const jsonSeconds = context.match(/(?:duration|durationSeconds|length|lengthSeconds)["'\s:=]+([0-9]{2,5})/i)?.[1];
  if (jsonSeconds) return Number(jsonSeconds);

  const hms = context.match(/\b(\d{1,2}:\d{2}:\d{2})\b/)?.[1];
  const fromHms = hms ? secondsFromTime(hms) : undefined;
  if (fromHms) return fromHms;

  const ms = context.match(/\b(\d{1,3})\s*(?:dk|dakika|min|minute)\b/i)?.[1];
  if (ms) return Number(ms) * 60;

  return undefined;
}

function extractCandidates(source: string, pageUrl?: string): Candidate[] {
  const out: Candidate[] = [];
  for (const match of source.matchAll(VIDEO_RE)) {
    const url = cleanUrl(match[0]);
    const start = Math.max(0, match.index - 900);
    const end = Math.min(source.length, match.index + url.length + 900);
    const context = source.slice(start, end).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const durationSeconds = inferDuration(context);
    if (durationSeconds !== undefined && durationSeconds < 300) continue;
    if (SHORT_RE.test(context)) continue;
    if (durationSeconds !== undefined && durationSeconds < 2400) continue;
    if (durationSeconds === undefined && !LONG_RE.test(context) && !url.toLowerCase().includes(".m3u8")) continue;
    out.push({ url, pageUrl, context: context.slice(0, 1200), durationSeconds });
  }
  return out;
}

function sameOriginLinks(html: string, baseUrl: string) {
  const base = new URL(baseUrl);
  const links = new Set<string>();
  for (const match of html.matchAll(HREF_RE)) {
    try {
      const next = new URL(match[1], base);
      if (next.origin !== base.origin) continue;
      if (/\.(jpg|jpeg|png|gif|webp|svg|css|js|ico|pdf|zip)$/i.test(next.pathname)) continue;
      if (!/(arsiv|arşiv|bolum|bölüm|sezon|season|episode|dizi|izle|video)/i.test(next.href)) continue;
      links.add(next.href.split("#")[0]);
    } catch {
      // ignore bad hrefs
    }
  }
  return Array.from(links);
}

async function crawlArchive(urls: string[], maxPages: number): Promise<Candidate[]> {
  const queue = [...urls];
  const seen = new Set<string>();
  const candidates: Candidate[] = [];

  while (queue.length && seen.size < maxPages) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    try {
      const { validatePublicHttpUrl } = await import("@/lib/url-security.server");
      validatePublicHttpUrl(url);
      const response = await fetch(url, { headers: { accept: "text/html,application/xhtml+xml" } });
      if (!response.ok) continue;
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text") && !contentType.includes("html")) continue;
      const html = await response.text();
      candidates.push(...extractCandidates(html, url));
      queue.push(...sameOriginLinks(html, url).filter((next) => !seen.has(next)).slice(0, 20));
    } catch {
      // broken archive page must not block the scan
    }
  }

  return candidates;
}

function fallbackOrganize(candidates: Candidate[]): OrganizedMediaLink[] {
  return candidates.map((item, index) => {
    const context = decodeURIComponent(item.context || item.url).replace(/[_-]+/g, " ");
    const se = context.match(/s(?:ezon)?\s*(\d{1,2}).{0,12}?(?:e|bölüm|bolum)\s*(\d{1,3})/i);
    const ep = context.match(/(?:bölüm|bolum|episode)\s*(\d{1,3})|\b(\d{1,3})\.\s*(?:bölüm|bolum)/i);
    const seriesTitle = (context.match(/([A-ZÇĞİÖŞÜ][\wÇĞİÖŞÜçğıöşü' ]{2,45})\s+(?:S\d|Sezon|Bölüm|Bolum)/)?.[1] || "TG Dizi Arşivi").trim();
    const season = Number(se?.[1] || 1);
    const episode = Number(se?.[2] || ep?.[1] || ep?.[2] || index + 1);
    const episodeTitle = `Bölüm ${episode}`;
    return {
      originalUrl: item.url,
      url: item.url,
      title: `${seriesTitle} - Sezon ${season} Bölüm ${episode} - ${episodeTitle}`,
      seriesTitle,
      season,
      episode,
      episodeTitle,
      durationSeconds: item.durationSeconds,
      pageUrl: item.pageUrl,
      confidence: item.durationSeconds && item.durationSeconds >= 2400 ? 0.86 : 0.62,
    };
  });
}

async function organizeWithGemini(candidates: Candidate[]): Promise<OrganizedMediaLink[]> {
  if (candidates.length === 0) return fallbackOrganize(candidates);

  try {
    const { callGemini } = await import("@/lib/gemini.server");
    const jsonText = await callGemini(
      JSON.stringify({
        outputShape:
          "[{originalUrl,url,title,seriesTitle,season,episode,episodeTitle,durationSeconds,pageUrl,confidence}]",
        titleFormat: "Dizi Adı - Sezon X Bölüm Y - Bölüm İsmi",
        candidates: candidates.slice(0, 80),
      }),
      "Sen TG Dizi Film için yasal kullanıcı kaynaklarını düzenleyen medya indeksleme motorusun. Fragman, shorts, klip ve 5 dakikadan kısa videoları reddet. Sadece 40+ dakikalık tam bölüm adaylarını düzenle. Yalnızca geçerli JSON array döndür."
    );
    if (!jsonText) return fallbackOrganize(candidates);
    const clean = jsonText.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
    const parsed = JSON.parse(clean) as OrganizedMediaLink[];
    if (!Array.isArray(parsed)) return fallbackOrganize(candidates);
    return parsed
      .filter((item) => item?.url && !SHORT_RE.test(`${item.title} ${item.episodeTitle}`))
      .map((item, index) => {
        const candidate = candidates.find((c) => c.url === item.url || c.url === item.originalUrl) || candidates[index];
        const season = Number(item.season || 1);
        const episode = Number(item.episode || index + 1);
        const seriesTitle = (item.seriesTitle || "TG Dizi Arşivi").trim();
        const episodeTitle = (item.episodeTitle || `Bölüm ${episode}`).trim();
        return {
          originalUrl: item.originalUrl || item.url,
          url: item.url,
          title: `${seriesTitle} - Sezon ${season} Bölüm ${episode} - ${episodeTitle}`,
          seriesTitle,
          season,
          episode,
          episodeTitle,
          durationSeconds: item.durationSeconds || candidate?.durationSeconds,
          pageUrl: item.pageUrl || candidate?.pageUrl,
          confidence: Math.max(0, Math.min(1, Number(item.confidence || 0.75))),
        };
      })
      .sort((a, b) => a.seriesTitle.localeCompare(b.seriesTitle, "tr") || a.season - b.season || a.episode - b.episode);
  } catch {
    return fallbackOrganize(candidates);
  }
}

export const organizeMediaLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<OrganizedMediaLink[]> => {
    await assertAdminRole(context.supabase, context.userId);
    const { validatePublicHttpUrl } = await import("@/lib/url-security.server");
    const pastedUrls = Array.from(new Set((data.text.match(PAGE_RE) || []).map(cleanUrl))).filter(
      (url: any) => !/\.(m3u8|mp4)(?:\?|$)/i.test(String(url)),
    );
    const archiveUrls = Array.from(new Set([...data.archiveUrls, ...pastedUrls]))
      .filter((url) => {
        try {
          validatePublicHttpUrl(url);
          return true;
        } catch {
          return false;
        }
      })
      .slice(0, 12);
    const [direct, crawled] = await Promise.all([
      Promise.resolve(extractCandidates(data.text)),
      crawlArchive(archiveUrls, data.maxPages),
    ]);
    const unique = new Map<string, Candidate>();
    [...direct, ...crawled].forEach((item) => {
      const previous = unique.get(item.url);
      if (!previous || (item.durationSeconds || 0) > (previous.durationSeconds || 0)) unique.set(item.url, item);
    });
    return organizeWithGemini(Array.from(unique.values()));
  });