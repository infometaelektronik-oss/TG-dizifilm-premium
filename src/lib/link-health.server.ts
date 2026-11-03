// SERVER-ONLY link health implementation. Kept outside *.functions.ts so
// TanStack server-function splitting cannot remove helper references.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { validatePublicHttpUrl } from "@/lib/url-security.server";

export type ProbeResult = {
  ok: boolean;
  statusCode?: number;
  error?: string;
};

export type LinkHealthSummary = {
  checkedCount: number;
  activeCount: number;
  degradedCount: number;
  deadCount: number;
  promotedCount: number;
  details?: {
    id: string;
    url: string;
    ok: boolean;
    statusCode?: number;
    error?: string;
    status: "active" | "degraded" | "dead";
    failureCount: number;
    promoted: boolean;
  }[];
};

const PROBE_TIMEOUT_MS = 8000;

async function probeUrl(url: string): Promise<ProbeResult> {
  try {
    validatePublicHttpUrl(url);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "URL engellendi" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    let response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "VLC/3.0.18 LibVLC/3.0.18" },
    });
    if (response.status >= 400) {
      response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        redirect: "follow",
        headers: { Range: "bytes=0-1024", "User-Agent": "VLC/3.0.18 LibVLC/3.0.18" },
      });
    }
    clearTimeout(timer);
    return { ok: response.status < 400, statusCode: response.status };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, error: err instanceof Error ? err.message : "fetch failed" };
  }
}

export async function runLinkHealthCheckCore(input: { limit: number; olderThanMinutes: number; includeDetails?: boolean }): Promise<LinkHealthSummary> {
  const threshold = new Date(Date.now() - input.olderThanMinutes * 60_000).toISOString();
  const { data: rows, error } = await supabaseAdmin
    .from("user_streams")
    .select("id,source_url,failure_count,status,last_checked_at,is_active")
    .or(`last_checked_at.is.null,last_checked_at.lt.${threshold}`)
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(input.limit);

  if (error) throw new Error(error.message);

  const checked: NonNullable<LinkHealthSummary["details"]> = [];
  const concurrency = 12;
  const queue = [...(rows || [])];
  const workers = Array.from({ length: concurrency }).map(async () => {
    while (queue.length) {
      const row = queue.shift();
      if (!row) break;
      const probe = await probeUrl(row.source_url);
      const failureCount = probe.ok ? 0 : (row.failure_count || 0) + 1;
      const status: "active" | "degraded" | "dead" = probe.ok ? "active" : "dead";

      const update: Record<string, unknown> = {
        status,
        failure_count: failureCount,
        last_checked_at: new Date().toISOString(),
        last_error: probe.ok ? null : probe.error || `HTTP ${probe.statusCode || "?"}`,
        last_status_code: probe.statusCode || null,
        health_score: probe.ok ? 100 : Math.max(0, 100 - failureCount * 30),
      };
      let promoted = false;
      if (probe.ok && !row.is_active) {
        update.is_active = true;
        update.quarantine_reason = null;
        update.promoted_at = new Date().toISOString();
        promoted = true;
      }
      if (!probe.ok) {
        update.is_active = false;
        update.quarantine_reason = "link_health_failed";
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin as any).from("user_streams").update(update).eq("id", row.id);
      checked.push({
        id: row.id,
        url: row.source_url,
        ok: probe.ok,
        statusCode: probe.statusCode,
        error: probe.error,
        status,
        failureCount,
        promoted,
      });
    }
  });
  await Promise.all(workers);

  return {
    checkedCount: checked.length,
    activeCount: checked.filter((c) => c.status === "active").length,
    degradedCount: checked.filter((c) => c.status === "degraded").length,
    deadCount: checked.filter((c) => c.status === "dead").length,
    promotedCount: checked.filter((c) => c.promoted).length,
    ...(input.includeDetails ? { details: checked } : {}),
  };
}

export async function getHealthSummaryCore() {
  const { data, error } = await supabaseAdmin
    .from("user_streams")
    .select("status,category")
    .eq("is_active", true);
  if (error) throw new Error(error.message);
  const summary = { active: 0, degraded: 0, dead: 0, unknown: 0, total: 0 };
  for (const row of data || []) {
    summary.total++;
    const key = (row.status as keyof typeof summary) || "unknown";
    if (key in summary) summary[key]++;
  }
  return summary;
}
