// Otonom kazıyıcı cron endpoint'i.
// pg_cron her 15 dakikada bir POST atacak. Kullanıcı hiçbir link vermez —
// scraper_seeds tablosundaki tohum URL'ler sırayla taranır.
import { createFileRoute } from "@tanstack/react-router";

export const Route = (createFileRoute("/api/public/cron/autonomous-scan") as any)({
  server: {
    handlers: {
      POST: async ({ request }: any) => {
        const { verifyCronRequest } = await import("@/lib/url-security.server");
        const unauthorized = verifyCronRequest(request);
        if (unauthorized) return unauthorized;
        try {
          const { runAutonomousScan } = await import("@/lib/autonomous.server");
          const result = await runAutonomousScan(3);
          // Arka planda yeni içeriklerin meta-verisini doldur
          let meta: unknown = null;
          try {
            const { runMetaEnrichment } = await import("@/lib/metadata.server");
            meta = await runMetaEnrichment(10);
          } catch {
            meta = null;
          }
          // Ölü link temizliği her turda; kopya birleştirme saatte bir
          let health: unknown = null;
          let dedupe: unknown = null;
          try {
            const { runLinkHealthCheckCore } = await import("@/lib/link-health.server");
            health = await runLinkHealthCheckCore({ limit: 40, olderThanMinutes: 180 });
            if (new Date().getUTCMinutes() < 15) {
              const { runDedupe } = await import("@/lib/self-heal.server");
              dedupe = await runDedupe();
            }
          } catch {
            /* temizlik hatası taramayı bozmasın */
          }
          return new Response(JSON.stringify({ ok: true, ...result, meta, health, dedupe }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          return new Response(
            JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
      GET: async () =>
        new Response(JSON.stringify({ ok: true, hint: "POST to run autonomous scan" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    },
  },
});
