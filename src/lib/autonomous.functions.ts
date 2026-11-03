import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminRole } from "@/lib/admin-auth";

export type SeedRow = {
  id: string;
  url: string;
  hint: string | null;
  force_category: string | null;
  priority: number;
  disabled: boolean;
  last_scanned_at: string | null;
  last_error: string | null;
  success_count: number;
  failure_count: number;
};

export const listScraperSeeds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SeedRow[]> => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabaseAdmin as any)
      .from("scraper_seeds")
      .select("*")
      .is("deleted_at", null)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    return (data || []) as SeedRow[];
  });

export const addScraperSeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      url: z.string().url(),
      hint: z.string().max(200).optional(),
      force_category: z.enum(["Live TV", "Series", "Movies", "Radio"]).optional(),
      priority: z.number().int().min(0).max(100).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("scraper_seeds").insert({
      url: data.url,
      hint: data.hint || null,
      force_category: data.force_category || null,
      priority: data.priority ?? 10,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteScraperSeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAudit } = await import("@/lib/audit.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any)
      .from("scraper_seeds")
      .update({ disabled: true, deleted_at: new Date().toISOString(), deleted_by: context.userId })
      .eq("id", data.id);
    await logAudit({
      action: "seed.soft_delete",
      entity: "scraper_seeds",
      entityId: data.id,
      source: "admin",
      actorId: context.userId,
      level: "warn",
      message: "Tohum kaynak geri dönüşüm kutusuna taşındı",
    });
    return { ok: true };
  });

export const toggleScraperSeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid(), disabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("scraper_seeds").update({ disabled: data.disabled }).eq("id", data.id);
    return { ok: true };
  });

export const runAutonomousNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ batchSize: z.number().int().min(1).max(10).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    if (typeof window !== "undefined") {
      try {
        const res = await fetch(`/api/public/cron/autonomous-scan?batch=${data.batchSize ?? 3}`, { method: "POST" });
        if (res.ok) {
          const json = await res.json();
          return json;
        }
      } catch (err) {
        console.warn("[runAutonomousNow] client fetch failed, falling back:", err);
      }
    }
    const { runAutonomousScan } = await import("@/lib/autonomous.server");
    const result = await runAutonomousScan(data.batchSize ?? 3);
    return result;
  });

// Küratörlü kamuya açık Türkiye IPTV kaynakları — kullanıcı hiçbir link girmez.
const PUBLIC_TR_SEEDS: Array<{ url: string; hint: string; force_category?: "Live TV" | "Series" | "Movies" | "Radio"; priority: number }> = [
  { url: "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/tr.m3u", hint: "iptv-org TR canlı", force_category: "Live TV", priority: 95 },
  { url: "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/tr_kablo.m3u", hint: "iptv-org TR Kablo", force_category: "Live TV", priority: 90 },
  { url: "https://iptv-org.github.io/iptv/countries/tr.m3u", hint: "iptv-org TR mirror", force_category: "Live TV", priority: 85 },
  { url: "https://iptv-org.github.io/iptv/languages/tur.m3u", hint: "Türkçe dil filtresi", force_category: "Live TV", priority: 80 },
  { url: "https://iptv-org.github.io/iptv/categories/news.m3u", hint: "Haber kanalları", force_category: "Live TV", priority: 60 },
  { url: "https://iptv-org.github.io/iptv/categories/movies.m3u", hint: "Film kanalları", force_category: "Movies", priority: 60 },
  { url: "https://iptv-org.github.io/iptv/categories/kids.m3u", hint: "Çocuk kanalları", force_category: "Live TV", priority: 55 },
  { url: "https://iptv-org.github.io/iptv/categories/music.m3u", hint: "Müzik kanalları", force_category: "Live TV", priority: 50 },
  { url: "https://iptv-org.github.io/iptv/categories/series.m3u", hint: "Dizi kanalları", force_category: "Series", priority: 70 },
  { url: "https://iptv-org.github.io/iptv/categories/sports.m3u", hint: "Spor kanalları", force_category: "Live TV", priority: 55 },
  { url: "https://de1.api.radio-browser.info/json/stations/bycountrycodeexact/TR?hidebroken=true&order=clickcount&reverse=true&limit=400", hint: "Türk radyoları (Radio Browser)", force_category: "Radio", priority: 88 },
  { url: "https://de1.api.radio-browser.info/json/stations/search?hidebroken=true&order=clickcount&reverse=true&limit=400", hint: "Dünyanın popüler radyoları", force_category: "Radio", priority: 45 },
  { url: "https://iptv-org.github.io/iptv/countries/az.m3u", hint: "Azerbaycan kanalları", force_category: "Live TV", priority: 50 },
  { url: "https://iptv-org.github.io/iptv/countries/de.m3u", hint: "Almanya kanalları", force_category: "Live TV", priority: 50 },
  { url: "https://iptv-org.github.io/iptv/countries/gb.m3u", hint: "İngiltere kanalları", force_category: "Live TV", priority: 50 },
  { url: "https://iptv-org.github.io/iptv/countries/us.m3u", hint: "ABD kanalları", force_category: "Live TV", priority: 50 },
  { url: "https://iptv-org.github.io/iptv/countries/fr.m3u", hint: "Fransa kanalları", force_category: "Live TV", priority: 50 },
  { url: "https://iptv-org.github.io/iptv/countries/it.m3u", hint: "İtalya kanalları", force_category: "Live TV", priority: 50 },
  { url: "https://iptv-org.github.io/iptv/countries/es.m3u", hint: "İspanya kanalları", force_category: "Live TV", priority: 50 },
  { url: "https://iptv-org.github.io/iptv/countries/nl.m3u", hint: "Hollanda kanalları", force_category: "Live TV", priority: 50 },
  { url: "https://iptv-org.github.io/iptv/countries/ru.m3u", hint: "Rusya kanalları", force_category: "Live TV", priority: 50 },
  { url: "https://iptv-org.github.io/iptv/countries/gr.m3u", hint: "Yunanistan kanalları", force_category: "Live TV", priority: 50 },
  { url: "https://iptv-org.github.io/iptv/countries/bg.m3u", hint: "Bulgaristan kanalları", force_category: "Live TV", priority: 50 },
  { url: "https://iptv-org.github.io/iptv/countries/sa.m3u", hint: "Suudi Arabistan kanalları", force_category: "Live TV", priority: 50 },
  { url: "https://iptv-org.github.io/iptv/countries/ae.m3u", hint: "BAE kanalları", force_category: "Live TV", priority: 50 },
  { url: "https://iptv-org.github.io/iptv/countries/eg.m3u", hint: "Mısır kanalları", force_category: "Live TV", priority: 50 },
  { url: "https://iptv-org.github.io/iptv/countries/in.m3u", hint: "Hindistan kanalları", force_category: "Live TV", priority: 50 },
  { url: "https://iptv-org.github.io/iptv/countries/jp.m3u", hint: "Japonya kanalları", force_category: "Live TV", priority: 50 },
  { url: "https://iptv-org.github.io/iptv/countries/kr.m3u", hint: "Güney Kore kanalları", force_category: "Live TV", priority: 50 },
  { url: "https://iptv-org.github.io/iptv/countries/br.m3u", hint: "Brezilya kanalları", force_category: "Live TV", priority: 50 },
  { url: "https://iptv-org.github.io/iptv/countries/ca.m3u", hint: "Kanada kanalları", force_category: "Live TV", priority: 50 },
  { url: "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8", hint: "Free-TV genel", priority: 40 },
];

