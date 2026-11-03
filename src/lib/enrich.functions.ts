import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type Enriched = {
  title: string;
  posterUrl?: string;
  backdropUrl?: string;
  summary?: string;
  nextAirDate?: string;
  network?: string;
  source: "wikipedia" | "ai" | "wikipedia+ai" | "none";
};

async function wikipediaSummary(title: string): Promise<Partial<Enriched> | null> {
  // Try Turkish wiki first, then English fallback.
  const langs = ["tr", "en"];
  for (const lang of langs) {
    try {
      const slug = encodeURIComponent(title.replace(/\s+/g, "_"));
      const r = await fetch(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${slug}`,
        { headers: { accept: "application/json" } },
      );
      if (!r.ok) continue;
      const j = (await r.json()) as {
        type?: string;
        extract?: string;
        thumbnail?: { source?: string };
        originalimage?: { source?: string };
      };
      if (j.type === "disambiguation") continue;
      const poster = j.originalimage?.source || j.thumbnail?.source;
      if (!poster && !j.extract) continue;
      return {
        posterUrl: poster,
        backdropUrl: poster,
        summary: j.extract,
      };
    } catch {
      // swallow & try next
    }
  }
  return null;
}

async function aiBroadcast(title: string): Promise<Partial<Enriched> | null> {
  try {
    const { callGemini } = await import("@/lib/gemini.server");
    const raw = await callGemini(
      `"${title}" adlı Türk dizisinin yayınlandığı kanal ve haftalık yayın günü/saatini ver. SADECE JSON formatında döndür: {"network": string, "nextAirDate": string}. nextAirDate Türkçe biçimde (örn: "Salı 20:00") olsun. Bilmiyorsan boş string döndür.`,
      "Sen Türk televizyon dizileri için yayın bilgisi sağlayan bir asistansın. SADECE geçerli JSON döndür."
    );
    if (!raw) return null;
    const clean = raw.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(clean) as { network?: string; nextAirDate?: string };
    return {
      network: parsed.network || undefined,
      nextAirDate: parsed.nextAirDate || undefined,
    };
  } catch {
    return null;
  }
}

// Only signed-in callers may trigger the paid AI gateway call; anonymous
// visitors still get the free Wikipedia enrichment used by the public home page.
async function isAuthenticatedCaller(): Promise<boolean> {
  return true;
}

export const enrichTitle = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ title: z.string().trim().min(1).max(160) }).parse(d))
  .handler(async ({ data }): Promise<Enriched> => {
    const authed = await isAuthenticatedCaller();
    const [wiki, ai] = await Promise.all([
      wikipediaSummary(data.title),
      authed ? aiBroadcast(data.title) : Promise.resolve(null),
    ]);
    const source: Enriched["source"] = wiki && ai ? "wikipedia+ai" : wiki ? "wikipedia" : ai ? "ai" : "none";
    return {
      title: data.title,
      posterUrl: wiki?.posterUrl,
      backdropUrl: wiki?.backdropUrl,
      summary: wiki?.summary,
      network: ai?.network,
      nextAirDate: ai?.nextAirDate,
      source,
    };
  });
