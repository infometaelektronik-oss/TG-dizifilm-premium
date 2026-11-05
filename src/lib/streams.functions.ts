import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminRole } from "@/lib/admin-auth";
import { classify, type StreamCategory, type StreamStatus, type StreamType, type SubCategory } from "@/lib/media-classifier";

export type { StreamCategory, StreamStatus, StreamType, SubCategory };

export type UserStream = {
  id: string;
  title: string;
  sourceUrl: string;
  category: StreamCategory;
  subCategory?: SubCategory | string;
  streamType: StreamType;
  posterUrl?: string;
  logoUrl?: string;
  thumbnailUrl?: string;
  backdropUrl?: string;
  description?: string;
  channelGroup?: string;
  sortOrder: number;
  tags: string[];
  status: StreamStatus;
  failureCount: number;
  lastCheckedAt?: string;
  lastError?: string;
  referer?: string;
  origin?: string;
  seriesTitle?: string;
  season?: number;
  episode?: number;
  publishedAt?: string;
  country?: string;
  isForeign?: boolean;
  isActive?: boolean;
  backupUrls?: string[];
  releaseYear?: number;
  imdbRating?: number;
  castList?: string[];
  quarantineReason?: string;
};


// Relaxed URL: accept any https(s) URL. Stream type is auto-detected.
const urlSchema = z.string().trim().url().max(2000);

const CATEGORY_ENUM = z.enum(["Live TV", "Series", "Movies", "Radio"]);

const saveSchema = z.object({
  title: z.string().trim().min(2).max(120),
  sourceUrl: urlSchema,
  posterUrl: z.string().trim().url().optional().or(z.literal("")),
  backdropUrl: z.string().trim().url().optional().or(z.literal("")),
  description: z.string().trim().max(400).optional().or(z.literal("")),
  category: CATEGORY_ENUM.optional(),
  subCategory: z.string().trim().max(40).optional().or(z.literal("")),
  channelGroup: z.string().trim().max(80).optional().or(z.literal("")),
  referer: z.string().trim().url().optional().or(z.literal("")),
});

const updateSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(2).max(120).optional(),
  posterUrl: z.string().trim().url().optional().or(z.literal("")),
  backdropUrl: z.string().trim().url().optional().or(z.literal("")),
  description: z.string().trim().max(400).optional().or(z.literal("")),
  category: CATEGORY_ENUM.optional(),
  subCategory: z.string().trim().max(40).optional().or(z.literal("")),
  channelGroup: z.string().trim().max(80).optional().or(z.literal("")),
  sortOrder: z.number().int().optional(),
});

const listPageSchema = z
  .object({
    limit: z.number().int().min(1).max(100).optional().default(25),
    offset: z.number().int().min(0).optional().default(0),
    category: CATEGORY_ENUM.optional(),
  })
  .optional()
  .default({ limit: 25, offset: 0 });

export type Row = {
  id: string;
  title: string;
  source_url: string;
  category: string;
  sub_category?: string | null;
  stream_type: string;
  poster_url: string | null;
  logo_url?: string | null;
  thumbnail_url?: string | null;
  backdrop_url: string | null;
  description: string | null;
  channel_group?: string | null;
  sort_order?: number | null;
  tags: string[];
  status?: string | null;
  failure_count?: number | null;
  last_checked_at?: string | null;
  last_error?: string | null;
  referer?: string | null;
  origin?: string | null;
  series_title?: string | null;
  season?: number | null;
  episode?: number | null;
  published_at?: string | null;
  country?: string | null;
  is_foreign?: boolean | null;
  is_active?: boolean | null;
  backup_urls?: string[] | null;
  release_year?: number | null;
  imdb_rating?: number | string | null;
  cast_list?: string[] | null;
  quarantine_reason?: string | null;
};