export const bootstrapPublicSeeds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = PUBLIC_TR_SEEDS.map((s) => ({
      url: s.url,
      hint: s.hint,
      force_category: s.force_category ?? null,
      priority: s.priority,
      disabled: false,
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any)
      .from("scraper_seeds")
      .upsert(rows, { onConflict: "url", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    return { ok: true, added: rows.length };
  });

// Bootstrap + hemen tam tarama — tek tıkla tam otonom.
export const bootstrapAndRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = PUBLIC_TR_SEEDS.map((s) => ({
      url: s.url,
      hint: s.hint,
      force_category: s.force_category ?? null,
      priority: s.priority,
      disabled: false,
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any)
      .from("scraper_seeds")
      .upsert(rows, { onConflict: "url", ignoreDuplicates: true });

    if (typeof window !== "undefined") {
      try {
        const res = await fetch(`/api/public/cron/autonomous-scan?batch=${PUBLIC_TR_SEEDS.length}`, { method: "POST" });
        if (res.ok) {
          const json = await res.json();
          return { bootstrapped: rows.length, ...json };
        }
      } catch (err) {
        console.warn("[bootstrapAndRun] client fetch failed, falling back:", err);
      }
    }
    const { runAutonomousScan } = await import("@/lib/autonomous.server");
    const result = await runAutonomousScan(PUBLIC_TR_SEEDS.length);
    return { bootstrapped: rows.length, ...result };
  });

export type ScanReport = {
  id: string; created_at: string; action: string; level: string | null; message: string | null; meta: Record<string, unknown> | null;
};

/** Son tarama kayıtları: başlangıç/bitiş, her kaynağın sonucu ve hatalar. */
export const listScanReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from("audit_logs")
      .select("id,created_at,action,level,message,meta")
      .like("action", "scraper.%")
      .order("created_at", { ascending: false })
      .limit(150);
    if (error) throw new Error(error.message);
    return (data || []) as ScanReport[];
  });

/** Ölü link temizliği + kopya birleştirme, elle tetikleme. */
export const runCleanupNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { runLinkHealthCheckCore } = await import("@/lib/link-health.server");
    const { runDedupe } = await import("@/lib/self-heal.server");
    const health = await runLinkHealthCheckCore({ limit: 60, olderThanMinutes: 60 });
    const dedupe = await runDedupe();
    return { health, dedupe };
  });
