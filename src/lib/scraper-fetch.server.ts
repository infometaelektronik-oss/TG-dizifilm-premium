// Server-only fetch helper with UA rotation, realistic headers,
// optional proxy rotation and human-like jitter. Used by AI scraper and
// link health checks to dodge bot blocks.

const UA_POOL = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.2849.46",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPad; CPU OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
];

const SEC_CH_UA_BY_BROWSER: Record<string, string> = {
  Chrome: '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  Edg: '"Microsoft Edge";v="130", "Chromium";v="130", "Not_A Brand";v="24"',
  Firefox: "",
  Safari: "",
};

export function pickUserAgent(): string {
  return UA_POOL[Math.floor(Math.random() * UA_POOL.length)];
}

export function realisticHeaders(targetUrl: string, ua = pickUserAgent()): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": ua,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.7,en;q=0.6",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Upgrade-Insecure-Requests": "1",
  };
  // Sec-CH-UA hints for Chromium-based UAs
  for (const [k, v] of Object.entries(SEC_CH_UA_BY_BROWSER)) {
    if (ua.includes(k) && v) {
      headers["sec-ch-ua"] = v;
      headers["sec-ch-ua-mobile"] = /Mobile|Android|iPhone/.test(ua) ? "?1" : "?0";
      headers["sec-ch-ua-platform"] = /Windows/.test(ua)
        ? '"Windows"'
        : /Mac/.test(ua)
          ? '"macOS"'
          : /Android/.test(ua)
            ? '"Android"'
            : /iPhone|iPad/.test(ua)
              ? '"iOS"'
              : '"Linux"';
      break;
    }
  }
  try {
    const u = new URL(targetUrl);
    headers["Referer"] = `${u.protocol}//${u.host}/`;
    headers["Origin"] = `${u.protocol}//${u.host}`;
  } catch {
    /* ignore */
  }
  return headers;
}

export function jitterMs(min = 1500, max = 4000): number {
  return Math.floor(min + Math.random() * (max - min));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function getProxyList(): string[] {
  const raw = process.env.SCRAPER_PROXIES || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function pickProxy(): string | null {
  const list = getProxyList();
  if (list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Cloudflare Workers fetch doesn't support outbound proxies natively.
 * If SCRAPER_PROXIES is set with comma-separated proxy *gateway* URLs
 * (e.g. "https://proxy.example/fetch?url="), we rewrite the URL through one.
 * Otherwise fetch directly. Headers always include realistic UA + Referer.
 */
export async function smartFetch(
  url: string,
  init: RequestInit = {},
  opts: { jitter?: boolean } = {},
): Promise<Response> {
  const { validatePublicHttpUrl } = await import("@/lib/url-security.server");
  validatePublicHttpUrl(url);
  if (opts.jitter) await sleep(jitterMs());
  const proxy = pickProxy();
  const headers = {
    ...realisticHeaders(url),
    ...(init.headers as Record<string, string> | undefined),
  };
  const target = proxy ? `${proxy}${encodeURIComponent(url)}` : url;
  return fetch(target, { ...init, headers });
}