export function rowToStream(row: Row): UserStream {
  return {
    id: row.id,
    title: row.title,
    sourceUrl: row.source_url,
    category: row.category as StreamCategory,
    subCategory: row.sub_category || undefined,
    streamType: row.stream_type as StreamType,
    posterUrl: row.poster_url || row.logo_url || row.thumbnail_url || undefined,
    logoUrl: row.logo_url || undefined,
    thumbnailUrl: row.thumbnail_url || undefined,
    backdropUrl: row.backdrop_url || undefined,
    description: row.description || undefined,
    channelGroup: row.channel_group || undefined,
    sortOrder: row.sort_order ?? 0,
    tags: row.tags,
    status: (row.status as StreamStatus) || "unknown",
    failureCount: row.failure_count ?? 0,
    lastCheckedAt: row.last_checked_at || undefined,
    lastError: row.last_error || undefined,
    referer: row.referer || undefined,
    origin: row.origin || undefined,
    seriesTitle: row.series_title || undefined,
    season: row.season ?? undefined,
    episode: row.episode ?? undefined,
    publishedAt: row.published_at || undefined,
    country: row.country || undefined,
    isForeign: row.is_foreign ?? undefined,
    isActive: row.is_active ?? undefined,
    quarantineReason: row.quarantine_reason || undefined,
    backupUrls: row.backup_urls?.filter(Boolean) ?? undefined,
    releaseYear: row.release_year ?? undefined,
    imdbRating: row.imdb_rating != null ? Number(row.imdb_rating) : undefined,
    castList: row.cast_list ?? undefined,
  };
}

export const SELECT_COLS =
  "id,title,source_url,category,sub_category,stream_type,poster_url,logo_url,thumbnail_url,backdrop_url,description,channel_group,sort_order,tags,status,failure_count,last_checked_at,last_error,referer,origin,series_title,season,episode,published_at,country,is_foreign,is_active,quarantine_reason,backup_urls,release_year,imdb_rating,cast_list";

// The database returns at most 1000 rows per request. Without paging, the
// thousands of foreign channels pushed Turkish channels out of the list, so we
// page through everything and always put Turkish (non-foreign) rows first.
export const listUserStreams = createServerFn({ method: "GET" }).handler(
  async (): Promise<UserStream[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const PAGE = 1000;
    const out: Row[] = [];
    for (let from = 0; from < 20000; from += PAGE) {
      const { data, error } = await supabaseAdmin
        .from("user_streams")
        .select(SELECT_COLS)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("is_foreign", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) break;
      out.push(...((data || []) as unknown as Row[]));
      if (!data || data.length < PAGE) break;
    }
    return out.map(rowToStream);
  },
);

export const listUserStreamsPage = createServerFn({ method: "GET" })
  .inputValidator((input) => listPageSchema.parse(input))
  .handler(async ({ data }): Promise<{ items: UserStream[]; total: number; hasMore: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("user_streams")
      .select(SELECT_COLS, { count: "exact" })
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("is_foreign", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);

    if (data.category) query = query.eq("category", data.category);
    const { data: rows, error, count } = await query;
    if (error) return { items: [], total: 0, hasMore: false };
    const items = (rows || []).map((r) => rowToStream(r as unknown as Row));
    const total = count ?? data.offset + items.length;
    return { items, total, hasMore: data.offset + items.length < total };
  });

export const saveUserStream = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => saveSchema.parse(input))
  .handler(async ({ data, context }): Promise<UserStream> => {
    await assertAdminRole(context.supabase, context.userId);
    const classified = classify(data.title, data.sourceUrl, data.channelGroup || undefined);
    const finalCategory = data.category || classified.category;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("user_streams")
      .upsert(
        {
          title: data.title,
          source_url: data.sourceUrl,
          category: finalCategory,
          sub_category: data.subCategory || classified.subCategory || null,
          stream_type: classified.streamType,
          poster_url: data.posterUrl || null,
          logo_url: data.posterUrl || null,
          backdrop_url: data.backdropUrl || null,
          description: data.description || null,
          channel_group: data.channelGroup || null,
          country: classified.country,
          is_foreign: classified.isForeign,
          referer: data.referer || null,
          tags: classified.tags,
          published_at: new Date().toISOString(),
          is_active: true,
          status: "active",
          manual_lock: true,
          quarantine_reason: null,
          failure_count: 0,
        },
        { onConflict: "source_url", ignoreDuplicates: false },
      )
      .select(SELECT_COLS)
      .single();

    if (error || !row) throw new Error(error?.message || "Kaynak kaydedilemedi");
    return rowToStream(row as unknown as Row);
  });

