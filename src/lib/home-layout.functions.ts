import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminRole } from "@/lib/admin-auth";
import { rowToStream, SELECT_COLS, type Row, type UserStream } from "@/lib/streams.functions";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type HomeRowRule = {
  category?: string;
  sub_category?: string;
  country?: string;
  is_foreign?: boolean;
  search?: string;
  sort?: "newest" | "title";
};

export type HomeRow = {
  id: string;
  title: string;
  kind: "row" | "hero";
  mode: "manual" | "rule";
  display: "poster" | "channel";
  rule: HomeRowRule;
  maxItems: number;
  position: number;
  enabled: boolean;
};

export type HomeRowWithItems = HomeRow & { items: UserStream[] };

type DbHomeRow = {
  id: string;
  title: string;
  kind: string;
  mode: string;
  display: string;
  rule: HomeRowRule | null;
  max_items: number;
  position: number;
  enabled: boolean;
};

function toHomeRow(r: DbHomeRow): HomeRow {
  return {
    id: r.id,
    title: r.title,
    kind: r.kind === "hero" ? "hero" : "row",
    mode: r.mode === "manual" ? "manual" : "rule",
    display: r.display === "channel" ? "channel" : "poster",
    rule: (r.rule ?? {}) as HomeRowRule,
    maxItems: r.max_items,
    position: r.position,
    enabled: r.enabled,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

async function resolveRowItems(db: Db, row: HomeRow, includeInactive = false): Promise<UserStream[]> {
  if (row.mode === "manual") {
    const { data: links } = await db
      .from("home_row_items")
      .select("stream_id,position")
      .eq("row_id", row.id)
      .order("position", { ascending: true });
    const ids: string[] = (links ?? []).map((l: { stream_id: string }) => l.stream_id);
    if (ids.length === 0) return [];
    let q = db.from("user_streams").select(SELECT_COLS).in("id", ids).is("deleted_at", null);
    if (!includeInactive) q = q.eq("is_active", true);
    const { data } = await q;
    const byId = new Map<string, Row>((data ?? []).map((r: Row) => [r.id, r]));
    return ids.map((id) => byId.get(id)).filter(Boolean).map((r) => rowToStream(r as Row));
  }
  const rule = row.rule || {};
  let q = db.from("user_streams").select(SELECT_COLS).is("deleted_at", null).eq("is_active", true);
  if (rule.category) q = q.eq("category", rule.category);
  if (rule.sub_category) q = q.eq("sub_category", rule.sub_category);
  if (rule.country) q = q.eq("country", rule.country);
  if (typeof rule.is_foreign === "boolean") q = q.eq("is_foreign", rule.is_foreign);
  if (rule.search) q = q.ilike("title", `%${rule.search.replace(/[%_]/g, "")}%`);
  q =
    rule.sort === "title"
      ? q.order("title", { ascending: true })
      : q.order("sort_order", { ascending: true }).order("created_at", { ascending: false });
  const { data } = await q.limit(Math.min(Math.max(row.maxItems, 1) * 2, 300));
  const snippetRe = /fragman|trailer|teaser|\bkesit\b|\bklip\b/i;
  const filtered = (data ?? [])
    .filter((r: Row) => !snippetRe.test(r.title))
    .slice(0, Math.min(Math.max(row.maxItems, 1), 200));
  return filtered.map((r: Row) => rowToStream(r));
}

/* ------------------------------------------------------------------ */
/* Public: home page                                                   */
/* ------------------------------------------------------------------ */

export const getHomeLayout = createServerFn({ method: "GET" }).handler(
  async (): Promise<HomeRowWithItems[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadStore } = await import("@/db/native-db");
    const db = supabaseAdmin as Db;
    const store = loadStore();

    const { data, error } = await db
      .from("home_rows")
      .select("*")
      .eq("enabled", true)
      .order("position", { ascending: true });
    if (error) return [];
    const rows = (data ?? []).map((r: DbHomeRow) => toHomeRow(r)) as HomeRow[];
    let resolved = await Promise.all(
      rows.map(async (row) => ({ ...row, items: await resolveRowItems(db, row) })),
    );

    // Dynamic UI Tuning (Kendi Kendine Arayüz Optimizasyonu):
    // Analyze user interaction weights from watch_events & category clicks to optimize row sequence
    const events = store.watch_events || [];
    if (events.length > 0) {
      const categoryWeights: Record<string, number> = {};
      const now = Date.now();
      for (const ev of events) {
        const ageH = (now - new Date(ev.created_at || now).getTime()) / 3600_000;
        const decay = Math.max(0.2, 1 - ageH / 72);
        if (ev.category) {
          categoryWeights[ev.category] = (categoryWeights[ev.category] || 0) + decay * 2;
        }
        if (ev.row_title) {
          categoryWeights[ev.row_title] = (categoryWeights[ev.row_title] || 0) + decay * 3;
        }
      }

      resolved = resolved.sort((a, b) => {
        const catA = a.rule?.category || a.title;
        const catB = b.rule?.category || b.title;
        const weightA = (categoryWeights[catA] || 0) + (categoryWeights[a.title] || 0);
        const weightB = (categoryWeights[catB] || 0) + (categoryWeights[b.title] || 0);

        if (weightA !== weightB && (weightA > 2 || weightB > 2)) {
          return weightB - weightA;
        }
        return a.position - b.position;
      });
    }

    return resolved;
  },
);

/* ------------------------------------------------------------------ */
/* Admin: rows                                                         */
/* ------------------------------------------------------------------ */

export const listHomeRowsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HomeRowWithItems[]> => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as Db;
    const { data } = await db.from("home_rows").select("*").order("position", { ascending: true });
    const rows = (data ?? []).map((r: DbHomeRow) => toHomeRow(r)) as HomeRow[];
    return Promise.all(rows.map(async (row) => ({ ...row, items: await resolveRowItems(db, row, true) })));
  });

