// SERVER-ONLY: Sistem günlüğü (audit log) yazıcısı.
export type AuditLevel = "info" | "success" | "warn" | "error";

export type AuditEntry = {
  action: string;
  message: string;
  level?: AuditLevel;
  source?: string;
  entity?: string;
  entityId?: string;
  actorId?: string | null;
  actorLabel?: string | null;
  meta?: Record<string, unknown>;
};

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any).from("audit_logs").insert({
      action: entry.action,
      message: entry.message.slice(0, 1000),
      level: entry.level ?? "info",
      source: entry.source ?? "system",
      entity: entry.entity ?? null,
      entity_id: entry.entityId ?? null,
      actor_id: entry.actorId ?? null,
      actor_label: entry.actorLabel ?? null,
      meta: entry.meta ?? {},
    });
  } catch {
    // Log yazımı asla ana akışı bozmamalı
  }
}

export async function recordMetric(metric: string, value: number, unit?: string, meta?: Record<string, unknown>) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any)
      .from("system_metrics")
      .insert({ metric, value, unit: unit ?? null, meta: meta ?? {} });
  } catch {
    /* yut */
  }
}
