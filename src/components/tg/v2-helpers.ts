// V2 helpers shared across UI components.

export function isRecentlyPublished(iso?: string, hoursWindow = 48): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < hoursWindow * 3600_000;
}

// Build a stream URL routed through our edge proxy when the source requires
// a specific Referer header (most anti-hotlink streams do).
export function proxiedStreamUrl(sourceUrl: string, referer?: string): string {
  if (!referer && !needsProxy(sourceUrl)) return sourceUrl;
  const refArg = referer ? `&referer=${encodeURIComponent(referer)}` : "";
  return `/api/public/stream-proxy?url=${encodeURIComponent(sourceUrl)}${refArg}`;
}

function needsProxy(url: string): boolean {
  // Heuristic: most cross-origin streams need it. We only skip when the
  // source is clearly our own asset or a CORS-friendly sample.
  try {
    const u = new URL(url, typeof window !== "undefined" ? window.location.origin : "https://x");
    if (u.origin === (typeof window !== "undefined" ? window.location.origin : "")) return false;
    // Well-known CORS-friendly buckets used in sample data
    if (u.host.includes("commondatastorage.googleapis.com")) return false;
    return true;
  } catch {
    return false;
  }
}
