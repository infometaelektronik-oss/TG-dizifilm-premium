// SERVER-ONLY: admin-controlled app switches (scraper on/off, auto publish).
export async function readAppSettings(): Promise<{ scraperEnabled: boolean; autoPublish: boolean }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabaseAdmin as any).from("app_settings").select("key,value");
  const map = new Map<string, unknown>((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
  return {
    scraperEnabled: map.get("scraper_enabled") !== false,
    autoPublish: map.get("auto_publish") === true,
  };
}
