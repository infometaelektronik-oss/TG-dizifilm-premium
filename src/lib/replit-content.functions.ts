import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminRole } from "@/lib/admin-auth";
import type { UserStream } from "@/lib/streams.functions";

function streamTypeFromUrl(url: string): UserStream["streamType"] {
  const u = url.toLowerCase();
  if (u.includes(".m3u8")) return "HLS";
  if (/\.(aac|mp3|ogg|m4a)(\?|$)/.test(u)) return "AUDIO";
  if (/\.(mp4|mkv|webm|mov)(\?|$)/.test(u)) return "MP4";
  return "HLS";
}


function toUserStream(s: {
  id: string; title: string; type: "movie" | "series"; category: string;
  streamUrl: string; posterUrl: string; createdAt: string;
}): UserStream {
  return {
    id: s.id,
    title: s.title,
    sourceUrl: s.streamUrl,
    category: s.type === "series" ? "Series" : "Movies",
    subCategory: s.category,
    streamType: streamTypeFromUrl(s.streamUrl),
    posterUrl: s.posterUrl,
    logoUrl: s.posterUrl,
    thumbnailUrl: s.posterUrl,
    backdropUrl: s.posterUrl,
    description: `${s.type === "series" ? "Dizi" : "Film"} · ${s.category}`,
    channelGroup: s.category,
    sortOrder: 0,
    tags: [s.category],
    status: "unknown",
    failureCount: 0,
    publishedAt: s.createdAt,
  };
}

export const listReplitContent = createServerFn({ method: "GET" }).handler(async () => {
  const { replitApi } = await import("./replit-content.server");
  const rows = await replitApi.listStreams();
  return rows.map(toUserStream);
});

const addSchema = z.object({
  title: z.string().trim().min(1).max(200),
  type: z.enum(["movie", "series"]),
  category: z.string().trim().min(1).max(80),
  streamUrl: z.string().trim().url().max(2000),
  posterUrl: z.string().trim().url().max(2000),
});

export const addReplitContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => addSchema.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { replitApi } = await import("./replit-content.server");
    return toUserStream(await replitApi.addStream(data));
  });

export const deleteReplitContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { replitApi } = await import("./replit-content.server");
    await replitApi.deleteStream(data.id);
    return { ok: true };
  });

export const listReplitEpisodes = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ contentId: z.string().min(1) }).parse(i))
  .handler(async ({ data }) => {
    const { replitApi } = await import("./replit-content.server");
    return await replitApi.listEpisodes(data.contentId);
  });

const addEpSchema = z.object({
  contentId: z.string().min(1),
  season: z.number().int().min(0).max(999),
  episodeNumber: z.number().int().min(0).max(9999),
  streamUrl: z.string().trim().url().max(2000),
});

export const addReplitEpisode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => addEpSchema.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { replitApi } = await import("./replit-content.server");
    return await replitApi.addEpisode(data);
  });

export const deleteReplitEpisode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { replitApi } = await import("./replit-content.server");
    await replitApi.deleteEpisode(data.id);
    return { ok: true };
  });
