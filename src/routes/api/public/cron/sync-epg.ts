import { createFileRoute } from "@tanstack/react-router";

export const Route = (createFileRoute("/api/public/cron/sync-epg") as any)({
  server: {
    handlers: {
      POST: async ({ request }: any) => {
        const { verifyCronRequest } = await import("@/lib/url-security.server");
        const unauthorized = verifyCronRequest(request);
        if (unauthorized) return unauthorized;
        try {
          const { syncXmltvSources } = await import("@/lib/epg.server");
          return Response.json({ ok: true, ...(await syncXmltvSources(5)) });
        } catch (err) {
          return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
        }
      },
      GET: async () => Response.json({ ok: true, hint: "POST to sync XMLTV EPG" }),
    },
  },
});
