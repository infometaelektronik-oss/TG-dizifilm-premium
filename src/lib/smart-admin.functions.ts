import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminRole } from "@/lib/admin-auth";

/* 1. AI İsim Temizleme ve Logolama */
export const runAiNormalizer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ limit: z.number().int().min(1).max(80).default(40) }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { runNormalizer } = await import("@/lib/normalizer.server");
    return runNormalizer(data.limit);
  });

/* 2. Kendi Kendini Onaran Yayın Altyapısı */
export const runSelfHealing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { runSelfHeal } = await import("@/lib/self-heal.server");
    return runSelfHeal();
  });

/* 4. Mükerrer İçerik Birleştirici */
export const runDeduplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { runDedupe } = await import("@/lib/self-heal.server");
    return runDedupe();
  });

/* 6. Kalite metrikleri + otomatik filtreleme */
export const runQualityScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        limit: z.number().int().min(1).max(120).default(40),
        minHeight: z.number().int().min(0).max(2160).default(480),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { runQualitySweep } = await import("@/lib/quality.server");
    return runQualitySweep(data.limit, data.minHeight);
  });

export type WallItem = {
  id: string;
  title: string;
  source_url: string;
  category: string;
  is_active: boolean;
  quality_label: string | null;
  video_height: number | null;
  bitrate_kbps: number | null;
  fps: number | null;
  backup_count: number;
};

/* 3. Çoklu izleme duvarı verisi */
export const listWallStreams = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        onlyQuarantine: z.boolean().default(true),
        limit: z.number().int().min(1).max(36).default(9),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<WallItem[]> => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabaseAdmin as any)
      .from("user_streams")
      .select("id,title,source_url,category,is_active,quality_label,video_height,bitrate_kbps,fps,backup_urls")
      .is("deleted_at", null)
      .is("duplicate_of", null)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.onlyQuarantine) query = query.eq("is_active", false);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (rows || []).map((r: any) => ({
      id: r.id,
      title: r.title,
      source_url: r.source_url,
      category: r.category,
      is_active: r.is_active,
      quality_label: r.quality_label,
      video_height: r.video_height,
      bitrate_kbps: r.bitrate_kbps,
      fps: r.fps,
      backup_count: Array.isArray(r.backup_urls) ? r.backup_urls.length : 0,
    }));
  });

export const setWallStreamState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().min(1), action: z.enum(["approve", "reject", "unquarantine", "delete"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAudit } = await import("@/lib/audit.server");
    
    if (data.action === "delete") {
      // Hard delete from user_streams
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabaseAdmin as any).from("user_streams").delete().eq("id", data.id);
      if (error) throw new Error(error.message);
      await logAudit({
        action: "quarantine.delete",
        source: "admin",
        level: "error",
        entity: "user_streams",
        entityId: data.id,
        actorId: context.userId,
        message: "Karantinadaki içerik kalıcı olarak silindi",
      });
      return { ok: true };
    }

    const patch =
      data.action === "approve" || data.action === "unquarantine"
        ? { is_active: true, quarantine_reason: null, status: "active", failure_count: 0, promoted_at: new Date().toISOString() }
        : { is_active: false, deleted_at: new Date().toISOString(), deleted_by: context.userId };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any).from("user_streams").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit({
      action: data.action === "approve" || data.action === "unquarantine" ? "quarantine.approve" : "quarantine.reject",
      source: "admin",
      level: data.action === "approve" || data.action === "unquarantine" ? "success" : "warn",
      entity: "user_streams",
      entityId: data.id,
      actorId: context.userId,
      message: data.action === "approve" || data.action === "unquarantine" ? "Karantinadan onaylanıp yayına alındı" : "Karantinadan çöp kutusuna atıldı",
    });
    return { ok: true };
  });

/* 5. Canlı görsel düzen editörü */
export type LayoutSection = {
  id: string;
  key: string;
  title: string;
  kind: string;
  position: number;
  enabled: boolean;
};

export const listLayoutSections = createServerFn({ method: "GET" }).handler(async (): Promise<LayoutSection[]> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from("layout_sections")
    .select("id,key,title,kind,position,enabled")
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as LayoutSection[];
});

export const saveLayoutSections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        sections: z
          .array(z.object({ id: z.string().min(1), position: z.number().int().min(0), enabled: z.boolean(), title: z.string().min(1).max(80) }))
          .max(40),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const s of data.sections) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin as any)
        .from("layout_sections")
        .update({ position: s.position, enabled: s.enabled, title: s.title })
        .eq("id", s.id);
    }
    return { ok: true, saved: data.sections.length };
  });

/* 7. TMDB / AI otomatik meta-veri zenginleştirme */
export const runMetadataEnrichment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { runMetaEnrichment } = await import("@/lib/metadata.server");
    return runMetaEnrichment(20);
  });
