// SERVER-ONLY: Kendi Kendini Onaran Yayın Altyapısı + Mükerrer İçerik Birleştirici

import { heuristicClean } from "@/lib/normalizer.server";

export function normalizeKey(title: string): string {
  return heuristicClean(title)
    .toLowerCase()
    .replace(/[^a-z0-9çğıöşü]+/g, "")
    .trim();
}

type Row = {
  id: string;
  title: string;
  normalized_title: string | null;
  source_url: string;
  category: string;
  status: string | null;
  is_active: boolean;
  health_score: number | null;
  video_height: number | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  backup_urls: any;
  duplicate_of: string | null;
};

async function loadRows(limit = 4000): Promise<Row[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from("user_streams")
    .select("id,title,normalized_title,source_url,category,status,is_active,health_score,video_height,backup_urls,duplicate_of")
    .eq("manual_lock", false)
    .is("deleted_at", null)
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []) as Row[];
}

export type SelfHealResult = { broken: number; healed: number; noAlternative: number; samples: string[] };

/** Bozuk yayınlara aynı isimli çalışan alternatif kaynağı atar. */
export async function runSelfHeal(): Promise<SelfHealResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { logAudit } = await import("@/lib/audit.server");
  const { probeQuality } = await import("@/lib/quality.server");
  const rows = await loadRows();

  const byKey = new Map<string, Row[]>();
  for (const r of rows) {
    const key = `${r.category}::${(r as { country?: string | null }).country || ""}::${r.normalized_title || normalizeKey(r.title)}`;
    const arr = byKey.get(key) || [];
    arr.push(r);
    byKey.set(key, arr);
  }

  const result: SelfHealResult = { broken: 0, healed: 0, noAlternative: 0, samples: [] };
  const broken = rows.filter((r) => r.status === "dead" || (!r.is_active && (r.health_score ?? 0) === 0));
  for (const row of broken.slice(0, 60)) {
    result.broken++;
    const key = `${row.category}::${row.normalized_title || normalizeKey(row.title)}`;
    const siblings = (byKey.get(key) || []).filter(
      (s) => s.id !== row.id && s.source_url !== row.source_url && s.status !== "dead",
    );
    let healed = false;
    for (const candidate of siblings.slice(0, 4)) {
      const q = await probeQuality(candidate.source_url);
      const alive = q.height !== null || candidate.is_active;
      if (!alive) continue;
      const backups = Array.isArray(row.backup_urls) ? row.backup_urls : [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin as any)
        .from("user_streams")
        .update({
          source_url: candidate.source_url,
          backup_urls: Array.from(new Set([...backups, row.source_url])).slice(0, 8),
          is_active: true,
          status: "active",
          quarantine_reason: null,
          health_score: 80,
          failure_count: 0,
          last_error: null,
        })
        .eq("id", row.id);
      healed = true;
      result.healed++;
      if (result.samples.length < 8) result.samples.push(`${row.title} → alternatif kaynak atandı`);
      break;
    }
    if (!healed) result.noAlternative++;
  }

  await logAudit({
    action: "stream.self_heal",
    source: "system",
    level: result.healed > 0 ? "success" : "warn",
    message: `Kendi kendini onarma · ${result.broken} bozuk yayın · ${result.healed} onarıldı · ${result.noAlternative} alternatif bulunamadı`,
    meta: { ...result },
  });
  return result;
}

export type DedupeResult = { groups: number; merged: number; samples: string[] };

/** Aynı isimli yayınları tek başlık altında yedek kaynak olarak birleştirir. */
export async function runDedupe(): Promise<DedupeResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { logAudit } = await import("@/lib/audit.server");
  const rows = (await loadRows()).filter((r) => !r.duplicate_of);

  const byKey = new Map<string, Row[]>();
  for (const r of rows) {
    const key = `${r.category}::${(r as { country?: string | null }).country || ""}::${r.normalized_title || normalizeKey(r.title)}`;
    if (!key.endsWith("::")) {
      const arr = byKey.get(key) || [];
      arr.push(r);
      byKey.set(key, arr);
    }
  }

  const result: DedupeResult = { groups: 0, merged: 0, samples: [] };
  for (const [, group] of byKey) {
    if (group.length < 2) continue;
    const sorted = [...group].sort(
      (a, b) =>
        Number(b.is_active) - Number(a.is_active) ||
        (b.video_height ?? 0) - (a.video_height ?? 0) ||
        (b.health_score ?? 0) - (a.health_score ?? 0),
    );
    const primary = sorted[0];
    const dupes = sorted.slice(1);
    const backups = Array.isArray(primary.backup_urls) ? primary.backup_urls : [];
    const merged = Array.from(new Set([...backups, ...dupes.map((d) => d.source_url)])).slice(0, 12);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any).from("user_streams").update({ backup_urls: merged }).eq("id", primary.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any)
      .from("user_streams")
      .update({ duplicate_of: primary.id, is_active: false, quarantine_reason: "duplicate_merged" })
      .in("id", dupes.map((d) => d.id));
    result.groups++;
    result.merged += dupes.length;
    if (result.samples.length < 8) result.samples.push(`${primary.title} · ${dupes.length} yedek kaynak`);
  }

  await logAudit({
    action: "stream.dedupe",
    source: "system",
    level: "success",
    message: `Mükerrer birleştirme · ${result.groups} grup · ${result.merged} yedek kaynak bağlandı`,
    meta: { groups: result.groups, merged: result.merged },
  });
  return result;
}
