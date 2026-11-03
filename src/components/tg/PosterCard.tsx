import { Star, Play, Sparkles } from "lucide-react";
import type { Media } from "./data";
import { isRecentlyPublished } from "./v2-helpers";

type Props = {
  media: Media;
  focused: boolean;
  registerRef: (el: HTMLElement | null) => void;
  focusKey: string;
  onPick?: (media: Media) => void;
  posterOverride?: string;
  airDate?: string;
  network?: string;
};

export function PosterCard({
  media,
  focused,
  registerRef,
  focusKey,
  onPick,
  posterOverride,
  airDate,
  network,
}: Props) {
  const isNew = isRecentlyPublished(media.publishedAt);
  return (
    <button
      ref={registerRef}
      data-focus-key={focusKey}
      tabIndex={-1}
      onClick={() => onPick?.(media)}
      className={`group relative aspect-[2/3] w-[130px] shrink-0 overflow-hidden rounded-xl bg-[#121212] outline-none transition-all duration-200 active:scale-95 sm:w-[160px] md:w-[200px] md:rounded-2xl ${
        focused ? "neon-ring z-10 scale-105" : "ring-1 ring-white/5"
      }`}
    >
      <img
        src={posterOverride || media.poster}
        alt={media.title}
        loading="lazy"
        onError={(e) => {
          const t = e.currentTarget;
          if (posterOverride && t.src !== media.poster) t.src = media.poster;
        }}
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

      {isNew && (
        <div className="badge-new-pulse absolute left-2 top-2 z-10 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
          YENİ
        </div>
      )}

      <div className="absolute left-0 right-0 top-0 flex items-center justify-between p-3">
        <span className="flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-xs font-semibold text-yellow-400 backdrop-blur">
          <Star className="h-3 w-3 fill-yellow-400" /> {media.rating}
        </span>
        <div className="flex items-center gap-1">
          {posterOverride && (
            <span
              title="Yapay zeka ile zenginleştirildi"
              className="flex items-center rounded-md bg-purple-600/90 p-1 text-white shadow-[0_0_10px_rgba(168,85,247,0.7)]"
            >
              <Sparkles className="h-3 w-3" />
            </span>
          )}
          <span className="rounded-md bg-purple-600/90 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
            HD
          </span>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-3">
        <h3 className="line-clamp-1 text-sm font-bold text-white">{media.title}</h3>
        <p className="mt-0.5 line-clamp-1 text-[11px] text-white/60">
          {media.season && media.episode
            ? `S${media.season}E${media.episode}`
            : `${media.year} · ${media.genre}`}
        </p>
        {(airDate || network) && (
          <p className="mt-1 line-clamp-1 text-[10px] font-semibold text-purple-300">
            {[network, airDate].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      {focused && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-600 text-white shadow-[0_0_30px_rgba(168,85,247,0.9)]">
            <Play className="h-6 w-6 fill-white" />
          </div>
        </div>
      )}
    </button>
  );
}
