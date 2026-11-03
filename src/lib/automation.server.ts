// SERVER-ONLY: Görsel otomasyon kuralları motoru.
// Admin panelinde tanımlanan "Eğer X ise → Şu şekilde etiketle" kurallarını
// kazıyıcıdan gelen her satıra uygular.

export type AutomationRule = {
  id: string;
  name: string;
  match_field: "url" | "title" | "group" | "any" | string;
  match_operator: "contains" | "starts_with" | "ends_with" | "equals" | "regex" | string;
  match_value: string;
  set_category: string | null;
  set_sub_category: string | null;
  set_country: string | null;
  set_is_foreign: boolean | null;
  set_is_active: boolean | null;
  priority: number;
  enabled: boolean;
};

export async function loadAutomationRules(): Promise<AutomationRule[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabaseAdmin as any)
    .from("automation_rules")
    .select("*")
    .eq("enabled", true)
    .order("priority", { ascending: false });
  return (data ?? []) as AutomationRule[];
}

export function ruleMatches(rule: AutomationRule, subject: { url: string; title: string; group: string }): boolean {
  const field =
    rule.match_field === "title"
      ? subject.title
      : rule.match_field === "group"
        ? subject.group
        : rule.match_field === "any"
          ? `${subject.url} ${subject.title} ${subject.group}`
          : subject.url;
  const hay = (field || "").toLowerCase();
  const needle = (rule.match_value || "").toLowerCase();
  if (!needle) return false;
  switch (rule.match_operator) {
    case "starts_with":
      return hay.startsWith(needle);
    case "ends_with":
      return hay.endsWith(needle);
    case "equals":
      return hay === needle;
    case "regex":
      try {
        return new RegExp(rule.match_value, "i").test(field || "");
      } catch {
        return false;
      }
    default:
      return hay.includes(needle);
  }
}

/** Kuralları satıra uygular; eşleşen kural id'lerini döner. */
export function applyRules(
  rules: AutomationRule[],
  row: Record<string, unknown>,
): { row: Record<string, unknown>; matched: string[] } {
  const subject = {
    url: String(row["source_url"] ?? ""),
    title: String(row["title"] ?? ""),
    group: String(row["channel_group"] ?? row["sub_category"] ?? ""),
  };
  const matched: string[] = [];
  // Düşük öncelikliden yükseğe uygula ki en yüksek öncelik son sözü söylesin
  for (const rule of [...rules].sort((a, b) => a.priority - b.priority)) {
    if (!ruleMatches(rule, subject)) continue;
    matched.push(rule.id);
    if (rule.set_category) row["category"] = rule.set_category;
    if (rule.set_sub_category) row["sub_category"] = rule.set_sub_category;
    if (rule.set_country) row["country"] = rule.set_country;
    if (rule.set_is_foreign !== null && rule.set_is_foreign !== undefined) row["is_foreign"] = rule.set_is_foreign;
    if (rule.set_is_active !== null && rule.set_is_active !== undefined) {
      row["is_active"] = rule.set_is_active;
      if (rule.set_is_active) row["quarantine_reason"] = null;
    }
  }
  return { row, matched };
}

export async function bumpRuleHits(ids: string[]) {
  if (ids.length === 0) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const counts = new Map<string, number>();
  ids.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
  for (const [id, inc] of counts) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabaseAdmin as any)
      .from("automation_rules")
      .select("hit_count")
      .eq("id", id)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any)
      .from("automation_rules")
      .update({ hit_count: (data?.hit_count ?? 0) + inc })
      .eq("id", id);
  }
}
