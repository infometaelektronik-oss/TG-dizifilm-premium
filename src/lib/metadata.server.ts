// Auto-metadata enrichment: TMDB when TMDB_API_KEY is set, otherwise
// Lovable AI (year, IMDB rating, cast, plot) + Wikipedia poster fallback.
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type Meta = {
  posterUrl?: string;
  backdropUrl?: string;
  description?: string;
  releaseYear?: number;
  imdbRating?: number;
  cast?: string[];
  tmdbId?: number;
};

async function fromTmdb(title: string, isSeries: boolean, key: string): Promise<Meta | null> {
  const kind = isSeries ? "tv" : "movie";
  const auth: Record<string, string> = key.length > 60 ? { Authorization: `Bearer ${key}` } : {};
  const qk = key.length > 60 ? "" : `&api_key=${key}`;
  const s = await fetch(
    `https://api.themoviedb.org/3/search/${kind}?language=tr-TR&query=${encodeURIComponent(title)}${qk}`,
    { headers: auth },
  );
  if (!s.ok) return null;
  const sj = (await s.json()) as { results?: { id: number }[] };
  const id = sj.results?.[0]?.id;
  if (!id) return null;
  const d = await fetch(
    `https://api.themoviedb.org/3/${kind}/${id}?language=tr-TR&append_to_response=credits${qk}`,
    { headers: auth },
  );
  if (!d.ok) return null;
  const j = (await d.json()) as {
    poster_path?: string;
    backdrop_path?: string;
    overview?: string;
    release_date?: string;
    first_air_date?: string;
    vote_average?: number;
    credits?: { cast?: { name: string }[] };
  };
  const img = (p?: string, size = "w500") => (p ? `https://image.tmdb.org/t/p/${size}${p}` : undefined);
  const date = j.release_date || j.first_air_date;
  return {
    tmdbId: id,
    posterUrl: img(j.poster_path),
    backdropUrl: img(j.backdrop_path, "w1280"),
    description: j.overview || undefined,
    releaseYear: date ? Number(date.slice(0, 4)) : undefined,
    imdbRating: j.vote_average ? Math.round(j.vote_average * 10) / 10 : undefined,
    cast: j.credits?.cast?.slice(0, 8).map((c) => c.name),
  };
}

async function fromWikipedia(title: string): Promise<Meta | null> {
  for (const lang of ["tr", "en"]) {
    try {
      const r = await fetch(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/\s+/g, "_"))}`,
      );
      if (!r.ok) continue;
      const j = (await r.json()) as { type?: string; extract?: string; originalimage?: { source?: string } };
      if (j.type === "disambiguation") continue;
      return { posterUrl: j.originalimage?.source, description: j.extract };
    } catch {
      /* next */
    }
  }
  return null;
}

async function fromAi(titles: { title: string; series: boolean }[]): Promise<Record<string, Meta>> {
  if (titles.length === 0) return {};
  try {
    const { callGemini } = await import("@/lib/gemini.server");
    const text = await callGemini(
      JSON.stringify(titles),
      'Film/dizi bilgi asistanısın. Her başlık için bildiğin gerçek bilgileri ver, bilmiyorsan alanı null bırak. Yalnızca JSON döndür: {"<başlık>":{"year":number|null,"imdb":number|null,"cast":string[],"plot":string|null}}. plot Türkçe, en fazla 2 cümle.'
    );
    if (!text) return {};
    const clean = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
    const parsed = JSON.parse(clean) as Record<string, { year?: number; imdb?: number; cast?: string[]; plot?: string }>;
    const out: Record<string, Meta> = {};
    for (const [k, v] of Object.entries(parsed)) {
      out[k] = {
        releaseYear: v.year || undefined,
        imdbRating: v.imdb || undefined,
        cast: Array.isArray(v.cast) ? v.cast.slice(0, 8) : undefined,
        description: v.plot || undefined,
      };
    }
    return out;
  } catch {
    return {};
  }
}

export async function runMetaEnrichment(limit = 20) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const { data: rows } = await db
    .from("user_streams")
    .select("id,title,series_title,category,poster_url,backdrop_url,description")
    .eq("manual_lock", false)
    .in("category", ["Movies", "Series"])
    .is("meta_enriched_at", null)
    .is("deleted_at", null)
    .limit(limit);
  const list = (rows || []) as {
    id: string;
    title: string;
    series_title: string | null;
    category: string;
    poster_url: string | null;
    backdrop_url: string | null;
    description: string | null;
  }[];
  const tmdbKey = process.env.TMDB_API_KEY;
  const lookupTitle = (r: (typeof list)[number]) => r.series_title || r.title;
  const aiMap = tmdbKey ? {} : await fromAi(
    Array.from(new Set(list.map(lookupTitle))).map((t) => ({
      title: t,
      series: list.find((r) => lookupTitle(r) === t)?.category === "Series",
    })),
  );
  let updated = 0;
  for (const r of list) {
    const t = lookupTitle(r);
    let meta: Meta | null = null;
    try {
      meta = tmdbKey ? await fromTmdb(t, r.category === "Series", tmdbKey) : null;
    } catch {
      meta = null;
    }
    if (!meta) {
      const wiki = await fromWikipedia(t);
      meta = { ...(wiki || {}), ...(aiMap[t] || {}) };
      if (wiki?.description && !aiMap[t]?.description) meta.description = wiki.description;
    }
    const patch: Record<string, unknown> = { meta_enriched_at: new Date().toISOString() };
    if (meta.posterUrl && !r.poster_url) patch.poster_url = meta.posterUrl;
    if ((meta.backdropUrl || meta.posterUrl) && !r.backdrop_url) patch.backdrop_url = meta.backdropUrl || meta.posterUrl;
    if (meta.description && (!r.description || r.description.length < 30)) patch.description = meta.description.slice(0, 400);
    if (meta.releaseYear) patch.release_year = meta.releaseYear;
    if (meta.imdbRating) patch.imdb_rating = meta.imdbRating;
    if (meta.cast?.length) patch.cast_list = meta.cast;
    if (meta.tmdbId) patch.tmdb_id = meta.tmdbId;
    const { error } = await db.from("user_streams").update(patch).eq("id", r.id);
    if (!error && Object.keys(patch).length > 1) updated++;
  }
  return { scanned: list.length, updated, source: tmdbKey ? "TMDB" : "AI + Wikipedia" };
}
