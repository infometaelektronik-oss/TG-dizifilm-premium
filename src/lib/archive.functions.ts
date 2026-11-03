import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ArchiveEpisode = {
  id: string;
  seriesTitle: string;
  season: number;
  episode: number;
  title?: string;
  streamUrl: string;
  posterUrl?: string;
};

export const getArchiveEpisode = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        seriesTitle: z.string().min(1).max(200),
        season: z.number().int().min(0).max(99),
        episode: z.number().int().min(0).max(999),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<ArchiveEpisode | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // First try active streams (low-latency, currently in rotation)
    const { data: live } = await supabaseAdmin
      .from("user_streams")
      .select("id,title,source_url,poster_url,series_title,season,episode")
      .eq("series_title", data.seriesTitle)
      .eq("season", data.season)
      .eq("episode", data.episode)
      .eq("is_active", true)
      .limit(1);
    const liveRow = (live || [])[0] as
      | { id: string; title: string; source_url: string; poster_url: string | null }
      | undefined;
    if (liveRow) {
      return {
        id: liveRow.id,
        seriesTitle: data.seriesTitle,
        season: data.season,
        episode: data.episode,
        title: liveRow.title,
        streamUrl: liveRow.source_url,
        posterUrl: liveRow.poster_url || undefined,
      };
    }

    // Then fall back to archive (cold storage mirror)
    const { data: arch } = await supabaseAdmin
      .from("archive_episodes")
      .select("*")
      .eq("series_title", data.seriesTitle)
      .eq("season", data.season)
      .eq("episode", data.episode)
      .limit(1);
    const a = (arch || [])[0] as
      | {
          id: string;
          title: string | null;
          stream_url: string;
          poster_url: string | null;
        }
      | undefined;
    if (!a) return null;
    return {
      id: a.id,
      seriesTitle: data.seriesTitle,
      season: data.season,
      episode: data.episode,
      title: a.title || undefined,
      streamUrl: a.stream_url,
      posterUrl: a.poster_url || undefined,
    };
  });

export const listSeriesEpisodes = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({ seriesTitle: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [live, arch] = await Promise.all([
      supabaseAdmin
        .from("user_streams")
        .select("source_url,title,poster_url,season,episode")
        .eq("series_title", data.seriesTitle)
        .eq("is_active", true)
        .order("season", { ascending: true })
        .order("episode", { ascending: true }),
      supabaseAdmin
        .from("archive_episodes")
        .select("stream_url,title,poster_url,season,episode")
        .eq("series_title", data.seriesTitle)
        .order("season", { ascending: true })
        .order("episode", { ascending: true }),
    ]);
    type Item = { streamUrl: string; title?: string; poster?: string; season: number; episode: number; source: "live" | "archive" };
    const map = new Map<string, Item>();
    for (const r of (live.data || []) as Array<{ source_url: string; title: string; poster_url: string | null; season: number | null; episode: number | null }>) {
      const k = `${r.season}-${r.episode}`;
      map.set(k, { streamUrl: r.source_url, title: r.title, poster: r.poster_url || undefined, season: r.season ?? 0, episode: r.episode ?? 0, source: "live" });
    }
    for (const r of (arch.data || []) as Array<{ stream_url: string; title: string | null; poster_url: string | null; season: number; episode: number }>) {
      const k = `${r.season}-${r.episode}`;
      if (!map.has(k)) {
        map.set(k, { streamUrl: r.stream_url, title: r.title || undefined, poster: r.poster_url || undefined, season: r.season, episode: r.episode, source: "archive" });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.season - b.season || a.episode - b.episode);
  });