export const updateUserStream = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateSchema.parse(input))
  .handler(async ({ data, context }): Promise<UserStream> => {
    await assertAdminRole(context.supabase, context.userId);
    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.posterUrl !== undefined) {
      patch.poster_url = data.posterUrl || null;
      patch.logo_url = data.posterUrl || null;
    }
    if (data.backdropUrl !== undefined) patch.backdrop_url = data.backdropUrl || null;
    if (data.description !== undefined) patch.description = data.description || null;
    if (data.category !== undefined) patch.category = data.category;
    if (data.subCategory !== undefined) patch.sub_category = data.subCategory || null;
    if (data.channelGroup !== undefined) patch.channel_group = data.channelGroup || null;
    if (data.sortOrder !== undefined) patch.sort_order = data.sortOrder;
    patch.manual_lock = true;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (supabaseAdmin as any)
      .from("user_streams")
      .update(patch)
      .eq("id", data.id)
      .select(SELECT_COLS)
      .single();
    if (error || !row) throw new Error(error?.message || "Güncellenemedi");
    return rowToStream(row as Row);
  });

export const reorderUserStreams = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ ids: z.array(z.string().min(1)).max(2000) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (let i = 0; i < data.ids.length; i++) {
      await supabaseAdmin.from("user_streams").update({ sort_order: i }).eq("id", data.ids[i]);
    }
    return { ok: true };
  });

export const removeUserStream = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAudit } = await import("@/lib/audit.server");
    // Soft delete: 30 gün geri dönüşüm kutusunda bekler
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any)
      .from("user_streams")
      .update({ is_active: false, deleted_at: new Date().toISOString(), deleted_by: context.userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit({
      action: "stream.soft_delete",
      entity: "user_streams",
      entityId: data.id,
      source: "admin",
      actorId: context.userId,
      level: "warn",
      message: "Yayın geri dönüşüm kutusuna taşındı",
    });
    return { ok: true };
  });



// Admin-only nuclear option: hard-delete every user_streams row.
// UI must ask twice before calling this.
export const wipeAllStreams = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ confirm: z.literal("TUMUNU-SIL") }).parse(input))
  .handler(async ({ context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("user_streams")
      .delete()
      .not("id", "is", null)
      .select("id");
    if (error) throw new Error(error.message);
    return { deleted: (data || []).length };
  });


// Re-parse series metadata for entries that look like episodes but were
// mis-categorized (e.g. landed in "Live TV" with "BİLİNMİYOR" group). Admin-only.
export const repairSeriesMetadata = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { detectSeries } = await import("@/lib/m3u-parser");
    const { data } = await supabaseAdmin
      .from("user_streams")
      .select("id,title,channel_group,category,series_title,season,episode")
      .eq("is_active", true)
      .eq("manual_lock", false);
    let fixed = 0;
    for (const row of data || []) {
      const r = row as { id: string; title: string; channel_group: string | null; category: string; series_title: string | null };
      const det = detectSeries(r.title, r.channel_group || undefined);
      if (det && (r.category !== "Series" || r.series_title !== det.title)) {
        await supabaseAdmin
          .from("user_streams")
          .update({
            category: "Series",
            series_title: det.title,
            season: det.season,
            episode: det.episode,
          })
          .eq("id", r.id);
        fixed++;
      }
    }
    return { fixed };
  });

