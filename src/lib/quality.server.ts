// SERVER-ONLY: Yayın kalitesi ölçümü (çözünürlük / bitrate / FPS) ve
// düşük kaliteli yayınların otomatik pasife çekilmesi.

export type QualityInfo = {
  width: number | null;
  height: number | null;
  bitrateKbps: number | null;
  fps: number | null;
  label: string | null;
};

const TIMEOUT_MS = 8000;

export function labelFor(height: number | null): string | null {
  if (!height) return null;
  if (height >= 2000) return "4K";
  if (height >= 1400) return "1440p";
  if (height >= 1000) return "1080p";
  if (height >= 700) return "720p";
  if (height >= 520) return "576p";
  if (height >= 460) return "480p";
  return `${height}p`;
}

/** HLS master playlist'ten en yüksek varyantın kalite bilgisini çıkarır. */
export function parseHlsQuality(manifest: string): QualityInfo {
  const out: QualityInfo = { width: null, height: null, bitrateKbps: null, fps: null, label: null };
  const lines = manifest.split(/\r?\n/);
  for (const line of lines) {
    if (!line.startsWith("#EXT-X-STREAM-INF")) continue;
    const res = /RESOLUTION=(\d+)x(\d+)/i.exec(line);
    const bw = /(?:AVERAGE-)?BANDWIDTH=(\d+)/i.exec(line);
    const fr = /FRAME-RATE=([\d.]+)/i.exec(line);
    const height = res ? Number(res[2]) : null;
    if (height && (!out.height || height > out.height)) {
      out.width = res ? Number(res[1]) : null;
      out.height = height;
      out.fps = fr ? Number(fr[1]) : out.fps;
      out.bitrateKbps = bw ? Math.round(Number(bw[1]) / 1000) : out.bitrateKbps;
    } else if (!out.height) {
      if (bw) out.bitrateKbps = Math.round(Number(bw[1]) / 1000);
      if (fr) out.fps = Number(fr[1]);
    }
  }
  out.label = labelFor(out.height);
  return out;
}

export async function probeQuality(url: string): Promise<QualityInfo> {
  const empty: QualityInfo = { width: null, height: null, bitrateKbps: null, fps: null, label: null };
  const { validatePublicHttpUrl } = await import("@/lib/url-security.server");
  try {
    validatePublicHttpUrl(url);
  } catch {
    return empty;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "VLC/3.0.18 LibVLC/3.0.18", Range: "bytes=0-65535" },
    });
    const text = await res.text();
    clearTimeout(timer);
    if (text.includes("#EXT-X-STREAM-INF")) return parseHlsQuality(text);
    // Varyant playlist / dosya: URL içindeki kalite ipucunu kullan
    const hint = /(\d{3,4})p/i.exec(url);
    const height = hint ? Number(hint[1]) : null;
    return { width: null, height, bitrateKbps: null, fps: null, label: labelFor(height) };
  } catch {
    clearTimeout(timer);
    return empty;
  }
}

export type QualitySweepResult = {
  checked: number;
  measured: number;
  deactivated: number;
};

/** Yayınların kalitesini ölçer, eşik altındakileri otomatik pasife çeker. */
export async function runQualitySweep(limit = 40, minHeight = 480): Promise<QualitySweepResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { logAudit } = await import("@/lib/audit.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows, error } = await (supabaseAdmin as any)
    .from("user_streams")
    .select("id,title,source_url,quality_checked_at")
    .is("deleted_at", null)
    .order("quality_checked_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  const result: QualitySweepResult = { checked: 0, measured: 0, deactivated: 0 };
  const queue = [...(rows || [])];
  const workers = Array.from({ length: 6 }).map(async () => {
    while (queue.length) {
      const row = queue.shift();
      if (!row) break;
      result.checked++;
      const q = await probeQuality(row.source_url);
      if (q.height) result.measured++;
      const update: Record<string, unknown> = {
        video_width: q.width,
        video_height: q.height,
        bitrate_kbps: q.bitrateKbps,
        fps: q.fps,
        quality_label: q.label,
        quality_checked_at: new Date().toISOString(),
      };
      if (q.height && q.height < minHeight) {
        update.is_active = false;
        update.quarantine_reason = `low_quality_${q.height}p`;
        result.deactivated++;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin as any).from("user_streams").update(update).eq("id", row.id);
    }
  });
  await Promise.all(workers);

  await logAudit({
    action: "quality.sweep",
    source: "system",
    level: result.deactivated > 0 ? "warn" : "success",
    message: `Kalite taraması · ${result.checked} yayın · ${result.measured} ölçüldü · ${result.deactivated} düşük kaliteli pasife alındı`,
    meta: { ...result, minHeight },
  });
  return result;
}
