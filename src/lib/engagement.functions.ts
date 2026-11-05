import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Public: record one view or category interaction for trending & dynamic UI tuning
export const recordView = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        streamId: z.string().min(1),
        category: z.string().optional(),
        subCategory: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    await db.from("watch_events").insert({
      stream_id: data.streamId,
      category: data.category || null,
      sub_category: data.subCategory || null,
      created_at: new Date().toISOString(),
    });
    return { ok: true };
  });

// Dynamic UI Tuning: Record category click to adjust homepage row priorities in real time
export const recordCategoryClick = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        category: z.string().min(1),
        rowTitle: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { loadStore, saveStore } = await import("@/db/native-db");
    const store = loadStore();
    if (!Array.isArray(store.watch_events)) store.watch_events = [];
    store.watch_events.push({
      stream_id: `cat-click-${data.category}`,
      category: data.category,
      row_title: data.rowTitle || null,
      created_at: new Date().toISOString(),
    });
    saveStore(store);
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
    .select("stream_id, created_at, category")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5000);
  const score = new Map<string, number>();
  const categoryScores = new Map<string, number>();
  const now = Date.now();

  for (const e of (data || []) as { stream_id: string; created_at: string; category?: string }[]) {
    const ageH = (now - new Date(e.created_at).getTime()) / 3600_000;
    const weight = 1 + 2 * Math.max(0, 1 - ageH / 24);
    score.set(e.stream_id, (score.get(e.stream_id) || 0) + weight);
    if (e.category) {
      categoryScores.set(e.category, (categoryScores.get(e.category) || 0) + weight);
    }
  }

  const ranked = [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, s]) => ({ id, score: Math.round(s * 10) / 10 }));

  const topCategories = [...categoryScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cat, pts]) => ({ category: cat, points: Math.round(pts * 10) / 10 }));

  return { ranked: ranked.slice(0, 60), topCategories };
});
