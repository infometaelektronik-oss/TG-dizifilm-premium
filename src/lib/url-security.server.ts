// SERVER-ONLY URL guard shared by scrapers, health checks and stream proxies.

const BLOCKED_HOST_RE = /^(?:localhost|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|169\.254\.|0\.|::1$|\[::1\]$|fc00:|fd[0-9a-f]{2}:|fe80:)/i;

function isBlockedIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return false;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || a === 169 && b === 254 || a === 192 && b === 168 || a === 172 && b >= 16 && b <= 31;
}

export function validatePublicHttpUrl(input: string): URL {
  const url = new URL(input);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Sadece http/https URL kabul edilir.");
  const host = url.hostname.toLowerCase();
  if (!host || BLOCKED_HOST_RE.test(host) || isBlockedIpv4(host) || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) {
    throw new Error("Güvenlik nedeniyle yerel/özel ağ adresleri engellendi.");
  }
  return url;
}

export function isPublicHttpUrl(input: string): boolean {
  try {
    validatePublicHttpUrl(input);
    return true;
  } catch {
    return false;
  }
}

export function verifyCronRequest(request: Request): Response | null {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const provided = request.headers.get("authorization") || request.headers.get("apikey") || "";
    if (provided !== cronSecret && !provided.includes(cronSecret)) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized cron request" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
  }
  return null;
}
