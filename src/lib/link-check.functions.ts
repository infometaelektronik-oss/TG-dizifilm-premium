import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminRole } from "@/lib/admin-auth";

export const runLinkHealthCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        limit: z.number().int().min(1).max(5000).optional().default(5000),
        olderThanMinutes: z.number().int().min(0).max(1440).optional().default(50),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { runLinkHealthCheckCore } = await import("@/lib/link-health.server");
    return runLinkHealthCheckCore({ ...data, includeDetails: true });
  });

// Sistem durumu — anon erişimli, hafif ve sayfa açılışında kullanıcıya gösterilir
export const getSystemStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabaseAdmin as any).rpc("get_system_status");
  const d = (data || {}) as { active_count?: number; quarantine_count?: number; last_check_at?: string | null };
  return {
    activeCount: d.active_count ?? 0,
    quarantineCount: d.quarantine_count ?? 0,
    lastCheckAt: d.last_check_at ?? null,
  };
});

export const getHealthSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { getHealthSummaryCore } = await import("@/lib/link-health.server");
    return getHealthSummaryCore();
  });

// Admin-only: hard-delete dead movie links (failure_count >= 3 or status=dead)
export const cleanupDeadMovies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminRole(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("user_streams")
      .delete()
      .eq("category", "Movies")
      .or("status.eq.dead,failure_count.gte.3")
      .select("id");
    if (error) throw new Error(error.message);
    return { deleted: (data || []).length };
  });

