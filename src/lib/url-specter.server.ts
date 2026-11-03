// SERVER-ONLY integration of url-specter-probe extraction ideas.

import { validatePublicHttpUrl } from "@/lib/url-security.server";

const UA_PRIMARY =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const UA_FALLBACK =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";

const STREAM_RE = /https?:\/\/[^\s'"<>()\\]+?\.(?:m3u8|mp4|mpd|ts|aac|mp3|m4a)(?:\?[^\s'"<>()\\]*)?/gi;
const PLAYER_RE = /https?:\/\/[^\s'"<>()\\]+?(?:player\.php|embed|stream|hls|playlist|watch|video)[^\s'"<>()\\]*/gi;
const IFRAME_SRC_RE = /<iframe[^>]+src=["']([^"']+)["']/gi;
const MEDIA_ATTR_RE = /(?:src|href|file|source|url)\s*[:=]\s*["']([^"']+\.(?:m3u8|mp4|mpd|ts|aac|mp3|m4a)(?:\?[^"']*)?)["']/gi;

function buildHeaders(targetUrl: string, ua: string): Record<string, string> {
  const u = validatePublicHttpUrl(targetUrl);
  return {
    "User-Agent": ua,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "max-age=0",
    "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    Referer: `${u.protocol}//${u.host}/`,
  };
}

function looksBlocked(html: string, status: number): boolean {
  if (status === 403 || status === 429 || status === 503) return true;
  const lower = html.slice(0, 4000).toLowerCase();
  return lower.includes("cloudflare") && (lower.includes("attention required") || lower.includes("just a moment") || lower.includes("checking your browser"));
}

async function doFetch(url: string, ua: string) {
  validatePublicHttpUrl(url);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { headers: buildHeaders(url, ua), redirect: "follow", signal: ctrl.signal });
    const html = await res.text();
    return { status: res.status, html, finalUrl: res.url || url };
  } finally {
    clearTimeout(t);
  }
}

export async function crawlUrlSpecter(url: string) {
  const log: string[] = [`[CHROME] User-Agent kamuflajı aktif. Hedef: ${url}`];
  let attempt = await doFetch(url, UA_PRIMARY);
  if (looksBlocked(attempt.html, attempt.status)) {
    log.push("[UYARI] Bot koruması tespit edildi, alternatif tarayıcı kimliği deneniyor...");
    attempt = await doFetch(url, UA_FALLBACK);
  }
  log.push(attempt.status >= 400 ? `[HATA] HTTP ${attempt.status}` : `[OK] ${attempt.html.length} bayt indirildi.`);
  return { ...attempt, log };
}

function absolutize(baseUrl: string, value?: string | null) {
  if (!value) return "";
  try {
    return validatePublicHttpUrl(new URL(value.trim(), baseUrl).toString()).toString();
  } catch {
    return "";
  }
}

export function extractStreamCandidates(html: string, baseUrl: string): string[] {
  const found = new Set<string>();
  for (const match of html.matchAll(STREAM_RE)) {
    const url = absolutize(baseUrl, match[0]);
    if (url) found.add(url);
  }
  for (const match of html.matchAll(MEDIA_ATTR_RE)) {
    const url = absolutize(baseUrl, match[1]);
    if (url) found.add(url);
  }
  for (const match of html.matchAll(PLAYER_RE)) {
    const player = absolutize(baseUrl, match[0]);
    if (player && /\.(m3u8|mp4|mpd|ts|aac|mp3|m4a)(\?|$)/i.test(player)) found.add(player);
  }
  for (const match of html.matchAll(IFRAME_SRC_RE)) {
    const iframe = absolutize(baseUrl, match[1]);
    if (iframe && /\.(m3u8|mp4|mpd|ts|aac|mp3|m4a)(\?|$)/i.test(iframe)) found.add(iframe);
  }
  return Array.from(found).slice(0, 32);
}

export function extractPageMeta(html: string, baseUrl: string): { og?: string; twitter?: string; biggestImg?: string; title?: string } {
  const meta = (name: string, attr = "property") => {
    const re = new RegExp(`<meta[^>]+${attr}=["']${name}["'][^>]+content=["']([^"']+)["']`, "i");
    return re.exec(html)?.[1];
  };
  const absolutizeMaybe = (u?: string) => absolutize(baseUrl, u) || undefined;
  let biggest: { url: string; w: number } | null = null;
  for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*?(?:width=["'](\d+)["'])?/gi)) {
    const url = absolutizeMaybe(m[1]);
    const w = m[2] ? Number.parseInt(m[2], 10) : 100;
    if (url && (!biggest || w > biggest.w)) biggest = { url, w };
  }
  return {
    og: absolutizeMaybe(meta("og:image") || meta("og:image:url")),
    twitter: absolutizeMaybe(meta("twitter:image", "name")),
    biggestImg: biggest?.url,
    title: /<title>([^<]+)<\/title>/i.exec(html)?.[1]?.trim(),
  };
}
