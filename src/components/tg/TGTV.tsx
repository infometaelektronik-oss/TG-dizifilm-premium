import { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, Loader2, Maximize2, Sparkles, Volume2, VolumeX, Wand2 } from "lucide-react";
import { getTGTVCurrent, getTGTVSchedule, generateTGTVSchedule, type TGTVItem } from "@/lib/tg-tv.functions";

type Props = {
  focusedKey: string | null;
  registerRef: (key: string, el: HTMLElement | null) => void;
};

export function TGTVView({ focusedKey, registerRef }: Props) {
  const getCurrent = useServerFn(getTGTVCurrent);
  const getSchedule = useServerFn(getTGTVSchedule);
  const genFn = useServerFn(generateTGTVSchedule);

  const [current, setCurrent] = useState<Awaited<ReturnType<typeof getTGTVCurrent>>>(null);
  const [schedule, setSchedule] = useState<TGTVItem[]>([]);
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
  };

  const refresh = async () => {
    const [c, s] = await Promise.all([getCurrent(), getSchedule()]);
    setCurrent(c);
    setSchedule(s);
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !current) return;
    let hls: Hls | null = null;
    const src = `/api/public/stream-proxy?url=${encodeURIComponent(current.item.streamUrl)}`;
    
    if (/\.m3u8(?:\?|$)/i.test(current.item.streamUrl) && Hls.isSupported()) {
      hls = new Hls({ 
        enableWorker: true, 
        lowLatencyMode: true,
        fragLoadingMaxRetry: 8,
        manifestLoadingMaxRetry: 8,
        levelLoadingMaxRetry: 8,
        maxBufferLength: 30,
        maxMaxBufferLength: 60
      });
      hls.loadSource(src);
      hls.attachMedia(v);
    } else {
      v.src = src;
    }
    
    const onMeta = () => {
      try {
        if (v.duration && Number.isFinite(v.duration) && v.duration > current.offsetSeconds) {
          v.currentTime = current.offsetSeconds;
        }
      } catch {
        /* noop */
      }
      v.play().catch(() => {});
    };
    v.addEventListener("loadedmetadata", onMeta);
    return () => {
      v.removeEventListener("loadedmetadata", onMeta);
      hls?.destroy();
    };
  }, [current?.item.id, current?.offsetSeconds]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onSeek = () => {
      if (!current) return;
      const now = (Date.now() - new Date(current.item.startAt).getTime()) / 1000;
      if (v.currentTime < now - 2) v.currentTime = now;
    };
    v.addEventListener("seeking", onSeek);
    return () => v.removeEventListener("seeking", onSeek);
  }, [current]);

  const generate = async () => {
    setBusy(true);
    try {
      await genFn({ data: { hoursPerItem: 1.5 } });
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Çizelge oluşturulamadı");
    } finally {
      setBusy(false);
    }
  };

  const nowIso = new Date().toISOString();
  const upcoming = useMemo(
    () => schedule.filter((it) => it.endAt >= nowIso).slice(0, 10),
    [schedule, nowIso],
  );

  return (
    <div className="space-y-6 pb-10">
      <div className="rounded-3xl border border-purple-500/30 bg-gradient-to-r from-purple-700/30 via-fuchsia-600/15 to-transparent p-5">
        <div className="flex items-center gap-3">
          <img
            src="/assets/aistudio/Media_item_1_1bba30da.jpg"
            alt="TG TV Logo"
            className="h-12 w-12 rounded-2xl object-cover border border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.6)] shrink-0"
          />
          <div>
            <h2 className="text-2xl font-black">TG TV — Sanal Canlı Yayın</h2>
            <p className="text-xs text-white/60">
              7/24 akış, kesintisiz dizi ve film yayını.
            </p>
          </div>
          <button
            onClick={generate}
            disabled={busy}
            className="ml-auto flex items-center gap-2 rounded-2xl bg-purple-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            AI Akış Oluştur
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div ref={containerRef} className="relative overflow-hidden rounded-3xl border border-white/10 bg-black group">
          {current ? (
            <div className="relative aspect-video w-full">
              <video
                ref={videoRef}
                playsInline
                muted={muted}
                autoPlay
                crossOrigin="anonymous"
                poster={current.item.posterUrl}
                className="h-full w-full object-cover"
                onClick={toggleFullscreen}
              />
              
              {/* Logo Overlay */}
              <div className="absolute right-4 top-4 z-20 pointer-events-none opacity-85 select-none">
                <div className="flex items-center gap-2 rounded-xl bg-black/60 px-2.5 py-1.5 backdrop-blur-md border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.4)]">
                  <img
                    src="/assets/aistudio/Media_item_1_1bba30da.jpg"
                    alt="TG TV Logo"
                    className="h-6 w-6 rounded-lg object-cover"
                  />
                  <div className="text-[10px] font-black uppercase tracking-widest text-purple-200">TG TV HD</div>
                </div>
              </div>

              {/* Controls Overlay */}
              <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 to-transparent p-4 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => setMuted((m) => !m)}
                    className="rounded-full bg-white/10 p-2.5 text-white hover:bg-purple-600 transition active:scale-95"
                  >
                    {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </button>
                  <button
                    onClick={toggleFullscreen}
                    className="rounded-full bg-white/10 p-2.5 text-white hover:bg-purple-600 transition active:scale-95"
                  >
                    <Maximize2 className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="absolute left-4 top-4 pointer-events-none rounded-full bg-red-600/90 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                ● Canlı
              </div>
              <div className="absolute bottom-4 left-4 max-w-md pointer-events-none rounded-2xl bg-black/60 p-3 backdrop-blur border border-white/5">
                <div className="text-xs font-black uppercase tracking-widest text-purple-200">
                  Şu an
                </div>
                <div className="mt-1 text-lg font-black text-white">{current.item.title}</div>
              </div>
            </div>
          ) : (
            <div className="flex aspect-video items-center justify-center p-10 text-center text-sm text-white/60">
              Henüz aktif yayın yok. Yukarıdan <strong className="text-white">AI Akış Oluştur</strong>'a tıkla.
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-purple-200">
            <CalendarClock className="h-4 w-4" /> Yayın Akışı (EPG)
          </div>
          <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1 scrollbar-hide">
            {upcoming.map((it, i) => {
              const fk = `tgtv-${i}`;
              const active = current?.item.id === it.id;
              return (
                <button
                  key={it.id}
                  ref={(el) => registerRef(fk, el)}
                  data-focus-key={fk}
                  tabIndex={-1}
                  className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left outline-none transition ${
                    active
                      ? "border-purple-500 bg-purple-600/20"
                      : focusedKey === fk
                        ? "neon-ring border-purple-400/60"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <div className="w-14 shrink-0 text-xs font-black text-purple-200">
                    {new Date(it.startAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-1 text-sm font-black text-white">{it.title}</div>
                    {it.description && (
                      <div className="line-clamp-2 text-[11px] text-white/55">{it.description}</div>
                    )}
                  </div>
                  {active && (
                    <span className="rounded-full bg-red-600/80 px-2 py-0.5 text-[9px] font-black uppercase text-white">
                      Canlı
                    </span>
                  )}
                </button>
              );
            })}
            {upcoming.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-xs text-white/50">
                Çizelge boş.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
