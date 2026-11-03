import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TGTVItem = {
  id: string;
  title: string;
  description?: string;
  streamUrl: string;
  posterUrl?: string;
  startAt: string;
  endAt: string;
};

export type CurrentBroadcast = {
  item: TGTVItem;
  offsetSeconds: number;
  next?: TGTVItem;
} | null;

export const getTGTVCurrent = createServerFn({ method: "GET" }).handler(
  async (): Promise<CurrentBroadcast> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();
    const { data } = await supabaseAdmin
      .from("tg_tv_schedule")
      .select("*")
      .lte("start_at", now.toISOString())
      .gte("end_at", now.toISOString())
      .order("start_at", { ascending: true })
      .limit(1);
    const row = (data || [])[0] as
      | {
          id: string;
          title: string;
          description: string | null;
          stream_url: string;
          poster_url: string | null;
          start_at: string;
          end_at: string;
        }
      | undefined;
    if (!row) return null;
    const offset = Math.max(0, Math.floor((now.getTime() - new Date(row.start_at).getTime()) / 1000));
    const { data: nextRows } = await supabaseAdmin
      .from("tg_tv_schedule")
      .select("*")
      .gte("start_at", row.end_at)
      .order("start_at", { ascending: true })
      .limit(1);
    const nextRow = (nextRows || [])[0] as typeof row | undefined;
    return {
      item: {
        id: row.id,
        title: row.title,
        description: row.description || undefined,
        streamUrl: row.stream_url,
        posterUrl: row.poster_url || undefined,
        startAt: row.start_at,
        endAt: row.end_at,
      },
      offsetSeconds: offset,
      next: nextRow
        ? {
            id: nextRow.id,
            title: nextRow.title,
            description: nextRow.description || undefined,
            streamUrl: nextRow.stream_url,
            posterUrl: nextRow.poster_url || undefined,
            startAt: nextRow.start_at,
            endAt: nextRow.end_at,
          }
        : undefined,
    };
  },
);

export const getTGTVSchedule = createServerFn({ method: "GET" }).handler(
  async (): Promise<TGTVItem[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const today = new Date();
    const start = new Date(today.getTime() - 2 * 3600_000).toISOString();
    const end = new Date(today.getTime() + 24 * 3600_000).toISOString();
    const { data } = await supabaseAdmin
      .from("tg_tv_schedule")
      .select("*")
      .gte("end_at", start)
      .lte("start_at", end)
      .order("start_at", { ascending: true });
    return ((data || []) as Array<{
      id: string;
      title: string;
      description: string | null;
      stream_url: string;
      poster_url: string | null;
      start_at: string;
      end_at: string;
    }>).map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description || undefined,
      streamUrl: r.stream_url,
      posterUrl: r.poster_url || undefined,
      startAt: r.start_at,
      endAt: r.end_at,
    }));
  },
);

export const getLiveEpgSchedule = createServerFn({ method: "GET" }).handler(async (): Promise<TGTVItem[]> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date();
  const start = new Date(now.getTime() - 2 * 3600_000).toISOString();
  const end = new Date(now.getTime() + 24 * 3600_000).toISOString();
  const { data } = await (supabaseAdmin as any)
    .from("epg_programmes")
    .select("id,title,description,poster_url,start_at,end_at,stream_id,user_streams(source_url)")
    .gte("end_at", start)
    .lte("start_at", end)
    .order("start_at", { ascending: true })
    .limit(200);
  return ((data || []) as any[])
    .map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description || undefined,
      streamUrl: row.user_streams?.source_url || "",
      posterUrl: row.poster_url || undefined,
      startAt: row.start_at,
      endAt: row.end_at,
    }))
    .filter((row) => row.streamUrl);
});

// Admin: AI-generate a 24h schedule from a list of seed titles + stream URLs.
export const generateTGTVSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ hoursPerItem: z.number().min(0.5).max(4).default(1.5) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Yalnızca adminler.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Pull movies + series episodes as schedule pool
    const { data: pool } = await supabaseAdmin
      .from("user_streams")
      .select("title,source_url,poster_url,description,category")
      .in("category", ["Movies", "Series"])
      .eq("is_active", true)
      .limit(40);
    const items = (pool || []) as Array<{
      title: string;
      source_url: string;
      poster_url: string | null;
      description: string | null;
    }>;
    if (items.length === 0) throw new Error("Çizelge için içerik bulunamadı (Dizi/Film ekleyin).");

    // Clear today's schedule
    await supabaseAdmin
      .from("tg_tv_schedule")
      .delete()
      .gte("end_at", new Date(Date.now() - 3600_000).toISOString());

    const slotMs = data.hoursPerItem * 3600_000;
    // Start from top of the previous hour so "now" lands inside a slot
    const top = new Date();
    top.setMinutes(0, 0, 0);
    let cursor = top.getTime() - slotMs;
    const rows: any[] = [];
    for (let i = 0; i < 24; i++) {
      const it = items[i % items.length];
      rows.push({
        title: it.title,
        description: it.description,
        stream_url: it.source_url,
        poster_url: it.poster_url,
        start_at: new Date(cursor).toISOString(),
        end_at: new Date(cursor + slotMs).toISOString(),
      });
      cursor += slotMs;
    }
    await supabaseAdmin.from("tg_tv_schedule").insert(rows);
    return { created: rows.length };
  });

// EPG: Sync from XMLTV feed
export const syncXMLTV = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ url: z.string().url().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Yalnızca adminler.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.url) {
      const { error } = await supabaseAdmin.from("epg_sources").upsert({
        name: new URL(data.url).hostname,
        url: data.url,
        timezone: "Europe/Istanbul",
        disabled: false,
      }, { onConflict: "url" });
      if (error) throw new Error(error.message);
    }
    const { syncXmltvSources } = await import("@/lib/epg.server");
    return syncXmltvSources(5);
  });
