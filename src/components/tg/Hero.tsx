import { Play, Info, Volume2, VolumeX, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Media } from "./data";
import { isRecentlyPublished } from "./v2-helpers";

type Props = {
  media: Media;
  focused: boolean;
  registerRef: (el: HTMLElement | null) => void;
  focusKey: string;
  onPlay?: () => void;
  backdropOverride?: string;
  airDate?: string;
  network?: string;
};

export function Hero({
  media,
  focused,
  registerRef,
  focusKey,
  onPlay,
  backdropOverride,
  airDate,
  network,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [ready, setReady] = useState(false);

  // Autoplay preview after a short delay, simulating Netflix-style hover preview.
  useEffect(() => {
    setReady(false);
    const t = setTimeout(() => setReady(true), 1200);
    return () => clearTimeout(t);
  }, [media.id]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
    if (ready) v.play().catch(() => {});
  }, [ready, muted]);

  return (
    <div className="relative mb-6 h-[320px] overflow-hidden rounded-2xl ring-1 ring-white/5 sm:h-[380px] md:mb-8 md:h-[460px] md:rounded-3xl">
      <img
        src={backdropOverride || media.backdrop}
        alt={media.title}
        onError={(e) => {
          const t = e.currentTarget;
          if (backdropOverride && t.src !== media.backdrop) t.src = media.backdrop;
        }}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
          ready ? "opacity-0" : "opacity-100"
        }`}
      />
      {media.trailer && (
        <video
          ref={videoRef}
          src={media.trailer}
          autoPlay
          loop
          playsInline
          muted={muted}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            ready ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-transparent" />

      {/* Mute toggle for preview */}
      <button
        tabIndex={-1}
        onClick={() => setMuted((m) => !m)}
        className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur transition hover:bg-black/70 md:right-6 md:top-6 md:h-11 md:w-11"
      >
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>

      <div className="relative z-10 flex h-full max-w-2xl flex-col justify-end p-5 md:p-10">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-purple-400/40 bg-purple-500/10 px-3 py-1 backdrop-blur">
            <span className="h-2 w-2 animate-pulse rounded-full bg-purple-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-purple-200 md:text-xs">
              Öne Çıkan · {network ? `${network}` : "Ön İzleme"}
            </span>
          </div>
          {isRecentlyPublished(media.publishedAt) && (
            <span className="badge-new-pulse inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white md:text-xs">
              <Zap className="h-3 w-3" /> Yeni Bölüm Yayında!
            </span>
          )}
        </div>
        <h1 className="mb-2 text-3xl font-black leading-none text-white drop-shadow-2xl sm:text-4xl md:mb-3 md:text-6xl">
          {media.title}
        </h1>
        <p className="mb-2 text-xs font-semibold text-white/70 md:text-sm">
          {media.year} · {media.genre} · ⭐ {media.rating}
          {airDate && <span className="ml-2 text-purple-300">· Yayın: {airDate}</span>}
        </p>
        <p className="mb-4 line-clamp-2 max-w-xl text-sm text-white/80 md:mb-6 md:text-base">
          {media.description}
        </p>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <button
            ref={registerRef}
            data-focus-key={focusKey}
            tabIndex={-1}
            onClick={onPlay}
            className={`flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-black outline-none transition-all duration-200 active:scale-95 md:gap-3 md:px-7 md:py-4 md:text-base ${
              focused ? "neon-ring scale-105 bg-purple-500 text-white" : ""
            }`}
          >
            <Play className="h-5 w-5 fill-current" /> Hemen İzle
          </button>
          <button
            tabIndex={-1}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20 active:scale-95 md:gap-3 md:px-7 md:py-4 md:text-base"
          >
            <Info className="h-5 w-5" /> Detaylar
          </button>
        </div>
      </div>
    </div>
  );
}
