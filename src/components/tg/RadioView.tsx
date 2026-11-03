import { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { Radio, Play, Pause, Volume2, VolumeX } from "lucide-react";
import { streamToMedia } from "./AdminSources";
import type { Media } from "./data";
import type { UserStream } from "@/lib/streams.functions";

type Props = {
  focusedKey: string | null;
  registerRef: (key: string, el: HTMLElement | null) => void;
  onPick: (m: Media) => void;
  streams: UserStream[];
};

export function RadioView({ focusedKey, registerRef, onPick, streams }: Props) {
  const radios = useMemo(() => streams.filter((s) => s.category === "Radio"), [streams]);
  const [nowPlaying, setNowPlaying] = useState<UserStream | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    const src = nowPlaying?.sourceUrl;
    if (!audio || !src) return;
    let hls: Hls | null = null;
    if (/\.m3u8(?:\?|$)/i.test(src) && Hls.isSupported()) {
      hls = new Hls({ enableWorker: true });
      hls.loadSource(src);
      hls.attachMedia(audio);
    } else {
      audio.src = src;
    }
    audio.play().catch(() => setPaused(true));
    setPaused(false);
    return () => hls?.destroy();
  }, [nowPlaying?.sourceUrl]);

  return (
    <div className="space-y-8 pb-10">
      <div className="rounded-3xl border border-purple-500/30 bg-gradient-to-r from-purple-600/20 via-fuchsia-600/10 to-transparent p-6">
        <div className="flex items-center gap-3">
          <Radio className="h-6 w-6 text-purple-200" />
          <h2 className="text-2xl font-black">Radyo</h2>
          <span className="rounded-full bg-purple-500/40 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
            {radios.length} istasyon
          </span>
        </div>
        <p className="mt-2 text-sm text-white/70">
          M3U yüklediğinde radyo (group-title veya ses URL’si) tespit edilen kaynaklar burada listelenir.
        </p>
      </div>

      {radios.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-white/60">
          Henüz radyo kaynağı yok. Admin sekmesinden bir M3U listesi yükle.
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
          {radios.map((s, i) => {
            const fk = `radio-${i}`;
            const isFocus = focusedKey === fk;
            const isPlaying = nowPlaying?.id === s.id;
            return (
              <button
                key={s.id}
                ref={(el) => registerRef(fk, el)}
                data-focus-key={fk}
                tabIndex={-1}
                onClick={() => {
                  setNowPlaying(s);
                  onPick(streamToMedia(s));
                }}
                className={`group flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 outline-none transition active:scale-95 ${
                  isFocus ? "neon-ring scale-105 bg-purple-600/20" : "hover:bg-white/10"
                } ${isPlaying ? "ring-2 ring-purple-400/60" : ""}`}
              >
                {s.posterUrl ? (
                  <img src={s.posterUrl} alt={s.title} className="h-16 w-16 rounded-full object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-700 text-xl font-black">
                    {s.title.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="line-clamp-2 text-center text-xs font-black text-white">{s.title}</div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                    s.status === "dead"
                      ? "bg-red-600/80 text-white"
                      : s.status === "degraded"
                        ? "bg-amber-500/80 text-black"
                        : "bg-emerald-500/80 text-black"
                  }`}
                >
                  {s.status === "dead" ? "Kapalı" : s.status === "degraded" ? "Zayıf" : "Canlı"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {nowPlaying && (
        <div className="fixed bottom-20 left-1/2 z-30 flex w-[min(540px,calc(100vw-2rem))] -translate-x-1/2 items-center gap-3 rounded-2xl border border-purple-500/40 bg-black/85 px-4 py-3 backdrop-blur-xl shadow-[0_20px_60px_rgba(168,85,247,0.4)] md:bottom-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-600">
            <Radio className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-black text-white">{nowPlaying.title}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-purple-300">
              Radyo · Canlı
            </div>
          </div>
          <button
            onClick={() => {
              const a = audioRef.current;
              if (!a) return;
              if (a.paused) {
                a.play();
                setPaused(false);
              } else {
                a.pause();
                setPaused(true);
              }
            }}
            className="rounded-full bg-white/10 p-2 text-white"
            aria-label={paused ? "Oynat" : "Duraklat"}
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <button
            onClick={() => {
              const a = audioRef.current;
              if (!a) return;
              a.muted = !a.muted;
              setMuted(a.muted);
            }}
            className="rounded-full bg-white/10 p-2 text-white"
            aria-label={muted ? "Sesi aç" : "Sessize al"}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setNowPlaying(null)}
            className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white"
          >
            Durdur
          </button>
          <audio ref={audioRef} hidden />
        </div>
      )}
    </div>
  );
}