// ---------------------------------------------------------------------------
// Toplu düzenleme (bulk edit) — admin panelinde çoklu seçim için
// ---------------------------------------------------------------------------

const bulkSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(1000),
  patch: z
    .object({
      category: CATEGORY_ENUM.optional(),
      subCategory: z.string().trim().max(40).optional().or(z.literal("")),
      channelGroup: z.string().trim().max(80).optional().or(z.literal("")),
      country: z.string().trim().max(60).optional().or(z.literal("")),
      isForeign: z.boolean().optional(),
      isActive: z.boolean().optional(),
    })
    .refine((p) => Object.keys(p).length > 0, "En az bir alan seçilmeli"),
});

export const bulkUpdateUserStreams = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => bulkSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const patch: Record<string, unknown> = {};
    const p = data.patch;
    if (p.category !== undefined) patch.category = p.category;
    if (p.subCategory !== undefined) patch.sub_category = p.subCategory || null;
    if (p.channelGroup !== undefined) patch.channel_group = p.channelGroup || null;
    if (p.country !== undefined) {
      patch.country = p.country || null;
      patch.is_foreign = Boolean(p.country) && p.country !== "Türkiye";
    }
    if (p.isForeign !== undefined) patch.is_foreign = p.isForeign;
    if (p.isActive !== undefined) patch.is_active = p.isActive;
    // Admin edits are final: automation must never override them.
    if (p.category !== undefined || p.subCategory !== undefined || p.country !== undefined || p.isForeign !== undefined) {
      patch.manual_lock = true;
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("user_streams")
      .update(patch)
      .in("id", data.ids)
      .select("id");
    if (error) throw new Error(error.message);
    return { updated: (rows || []).length };
  });

export const bulkDeleteUserStreams = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ ids: z.array(z.string().min(1)).min(1).max(1000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAudit } = await import("@/lib/audit.server");
    // Soft delete: kayıtlar 30 gün geri dönüşüm kutusunda bekler
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("user_streams")
      .update({ is_active: false, deleted_at: new Date().toISOString(), deleted_by: context.userId })
      .in("id", data.ids)
      .select("id");
    if (error) throw new Error(error.message);
    await logAudit({
      action: "stream.bulk_soft_delete",
      entity: "user_streams",
      source: "admin",
      actorId: context.userId,
      level: "warn",
      message: `${(rows || []).length} yayın geri dönüşüm kutusuna taşındı`,
    });
    return { deleted: (rows || []).length };
  });

/* ------------------------------------------------------------------ */
/* Anlık Yayın Kaynağı Değiştirme (Hot-Swap)                           */
/* ------------------------------------------------------------------ */

export const hotSwapStreamUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().min(1), sourceUrl: z.string().url().max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAudit } = await import("@/lib/audit.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as any;

    const { data: current } = await sb
      .from("user_streams")
      .select("source_url,backup_urls")
      .eq("id", data.id)
      .maybeSingle();

    const previous: string | null = current?.source_url ?? null;
    const backups: string[] = Array.isArray(current?.backup_urls)
      ? (current.backup_urls as string[])
      : [];
    const nextBackups =
      previous && previous !== data.sourceUrl
        ? [previous, ...backups.filter((u) => u !== previous && u !== data.sourceUrl)].slice(0, 8)
        : backups.filter((u) => u !== data.sourceUrl);

    const { error } = await sb
      .from("user_streams")
      .update({
        source_url: data.sourceUrl,
        backup_urls: nextBackups,
        status: "unknown",
        failure_count: 0,
        last_error: null,
        quarantine_reason: null,
        is_active: true,
        last_checked_at: null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await logAudit({
      action: "stream.hot_swap",
      entity: "user_streams",
      entityId: data.id,
      source: "admin",
      actorId: context.userId,
      level: "success",
      message: "Yayın kaynağı anlık olarak değiştirildi",
      meta: { previous, next: data.sourceUrl },
    });
    return { ok: true, previous };
  });
