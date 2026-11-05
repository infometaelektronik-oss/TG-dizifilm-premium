import { useMemo, useState } from "react";
import { streamToMedia } from "./AdminSources";
import type { Media } from "./data";
import type { UserStream } from "@/lib/streams.functions";
import { PosterCard } from "./PosterCard";
import { Film, Sparkles, Star, Clapperboard } from "lucide-react";

type Props = {
  focusedKey: string | null;
  registerRef: (key: string, el: HTMLElement | null) => void;
  onPick: (m: Media) => void;
  streams: UserStream[];
  getEnrichment?: (title: string) => { posterUrl?: string; backdropUrl?: string } | null | undefined;
};

const MOVIE_GENRES = [
  "Tümü",
  "Yerli Sinema",
  "Yeşilçam Klasikleri",
  "Yabancı Sinema",
  "Komedi",
  "Aksiyon",
  "Dram",
  "Bilim Kurgu",
] as const;

export function MovieView({ focusedKey, registerRef, onPick, streams, getEnrichment }: Props) {
  const [selectedGenre, setSelectedGenre] = useState<string>("Tümü");

  // Get strictly movies (category === "Movies")
  // Note: All linear 24/7 TV channels were migrated to Live TV (Sinema Kanalları)
  const movies = useMemo(() => {
    return streams
      .filter((s) => s.category === "Movies")
      .map(streamToMedia);
  }, [streams]);

  const filteredMovies = useMemo(() => {
    if (selectedGenre === "Tümü") return movies;
    const term = selectedGenre.toLowerCase();

    return movies.filter((m) => {
      const hay = [
        m.subCategory || "",
        m.genre || "",
        ...(m.genres || []),
        m.description || "",
      ].join(" ").toLowerCase();

      if (term === "yerli sinema") {
        return hay.includes("yerli") || !m.isForeign;
      }
      if (term === "yeşilçam klasikleri") {
        return hay.includes("yeşilçam") || hay.includes("yesilcam") || (m.year && m.year < 1990);
      }
      if (term === "yabancı sinema") {
        return hay.includes("yabancı") || m.isForeign;
      }
      return hay.includes(term);
    });
  }, [movies, selectedGenre]);

  let cardCounter = 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Başlık ve Tür Seçici */}
      <div className="rounded-3xl border border-amber-500/20 bg-gradient-to-r from-amber-950/30 via-neutral-900/60 to-black/80 p-5 md:p-7 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-900/40">
              <Film className="h-6 w-6 text-black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white md:text-3xl">Filmler</h1>
                <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-black uppercase tracking-wider text-amber-300 border border-amber-500/30">
                  {filteredMovies.length} Sinema Yapımı
                </span>
              </div>
              <p className="mt-1 text-xs text-white/70 md:text-sm">
                En seçkin Türk sineması, Yeşilçam başyapıtları ve dünyaca ünlü sinema filmleri (24 saatlik TV kanalları hariçtir).
              </p>
            </div>
          </div>
        </div>

        {/* Film Kategori Çipleri */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {MOVIE_GENRES.map((g) => {
            const active = selectedGenre === g;
            return (
              <button
                key={g}
                onClick={() => setSelectedGenre(g)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition md:text-sm ${
                  active
                    ? "bg-gradient-to-r from-amber-500 to-orange-600 text-black font-black shadow-lg shadow-amber-900/40 ring-2 ring-white/20 scale-105"
                    : "bg-white/5 text-white/70 hover:bg-white/15 hover:text-white border border-white/10"
                }`}
              >
                {g}
              </button>
            );
          })}
        </div>
      </div>

      {/* Film Kartları Izgarası */}
      {filteredMovies.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-12 text-center text-white/60">
          Bu kategoride henüz film bulunmuyor.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
          {filteredMovies.map((m) => {
            const fk = `movie-card-${cardCounter++}`;
            const en = getEnrichment ? getEnrichment(m.title) : null;
            return (
              <div key={m.id} onClick={() => onPick(m)} className="cursor-pointer">
                <PosterCard
                  media={m}
                  focused={focusedKey === fk}
                  registerRef={(el) => registerRef(fk, el)}
                  focusKey={fk}
                  onPick={onPick}
                  posterOverride={en?.posterUrl}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
