import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Public: record one view for trending. Validated uuid, no PII stored.
export const recordView = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ streamId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any).from("watch_events").insert({ stream_id: data.streamId });
    return { ok: true };
  });

// Public: top streams by views in the last N hours, split by live / series.
export const getTrending = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data } = await db
    .from("watch_events")
    .select("stream_id, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5000);
  const score = new Map<string, number>();
  const now = Date.now();
  for (const e of (data || []) as { stream_id: string; created_at: string }[]) {
    // Recent views weigh more (last hour ≈ 3x, 24h ago ≈ 1x)
    const ageH = (now - new Date(e.created_at).getTime()) / 3600_000;
    score.set(e.stream_id, (score.get(e.stream_id) || 0) + 1 + 2 * Math.max(0, 1 - ageH / 24));
  }
  const ranked = [...score.entries()].sort((a, b) => b[1] - a[1]).map(([id, s]) => ({ id, score: Math.round(s * 10) / 10 }));
  return { ranked: ranked.slice(0, 60) };
});