const ruleSchema = z
  .object({
    category: z.string().max(40).optional(),
    sub_category: z.string().max(60).optional(),
    country: z.string().max(60).optional(),
    is_foreign: z.boolean().optional(),
    search: z.string().max(80).optional(),
    sort: z.enum(["newest", "title"]).optional(),
  })
  .default({});

const rowSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(80),
  kind: z.enum(["row", "hero"]),
  mode: z.enum(["manual", "rule"]),
  display: z.enum(["poster", "channel"]),
  rule: ruleSchema,
  maxItems: z.number().int().min(1).max(200),
  enabled: z.boolean(),
});

export const saveHomeRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => rowSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as Db;
    // Drop empty rule fields so "" never filters anything.
    const rule: Record<string, unknown> = {};
    Object.entries(data.rule).forEach(([k, v]) => {
      if (v !== undefined && v !== "") rule[k] = v;
    });
    const payload = {
      title: data.title,
      kind: data.kind,
      mode: data.mode,
      display: data.display,
      rule,
      max_items: data.maxItems,
      enabled: data.enabled,
    };
    if (data.id) {
      const { error } = await db.from("home_rows").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: last } = await db
      .from("home_rows")
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: row, error } = await db
      .from("home_rows")
      .insert({ ...payload, position: (last?.position ?? -1) + 1 })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteHomeRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as Db).from("home_rows").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderHomeRows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ ids: z.array(z.string().min(1)).max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as Db;
    await Promise.all(data.ids.map((id, i) => db.from("home_rows").update({ position: i }).eq("id", id)));
    return { ok: true };
  });

/** Replaces the manual item list of a row (order = array order). */
export const setHomeRowItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ rowId: z.string().min(1), streamIds: z.array(z.string().min(1)).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as Db;
    const { error: delErr } = await db.from("home_row_items").delete().eq("row_id", data.rowId);
    if (delErr) throw new Error(delErr.message);
    const unique = Array.from(new Set(data.streamIds));
    if (unique.length > 0) {
      const { error } = await db
        .from("home_row_items")
        .insert(unique.map((stream_id, position) => ({ row_id: data.rowId, stream_id, position })));
      if (error) throw new Error(error.message);
    }
    return { ok: true, count: unique.length };
  });

