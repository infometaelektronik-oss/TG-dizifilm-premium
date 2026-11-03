import { supabaseAdmin } from "@/integrations/supabase/client.server";

type XmltvProgramme = {
  channelId: string;
  title: string;
  description: string | null;
  category: string | null;
  posterUrl: string | null;
  startAt: string;
  endAt: string;
  raw: Record<string, string | null>;
};

const ISTANBUL_TZ = "Europe/Istanbul";

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function tag(block: string, name: string) {
  const match = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i").exec(block);
  return match ? decodeXml(match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")) : null;
}

function attr(block: string, name: string) {
  return new RegExp(`${name}=["']([^"']+)["']`, "i").exec(block)?.[1] ?? null;
}

function parseXmltvTime(raw: string, fallbackTimezone = "+0300") {
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?/);
  if (!match) throw new Error(`Geçersiz XMLTV zamanı: ${raw}`);
  const [, y, mo, d, h, mi, s, zone] = match;
  const z = zone || fallbackTimezone;
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}${z.slice(0, 3)}:${z.slice(3)}`).toISOString();
}

function parseChannelNames(xml: string) {
  const channels = new Map<string, string>();
  for (const match of xml.matchAll(/<channel\b([^>]*)>([\s\S]*?)<\/channel>/gi)) {
    const id = attr(match[1], "id");
    const name = tag(match[2], "display-name");
    if (id && name) channels.set(id, name);
  }
  return channels;
}

function parseProgrammes(xml: string): XmltvProgramme[] {
  const channelNames = parseChannelNames(xml);
  const items: XmltvProgramme[] = [];
  for (const match of xml.matchAll(/<programme\b([^>]*)>([\s\S]*?)<\/programme>/gi)) {
    const attrs = match[1];
    const body = match[2];
    const channelId = attr(attrs, "channel");
    const start = attr(attrs, "start");
    const stop = attr(attrs, "stop");
    const title = tag(body, "title");
    if (!channelId || !start || !stop || !title) continue;
    const icon = /<icon[^>]+src=["']([^"']+)["']/i.exec(body)?.[1] ?? null;
    items.push({
      channelId,
      title,
      description: tag(body, "desc"),
      category: tag(body, "category"),
      posterUrl: icon,
      startAt: parseXmltvTime(start),
      endAt: parseXmltvTime(stop),
      raw: { channelName: channelNames.get(channelId) ?? null },
    });
  }
  return items;
}

function normalize(value?: string | null) {
  return (value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function mapStreamId(programme: XmltvProgramme, source: { channel_name: string | null; stream_title_match: string | null }) {
  const needle = normalize(source.stream_title_match || source.channel_name || programme.raw.channelName || programme.channelId);
  if (!needle) return null;
  const { data } = await supabaseAdmin
    .from("user_streams")
    .select("id,title,channel_group")
    .eq("is_active", true)
    .eq("category", "Live TV")
    .limit(500);
  const hit = (data || []).find((row) => normalize(`${row.title} ${row.channel_group || ""}`).includes(needle));
  return hit?.id ?? null;
}

export async function syncXmltvSources(limit = 5) {
  const { data: sources, error } = await supabaseAdmin
    .from("epg_sources")
    .select("id,name,url,channel_id,channel_name,stream_title_match,timezone")
    .eq("disabled", false)
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  let imported = 0;
  let failed = 0;
  for (const source of sources || []) {
    try {
      const res = await fetch(source.url, { headers: { "User-Agent": "TGTV-EPG/1.0" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      const programmes = parseProgrammes(xml)
        .filter((p) => !source.channel_id || p.channelId === source.channel_id)
        .filter((p) => new Date(p.endAt).getTime() > Date.now() - 6 * 3600_000)
        .slice(0, 1200);

      const rows: any[] = [];
      for (const programme of programmes) {
        rows.push({
          source_id: source.id,
          channel_id: programme.channelId,
          channel_name: source.channel_name || programme.raw.channelName,
          stream_id: await mapStreamId(programme, source),
          title: programme.title,
          description: programme.description,
          category: programme.category,
          poster_url: programme.posterUrl,
          start_at: programme.startAt,
          end_at: programme.endAt,
          timezone: source.timezone || ISTANBUL_TZ,
          raw: programme.raw,
        });
      }
      for (let i = 0; i < rows.length; i += 300) {
        const { error: upsertError } = await (supabaseAdmin as any)
          .from("epg_programmes")
          .upsert(rows.slice(i, i + 300), { onConflict: "source_id,channel_id,start_at,title" });
        if (upsertError) throw new Error(upsertError.message);
      }
      imported += rows.length;
      await supabaseAdmin.from("epg_sources").update({ last_synced_at: new Date().toISOString(), last_error: null }).eq("id", source.id);
    } catch (err) {
      failed++;
      await supabaseAdmin
        .from("epg_sources")
        .update({ last_synced_at: new Date().toISOString(), last_error: err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300) })
        .eq("id", source.id);
    }
  }
  return { sources: (sources || []).length, imported, failed, timezone: ISTANBUL_TZ };
}
