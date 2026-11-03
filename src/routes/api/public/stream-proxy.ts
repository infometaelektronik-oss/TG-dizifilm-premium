// Edge proxy that fetches a remote stream with custom Referer/Origin and
// pipes the response back with permissive CORS. Solves the case where a
// stream works in VLC but not in our <video> because the origin server
// requires a specific Referer the browser cannot send.
import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type, Accept",
  "Access-Control-Expose-Headers":
    "Content-Length, Content-Range, Accept-Ranges, Content-Type",
  "Access-Control-Max-Age": "86400",
};

export const Route = (createFileRoute("/api/public/stream-proxy") as any)({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      HEAD: async ({ request }: any) => proxy(request, "HEAD"),
      GET: async ({ request }: any) => proxy(request, "GET"),
    },
  },
});

async function proxy(request: Request, method: "GET" | "HEAD"): Promise<Response> {
  const inUrl = new URL(request.url);
  const target = inUrl.searchParams.get("url");
  if (!target || !/^https?:\/\//i.test(target)) {
    return new Response("Missing or invalid url param", { status: 400, headers: CORS });
  }
  const referer = inUrl.searchParams.get("referer") || undefined;
  const origin = inUrl.searchParams.get("origin") || undefined;

  let upstreamUrl: URL;
  try {
    const { validatePublicHttpUrl } = await import("@/lib/url-security.server");
    upstreamUrl = validatePublicHttpUrl(target);
  } catch {
    return new Response("Bad url", { status: 400, headers: CORS });
  }


  const headers: Record<string, string> = {
    "User-Agent": await getProxyUserAgent(),
    Accept: "*/*",
    "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.7",
    Referer: referer || `${upstreamUrl.protocol}//${upstreamUrl.host}/`,
    Origin: origin || `${upstreamUrl.protocol}//${upstreamUrl.host}`,
  };
  const range = request.headers.get("range");
  if (range) headers["Range"] = range;

  let upstream: Response;
  try {
    upstream = await fetch(target, { method, headers, redirect: "follow" });
  } catch (e) {
    return new Response("Upstream fetch failed: " + (e instanceof Error ? e.message : "?"), {
      status: 502,
      headers: CORS,
    });
  }

  const outHeaders = new Headers(CORS);
  const passthrough = [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "cache-control",
    "last-modified",
    "etag",
  ];
  for (const h of passthrough) {
    const v = upstream.headers.get(h);
    if (v) outHeaders.set(h, v);
  }

  // For .m3u8 playlists rewrite relative segment URLs through this proxy so
  // CORS continues to work for each segment.
  const ct = (upstream.headers.get("content-type") || "").toLowerCase();
  const isPlaylist =
    ct.includes("mpegurl") ||
    ct.includes("vnd.apple.mpegurl") ||
    /\.m3u8(\?|$)/i.test(upstreamUrl.pathname);

  if (method === "GET" && isPlaylist) {
    const text = await upstream.text();
    const rewritten = rewriteM3U(text, upstreamUrl, referer);
    outHeaders.set("content-type", "application/vnd.apple.mpegurl");
    outHeaders.delete("content-length");
    return new Response(rewritten, { status: upstream.status, headers: outHeaders });
  }

  return new Response(upstream.body, { status: upstream.status, headers: outHeaders });
}

async function getProxyUserAgent(): Promise<string> {
  const { pickUserAgent } = await import("@/lib/scraper-fetch.server");
  return pickUserAgent();
}

function rewriteM3U(text: string, base: URL, referer?: string): string {
  const proxyBase = "/api/public/stream-proxy";
  const refQ = referer ? `&referer=${encodeURIComponent(referer)}` : "";
  return text
    .split(/\r?\n/)
    .map((line) => {
      const t = line.trim();
      if (!t || t.startsWith("#")) {
        // Rewrite URI="..." attributes inside #EXT-X-KEY etc.
        return line.replace(/URI="([^"]+)"/gi, (_m, u) => {
          const abs = absolutize(u, base);
          return `URI="${proxyBase}?url=${encodeURIComponent(abs)}${refQ}"`;
        });
      }
      const abs = absolutize(t, base);
      return `${proxyBase}?url=${encodeURIComponent(abs)}${refQ}`;
    })
    .join("\n");
}

function absolutize(ref: string, base: URL): string {
  try {
    return new URL(ref, base).toString();
  } catch {
    return ref;
  }
}