/** Adds streams to the end of a manual row (used from the content manager). */
export const addStreamsToHomeRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ rowId: z.string().min(1), streamIds: z.array(z.string().min(1)).min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as Db;
    const { data: row } = await db.from("home_rows").select("mode").eq("id", data.rowId).maybeSingle();
    if (row?.mode !== "manual") {
      await db.from("home_rows").update({ mode: "manual" }).eq("id", data.rowId);
    }
    const { data: last } = await db
      .from("home_row_items")
      .select("position")
      .eq("row_id", data.rowId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const start = (last?.position ?? -1) + 1;
    const { error } = await db.from("home_row_items").upsert(
      data.streamIds.map((stream_id, i) => ({ row_id: data.rowId, stream_id, position: start + i })),
      { onConflict: "row_id,stream_id", ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Admin: content manager (server-side filtered)                       */
/* ------------------------------------------------------------------ */

const searchSchema = z.object({
  q: z.string().max(80).optional(),
  category: z.string().max(40).optional(),
  country: z.string().max(60).optional(),
  subCategory: z.string().max(60).optional(),
  origin: z.enum(["all", "local", "foreign"]).optional(),
  status: z.enum(["all", "active", "quarantine"]).optional(),
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

export type AdminStream = UserStream & { manualLock: boolean };

export const searchStreamsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => searchSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ items: AdminStream[]; total: number }> => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as Db;
    const limit = data.limit ?? 60;
    const offset = data.offset ?? 0;
    let q = db
      .from("user_streams")
      .select(`${SELECT_COLS},manual_lock`, { count: "exact" })
      .is("deleted_at", null);
    if (data.q) q = q.ilike("title", `%${data.q.replace(/[%_]/g, "")}%`);
    if (data.category) q = q.eq("category", data.category);
    if (data.country === "__none") q = q.is("country", null);
    else if (data.country) q = q.eq("country", data.country);
    if (data.subCategory === "__none") q = q.is("sub_category", null);
    else if (data.subCategory) q = q.eq("sub_category", data.subCategory);
    if (data.origin === "local") q = q.eq("is_foreign", false);
    if (data.origin === "foreign") q = q.eq("is_foreign", true);
    if (data.status === "active") q = q.eq("is_active", true);
    if (data.status === "quarantine") q = q.eq("is_active", false);
    const { data: rows, count, error } = await q
      .order("is_foreign", { ascending: true })
      .order("title", { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(error.message);
    return {
      items: (rows ?? []).map((r: Row & { manual_lock?: boolean }) => ({
        ...rowToStream(r),
        manualLock: Boolean(r.manual_lock),
      })),
      total: count ?? 0,
    };
  });

export const getStreamFacets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ countries: { value: string; n: number }[]; subCategories: { value: string; n: number }[] }> => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as Db).rpc("stream_facets");
    const rows = (data ?? []) as { kind: string; value: string; n: number }[];
    const pick = (kind: string) =>
      rows
        .filter((r) => r.kind === kind && r.value)
        .map((r) => ({ value: r.value, n: Number(r.n) }))
        .sort((a, b) => b.n - a.n);
    return { countries: pick("country"), subCategories: pick("sub_category") };
  });

const editSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  category: z.enum(["Live TV", "Series", "Movies", "Radio"]),
  subCategory: z.string().trim().max(60).optional().or(z.literal("")),
  country: z.string().trim().max(60).optional().or(z.literal("")),
  isForeign: z.boolean(),
  isActive: z.boolean(),
  posterUrl: z.string().trim().max(2000).optional().or(z.literal("")),
  sourceUrl: z.string().trim().url().max(2000),
  seriesTitle: z.string().trim().max(160).optional().or(z.literal("")),
  season: z.number().int().min(0).max(999).nullable().optional(),
  episode: z.number().int().min(0).max(9999).nullable().optional(),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  manualLock: z.boolean().optional(),
});

export const editStreamFull = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => editSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as Db)
      .from("user_streams")
      .update({
        title: data.title,
        category: data.category,
        sub_category: data.subCategory || null,
        country: data.country || null,
        is_foreign: data.isForeign,
        is_active: data.isActive,
        quarantine_reason: data.isActive ? null : undefined,
        poster_url: data.posterUrl || null,
        logo_url: data.posterUrl || null,
        source_url: data.sourceUrl,
        series_title: data.seriesTitle || null,
        season: data.season ?? null,
        episode: data.episode ?? null,
        description: data.description || null,
        manual_lock: data.manualLock ?? true,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const hardDeleteStreams = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ ids: z.array(z.string().min(1)).min(1).max(1000) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as Db;
    // watch_events references user_streams without cascade.
    await db.from("watch_events").delete().in("stream_id", data.ids);
    const { data: rows, error } = await db.from("user_streams").delete().in("id", data.ids).select("id");
    if (error) throw new Error(error.message);
    return { deleted: (rows ?? []).length };
  });

/* ------------------------------------------------------------------ */
/* Admin: app switches                                                 */
/* ------------------------------------------------------------------ */

export type AppSettings = { scraperEnabled: boolean; autoPublish: boolean };

export const getAppSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AppSettings> => {
    await assertAdminRole(context.supabase, context.userId);
    const { readAppSettings } = await import("@/lib/app-settings.server");
    return readAppSettings();
  });

export const setAppSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ scraperEnabled: z.boolean().optional(), autoPublish: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as Db;
    const rows: { key: string; value: boolean }[] = [];
    if (data.scraperEnabled !== undefined) rows.push({ key: "scraper_enabled", value: data.scraperEnabled });
    if (data.autoPublish !== undefined) rows.push({ key: "auto_publish", value: data.autoPublish });
    if (rows.length) {
      const { error } = await db.from("app_settings").upsert(rows, { onConflict: "key" });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
