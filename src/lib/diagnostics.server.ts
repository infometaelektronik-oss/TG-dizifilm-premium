/**
 * Stream Diagnostics, Speed Test & Autonomous Server Failover Engine
 * Measures ping latency, download bitrate, and triggers autonomous stream failover
 * when network buffering or server slowdown is detected.
 */

import { loadStore, saveStore } from "@/db/native-db";
import { logAudit } from "@/lib/audit.server";
import { sendTelegramReport } from "@/lib/autonomous-agents.server";

export type SpeedTestResult = {
  ok: boolean;
  streamId?: string;
  pingMs: number;
  speedMbps: number;
  qualityGrade: "Mükemmel" | "İyi" | "Orta" | "Kritik / Yavaş";
  isSlow: boolean;
  failoverTriggered: boolean;
  activeUrl: string;
  switchedToUrl?: string;
  message: string;
  telegramReportSent: boolean;
};

export async function runStreamSpeedTest(opts: {
  streamUrl: string;
  streamId?: string;
  title?: string;
  forceFailover?: boolean;
}): Promise<SpeedTestResult> {
  const { streamUrl, streamId, title, forceFailover } = opts;
  const t0 = Date.now();
  let pingMs = 50;
  let speedMbps = 24.5;
  let fetchFailed = false;

  try {
    const upstreamUrl = new URL(streamUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(streamUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Range: "bytes=0-1048575", // First 1MB chunk test
        Referer: `${upstreamUrl.protocol}//${upstreamUrl.host}/`,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const firstByteTime = Date.now() - t0;
    pingMs = Math.max(12, firstByteTime);

    const buf = await res.arrayBuffer();
    const totalTimeSec = Math.max(0.05, (Date.now() - t0) / 1000);
    const bytesReceived = buf.byteLength || 524288;
    speedMbps = Math.round(((bytesReceived * 8) / (totalTimeSec * 1_000_000)) * 10) / 10;
  } catch (err) {
    fetchFailed = true;
    pingMs = 450;
    speedMbps = 1.2;
  }

  // Assess quality grade
  let qualityGrade: SpeedTestResult["qualityGrade"] = "Mükemmel";
  let isSlow = false;

  if (pingMs > 250 || speedMbps < 4.0 || fetchFailed) {
    qualityGrade = "Kritik / Yavaş";
    isSlow = true;
  } else if (pingMs > 160 || speedMbps < 8.0) {
    qualityGrade = "Orta";
    isSlow = true;
  } else if (pingMs > 90 || speedMbps < 15.0) {
    qualityGrade = "İyi";
  } else {
    qualityGrade = "Mükemmel";
  }

  // If slow or forced failover: find backup server and switch!
  let failoverTriggered = false;
  let switchedToUrl: string | undefined;
  let telegramSent = false;

  if (isSlow || forceFailover) {
    const store = loadStore();
    const streams = store.user_streams || [];
    const stream = streams.find((s) => s.id === streamId || s.source_url === streamUrl);

    let candidates: string[] = [];
    if (stream?.backup_urls && Array.isArray(stream.backup_urls)) {
      candidates.push(...stream.backup_urls.filter((u: string) => u && u !== streamUrl));
    }

    // If no explicit backups on stream, find matching streams in the same category/title
    if (candidates.length === 0 && stream) {
      const mirrors = streams.filter(
        (s) =>
          s.id !== stream.id &&
          s.category === stream.category &&
          (s.sub_category === stream.sub_category || s.title.toLowerCase().includes(stream.title.toLowerCase().slice(0, 5))) &&
          s.is_active &&
          s.source_url !== streamUrl
      );
      candidates.push(...mirrors.map((m) => m.source_url));
    }

    // High speed fallback CDN mirror
    if (candidates.length === 0) {
      candidates.push(
        "https://d1rc86nwwc9fag.cloudfront.net/vglive-sk-472500/abpnews/master.m3u8"
      );
    }

    if (candidates.length > 0) {
      switchedToUrl = candidates[0];
      failoverTriggered = true;

      // Update active stream in store
      if (stream) {
        if (!stream.backup_urls) stream.backup_urls = [];
        if (!stream.backup_urls.includes(stream.source_url)) {
          stream.backup_urls.push(stream.source_url);
        }
        stream.source_url = switchedToUrl;
        stream.updated_at = new Date().toISOString();
        saveStore(store);
      }

      // Format Telegram message
      const streamName = title || stream?.title || "Canlı Yayın";
      const tgMsg = `Ağa, programda ${streamName} sunucusunda yavaşlama ve gecikme (Ping: ${pingMs}ms, Hız: ${speedMbps} Mbps) vardı, otonom olarak hızlı yedek sunucuya aktarıldı.`;
      const tgRes = await sendTelegramReport(tgMsg);
      telegramSent = tgRes.sent;

      await logAudit({
        action: "server.failover",
        source: "diagnostics",
        level: "warn",
        entity: "user_streams",
        entityId: streamId,
        message: `${streamName} için sunucu yavaşlığı algılandı. Yedek akışa geçildi (${pingMs}ms -> Hızlı CDN).`,
        meta: { pingMs, speedMbps, from: streamUrl, to: switchedToUrl, tgRes },
      });
    }
  }

  return {
    ok: true,
    streamId,
    pingMs,
    speedMbps,
    qualityGrade,
    isSlow,
    failoverTriggered,
    activeUrl: failoverTriggered && switchedToUrl ? switchedToUrl : streamUrl,
    switchedToUrl,
    message: failoverTriggered
      ? `Sunucu yavaşlığı algılandı (${pingMs} ms). Donma yaşanmaması için otonom olarak hızlı yedek kaynağa geçildi.`
      : `Bağlantı kararlı: Ping ${pingMs} ms · Bant Genişliği ${speedMbps} Mbps (${qualityGrade}).`,
    telegramReportSent: telegramSent,
  };
}
