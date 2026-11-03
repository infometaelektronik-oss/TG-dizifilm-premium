import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Eye, Play, X } from "lucide-react";
import type { Media } from "./data";
import { proxiedStreamUrl } from "./v2-helpers";

type Props = {
  items: Media[];
  onPlay: (m: Media) => void;
  getPosterOverride?: (title: string) => string | undefined;
  getBackdropOverride?: (title: string) => string | undefined;
};

export function HeroSlider({ items, onPlay, getPosterOverride, getBackdropOverride }: Props) {
  const [idx, setIdx] = useState(0);
  const [preview, setPreview] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (items.length < 2 || preview) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 6000);
    return () => clearInterval(t);
  }, [items.length, preview]);

  // Reset preview when slide changes
  useEffect(() => setPreview(false), [idx]);

  // Attach HLS/native source when preview opens
  useEffect(() => {
    const video = videoRef.current;
    if (!preview || !video) return;
    const m = items[idx];
    const src = m?.video ? proxiedStreamUrl(m.video, m.referer) : undefined;
    if (!src) return;
    let hls: Hls | null = null;
    if (/\.m3u8(\?|$)/i.test(src) && Hls.isSupported()) {
      hls = new Hls({ maxBufferLength: 8, lowLatencyMode: true });
      hls.loadSource(src);
      hls.attachMedia(video);
    } else {
      video.src = src;
    }
    video.muted = true;
    video.play().catch(() => {});
    const stop = setTimeout(() => setPreview(false), 20000);
    return () => {
      clearTimeout(stop);
      if (hls) hls.destroy();
      video.pause();
      video.removeAttribute("src");
    };
  }, [preview, idx, items]);

  if (items.length === 0) {
    return (
      <div className="mb-8 rounded-3xl border border-dashed border-white/10 bg-white/5 p-10 text-center">
        <div className="font-orbitron text-xs uppercase tracking-[0.4em] text-purple-300/70">
          Sistem otomatik tarama yapıyor
        </div>
        <div className="mt-3 text-sm text-white/60">
          Henüz aktif yayın yok. Otonom motor linkleri çekip kategorize ediyor — birkaç dakika içinde içerikler burada görünecek.
        </div>
      </div>
    );
  }

  const m = items[idx];
  const poster = getPosterOverride?.(m.title) || m.poster;
  const backdrop = getBackdropOverride?.(m.title) || m.backdrop;

  return (
    <div className="relative mb-8 overflow-hidden rounded-3xl border border-white/10 bg-black md:mb-10">
      <div className="relative aspect-[16/8] md:aspect-[21/9]">
        {preview ? (
          <>
            <video
              ref={videoRef}
              className="absolute inset-0 h-full w-full bg-black object-cover"
              playsInline
              muted
              autoPlay
            />
            <button
              onClick={() => setPreview(false)}
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur"
              aria-label="Önizlemeyi kapat"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <img
            key={m.id}
            src={backdrop}
            alt={m.title}
            className="absolute inset-0 h-full w-full object-cover opacity-80 transition-opacity duration-1000"
            loading="eager"
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />

        <div className="absolute bottom-6 left-6 right-6 flex items-end gap-6 md:bottom-10 md:left-10">
          {!preview && (
            <img
              src={poster}
              alt=""
              className="hidden h-44 w-32 rounded-xl border border-white/10 object-cover shadow-2xl md:block"
            />
          )}
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-purple-600/20 px-3 py-1 font-orbitron text-[10px] font-semibold uppercase tracking-[0.3em] text-purple-200 ring-1 ring-purple-400/40">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-300" />
              Öne Çıkan
            </div>
            <h2 className="mt-2 text-2xl font-black md:text-4xl">{m.title}</h2>
            <p className="mt-2 line-clamp-2 max-w-xl text-sm text-white/70 md:text-base">
              {m.description}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => onPlay(m)}
                className="inline-flex items-center gap-2 rounded-full bg-purple-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-purple-600/40 transition hover:bg-purple-500"
              >
                <Play className="h-4 w-4 fill-current" /> İzle
              </button>
              {m.video && (
                <button
                  onClick={() => setPreview((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20"
                >
                  <Eye className="h-4 w-4" /> {preview ? "Önizlemeyi Kapat" : "Önizle"}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="absolute bottom-4 right-4 flex gap-1.5">
          {items.slice(0, Math.min(items.length, 8)).map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Slayt ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === idx % Math.min(items.length, 8) ? "w-6 bg-purple-400" : "w-1.5 bg-white/30"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
