import { createFileRoute } from "@tanstack/react-router";

// Public cron endpoint — invoked hourly by pg_cron via pg_net.
// No auth required (this path is whitelisted), but only performs idempotent
// background work and never exposes user data.
export const Route = (createFileRoute("/api/public/cron/check-links") as any)({
  server: {
    handlers: {
      POST: async ({ request }: any) => {
        const { verifyCronRequest } = await import("@/lib/url-security.server");
        const unauthorized = verifyCronRequest(request);
        if (unauthorized) return unauthorized;
        try {
          const { runLinkHealthCheckCore } = await import("@/lib/link-health.server");
          const result = await runLinkHealthCheckCore({ limit: 150, olderThanMinutes: 50 });
          return new Response(JSON.stringify({ ok: true, ...result }), {
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
        new Response(JSON.stringify({ ok: true, hint: "POST to trigger a check" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    },
  },
});
