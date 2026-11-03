import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { enrichTitle } from "@/lib/enrich.functions";

export type Enrichment = {
  posterUrl?: string;
  backdropUrl?: string;
  summary?: string;
  network?: string;
  nextAirDate?: string;
};

const cache = new Map<string, Enrichment>();

export function useEnrichment(titles: string[]) {
  const fetchFn = useServerFn(enrichTitle);
  const [, force] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const title of titles) {
        if (cache.has(title)) continue;
        try {
          const data = await fetchFn({ data: { title } });
          if (cancelled) return;
          cache.set(title, {
            posterUrl: data.posterUrl,
            backdropUrl: data.backdropUrl,
            summary: data.summary,
            network: data.network,
            nextAirDate: data.nextAirDate,
          });
          force((n) => n + 1);
        } catch {
          cache.set(title, {});
        }
        // gentle pacing so we don't spam the gateway
        await new Promise((r) => setTimeout(r, 80));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titles.join("|")]);

  return (title: string): Enrichment | undefined => cache.get(title);
}
