import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {
  Play,
  Pause,
  X,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Maximize2,
  Settings2,
  Check,
  Sparkles,
  AudioWaveform,
  Languages,
  Volume1,
} from "lucide-react";
import type { Media } from "./data";
import { proxiedStreamUrl } from "./v2-helpers";
import { useServerFn } from "@tanstack/react-start";
import { recordView } from "@/lib/engagement.functions";
import { FavoriteButton } from "./FavoriteButton";

type Props = {
  media: Media;
  onClose: () => void;
  playlist?: Media[];
  onAutoNext?: (media: Media) => void;
};

const RESOLUTIONS = [
  { id: "auto", label: "Otomatik", note: "Bağlantıya göre" },
  { id: "2160", label: "4K Ultra HD", note: "2160p · HDR" },
  { id: "1080", label: "Full HD", note: "1080p" },
  { id: "720", label: "HD", note: "720p" },
  { id: "480", label: "SD", note: "480p" },
] as const;

export function VideoPlayer({ media, onClose, playlist = [], onAutoNext }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const filtersRef = useRef<{ bass: BiquadFilterNode; dialog: BiquadFilterNode } | null>(null);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [resolution, setResolution] = useState<string>("auto");
  const [showRes, setShowRes] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);
  const [remaster, setRemaster] = useState(true);
  const [smartAudio, setSmartAudio] = useState(true);
  const [audioMode, setAudioMode] = useState("Sahne");
  const [isFs, setIsFs] = useState(false);
  const [volume, setVolume] = useState(1);
  const hlsRef = useRef<Hls | null>(null);
  const [audioTracks, setAudioTracks] = useState<{ id: number; label: string }[]>([]);
  const [subTracks, setSubTracks] = useState<{ id: number; label: string }[]>([]);
  const [activeAudio, setActiveAudio] = useState<number>(-1);
  const [activeSub, setActiveSub] = useState<number>(-1);
  const [showLang, setShowLang] = useState(false);
  const [levels, setLevels] = useState<number[]>([]);
  const [currentHeight, setCurrentHeight] = useState<number | null>(null);
  const [switchNote, setSwitchNote] = useState<string | null>(null);
  const recordViewFn = useServerFn(recordView);
  const closeRef = useRef<HTMLButtonElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pingUI = useCallback(() => {
    setUiVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setUiVisible(false), 3000);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    const v = videoRef.current;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (el?.requestFullscreen) {
        await el.requestFullscreen();
      } else if (v && "webkitEnterFullscreen" in v) {
        (v as unknown as { webkitEnterFullscreen: () => void }).webkitEnterFullscreen();
      }
    } catch {
      /* user gesture / not allowed */
    }
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
    pingUI();
    const t = setTimeout(() => {
      const el = containerRef.current;
      if (el?.requestFullscreen && !document.fullscreenElement) {
        el.requestFullscreen().catch(() => {});
      }
    }, 120);
    const onFsChange = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      clearTimeout(t);
      document.removeEventListener("fullscreenchange", onFsChange);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [pingUI]);

  // Keep UI visible while paused or while the resolution panel is open
  useEffect(() => {
    if (!playing || showRes) {
      setUiVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    } else {
      pingUI();
    }
  }, [playing, showRes, pingUI]);

  // Record a view for the trending algorithm (once per opened stream)
  useEffect(() => {
    if (!media.streamId) return;
    recordViewFn({ data: { streamId: media.streamId } }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.streamId]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let hls: Hls | null = null;
    let disposed = false;
    const resumeAt = { t: 0 };
    // Zero-buffer fallback chain: primary → backups, each tried direct then via proxy.
    const sources = [media.video || "", ...(media.backupUrls || [])].filter(
      (u, i, arr) => u && arr.indexOf(u) === i,
    );
    const attempts: string[] = [];
    for (const raw of sources) {
      const viaProxy = `/api/public/stream-proxy?url=${encodeURIComponent(raw)}${
        media.referer ? `&referer=${encodeURIComponent(media.referer)}` : ""
      }`;
      const first = proxiedStreamUrl(raw, media.referer);
      attempts.push(first);
      if (first !== viaProxy) attempts.push(viaProxy);
    }
    let idx = 0;
    let stallTimer: number | undefined;

    const advance = () => {
      if (disposed) return;
      resumeAt.t = media.isLive ? 0 : v.currentTime || resumeAt.t;
      idx += 1;
      if (idx < attempts.length) {
        if (idx > 0 && attempts[idx] && sources.length > 1) setSwitchNote("Yedek kaynağa geçildi");
        setup();
        return;
      }
      const current = playlist.findIndex((item) => item.video === media.video || item.id === media.id);
      const next = playlist.slice(current + 1).find((item) => item.video && item.video !== media.video);
      if (next) onAutoNext?.(next);
      else onClose();
    };

    const setup = () => {
      const source = attempts[idx];
      if (!source) return advance();
      const isHls = /\.m3u8(?:\?|$)/i.test(decodeURIComponent(source));
      hls?.destroy();
      hls = null;
      if (isHls && Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          capLevelToPlayerSize: true,
          abrEwmaDefaultEstimate: 2_000_000,
          fragLoadingMaxRetry: 3,
          manifestLoadingMaxRetry: 2,
          levelLoadingMaxRetry: 3,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
        });
        hlsRef.current = hls;
        hls.loadSource(source);
        hls.attachMedia(v);
        const readTracks = () => {
          const isTr = (n: string) => /tr|tur|türk|turk|dublaj/i.test(n);
          const audios = (hls?.audioTracks || []).map((t, i) => ({ id: i, label: t.name || t.lang || `Ses ${i + 1}` }));
          const subs = (hls?.subtitleTracks || []).map((t, i) => ({ id: i, label: t.name || t.lang || `Altyazı ${i + 1}` }));
          setAudioTracks(audios);
          setSubTracks(subs);
          const trAudio = audios.find((a) => isTr(a.label));
          if (trAudio && hls) {
            hls.audioTrack = trAudio.id;
            setActiveAudio(trAudio.id);
          } else if (hls) setActiveAudio(hls.audioTrack);
          const trSub = subs.find((a) => isTr(a.label));
          if (trSub && hls) {
            hls.subtitleTrack = trSub.id;
            setActiveSub(trSub.id);
          }
        };
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          readTracks();
          const heights = Array.from(new Set((hls?.levels || []).map((l) => l.height).filter(Boolean))).sort((a, b) => b - a);
          setLevels(heights);
          if (resumeAt.t > 0) v.currentTime = resumeAt.t;
          v.play().catch(() => {});
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, (_e, d) => {
          const h = hls?.levels?.[d.level]?.height;
          if (h) setCurrentHeight(h);
        });
        hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, readTracks);
        hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, readTracks);
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls?.recoverMediaError();
            return;
          }
          advance();
        });
      } else {
        setLevels([]);
        v.src = source;
        if (resumeAt.t > 0) v.addEventListener("loadedmetadata", () => (v.currentTime = resumeAt.t), { once: true });
        v.play().catch(() => {});
      }
    };
    setup();
    const onTime = () => setProgress(v.currentTime);
    const onMeta = () => setDuration(v.duration || 0);
    const onError = () => {
      if (!hls) advance();
    };
    const onStalled = () => {
      window.clearTimeout(stallTimer);
      stallTimer = window.setTimeout(() => {
        if (v.readyState < 2 && !v.paused) advance();
      }, 6000);
    };
    const onPlaying = () => window.clearTimeout(stallTimer);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("error", onError);
    v.addEventListener("stalled", onStalled);
    v.addEventListener("waiting", onStalled);
    v.addEventListener("playing", onPlaying);
    return () => {
      disposed = true;
      window.clearTimeout(stallTimer);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("error", onError);
      v.removeEventListener("stalled", onStalled);
      v.removeEventListener("waiting", onStalled);
      v.removeEventListener("playing", onPlaying);
      hls?.destroy();
      hlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.id, media.video, media.referer, onAutoNext, onClose, playlist]);

  // Apply manual / auto quality selection to hls.js
  useEffect(() => {
    const hls = hlsRef.current;
    if (!hls) return;
    if (resolution === "auto") {
      hls.currentLevel = -1;
      return;
    }
    const target = Number(resolution);
    const i = hls.levels.findIndex((l) => l.height === target);
    if (i >= 0) hls.currentLevel = i;
  }, [resolution]);

  useEffect(() => {
    if (!switchNote) return;
    const t = setTimeout(() => setSwitchNote(null), 2500);
    return () => clearTimeout(t);
  }, [switchNote]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !smartAudio) return;
    let frame = 0;
    const setup = () => {
      try {
        const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const context = audioContextRef.current || new AudioCtx();
        audioContextRef.current = context;
        const analyser = analyserRef.current || context.createAnalyser();
        analyser.fftSize = 512;
        analyserRef.current = analyser;
        if (!sourceRef.current) sourceRef.current = context.createMediaElementSource(v);
        if (!filtersRef.current) {
          const bass = context.createBiquadFilter();
          bass.type = "lowshelf";
          bass.frequency.value = 140;
          const dialog = context.createBiquadFilter();
          dialog.type = "peaking";
          dialog.frequency.value = 2600;
          dialog.Q.value = 1.2;
          sourceRef.current.connect(bass);
          bass.connect(dialog);
          dialog.connect(analyser);
          analyser.connect(context.destination);
          filtersRef.current = { bass, dialog };
        }
        context.resume().catch(() => {});
      } catch {
        setSmartAudio(false);
      }
    };
    const tick = () => {
      const analyser = analyserRef.current;
      const filters = filtersRef.current;
      if (analyser && filters) {
        const bins = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(bins);
        const bassEnergy = bins.slice(1, 8).reduce((a, b) => a + b, 0) / 7;
        const voiceEnergy = bins.slice(18, 52).reduce((a, b) => a + b, 0) / 34;
        filters.bass.gain.setTargetAtTime(bassEnergy > 126 ? -5 : 3, audioContextRef.current!.currentTime, 0.2);
        filters.dialog.gain.setTargetAtTime(voiceEnergy > bassEnergy ? 8 : 2, audioContextRef.current!.currentTime, 0.2);
        setAudioMode(voiceEnergy > bassEnergy ? "Diyalog" : bassEnergy > 126 ? "Gece" : "Sahne");
      }
      frame = window.requestAnimationFrame(tick);
    };
    setup();
    tick();
    return () => window.cancelAnimationFrame(frame);
  }, [smartAudio, media.video]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) v.play().catch(() => {});
    else v.pause();
  }, [playing]);

  useEffect(() => {
    const v = videoRef.current;
    if (v) v.muted = muted;
  }, [muted]);

  useEffect(() => {
    const v = videoRef.current;
    if (v) v.volume = volume;
    if (volume > 0 && muted) setMuted(false);
  }, [volume, muted]);

  const pickAudio = (id: number) => {
    const hls = hlsRef.current;
    if (hls) hls.audioTrack = id;
    setActiveAudio(id);
  };
  const pickSub = (id: number) => {
    const hls = hlsRef.current;
    if (hls) hls.subtitleTrack = id;
    setActiveSub(id);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Backspace") {
        e.preventDefault();
        onClose();
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const v = videoRef.current;
        if (v) v.currentTime = Math.min(v.duration || 0, v.currentTime + 10);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const v = videoRef.current;
        if (v) v.currentTime = Math.max(0, v.currentTime - 10);
      } else if (e.key.toLowerCase() === "m") {
        setMuted((m) => !m);
      } else if (e.key.toLowerCase() === "r") {
        setShowRes((s) => !s);
      } else if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, toggleFullscreen]);

  // Activity wakes the UI; mouse/touch/keys reset the auto-hide timer
  useEffect(() => {
    const wake = () => pingUI();
    window.addEventListener("mousemove", wake);
    window.addEventListener("touchstart", wake, { passive: true });
    window.addEventListener("keydown", wake, true);
    return () => {
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("touchstart", wake);
      window.removeEventListener("keydown", wake, true);
    };
  }, [pingUI]);

  const pct = duration ? (progress / duration) * 100 : 0;
  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };
  const qualityOptions: { id: string; label: string; note: string }[] = [
    { id: "auto", label: "Otomatik", note: currentHeight ? `Bağlantıya göre · şu an ${currentHeight}p` : "Bağlantıya göre" },
    ...(levels.length > 0
      ? levels.map((h) => ({ id: String(h), label: `${h}p`, note: h >= 2160 ? "4K" : h >= 1080 ? "Full HD" : h >= 720 ? "HD" : "SD" }))
      : RESOLUTIONS.filter((r) => r.id !== "auto").map((r) => ({ ...r, note: `${r.note} · kaynak tek kalite` }))),
  ];
  const currentRes = qualityOptions.find((r) => r.id === resolution) ?? qualityOptions[0];


  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col bg-black"
      onMouseMove={pingUI}
      onTouchStart={pingUI}
      style={{ cursor: uiVisible ? "auto" : "none" }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        crossOrigin="anonymous"
        className="absolute inset-0 h-full w-full object-contain transition-[filter] duration-500"
        style={{ background: "transparent", filter: remaster ? "contrast(1.12) saturate(1.18) brightness(1.04)" : undefined }}
        poster={media.backdrop}
      />
      <div className="absolute right-6 top-6 z-30 pointer-events-none opacity-40 mix-blend-screen select-none md:right-10 md:top-10">
        <div className="flex items-center gap-2 rounded-lg bg-black/20 p-2 backdrop-blur-sm border border-white/10">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white font-black text-[10px]">
            TG
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest text-white/80">TG TV HD</div>
        </div>
      </div>
      {/* clear glass — no top/bottom gradient shadow */}

      {/* Top bar */}
      <div
        className={`relative z-10 flex items-start justify-between gap-3 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] transition-opacity duration-500 sm:px-5 md:px-8 md:pt-6 ${uiVisible ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-purple-300 md:text-xs md:tracking-[0.4em]">
            {playing ? "● Yayında" : "❚❚ Duraklatıldı"} · {currentRes.label}
          </div>
          <h2 className="mt-1 truncate text-lg font-black text-white drop-shadow-2xl sm:text-2xl md:mt-2 md:text-4xl">
            {media.title}
          </h2>
          <p className="mt-1 truncate text-[11px] text-white/70 md:mt-2 md:text-sm">
            {media.year} · {media.genre} · ⭐ IMDB {media.rating}
            {currentHeight ? ` · ${currentHeight}p` : ""}
          </p>
          <p className="mt-2 hidden max-w-2xl text-base text-white/80 lg:block">
            {media.description}
          </p>
          {media.cast && media.cast.length > 0 && (
            <p className="mt-1 hidden max-w-2xl truncate text-sm text-white/60 lg:block">
              Oyuncular: {media.cast.slice(0, 6).join(", ")}
            </p>
          )}
          {switchNote && (
            <div className="mt-2 inline-block rounded-full bg-purple-600/40 px-3 py-1 text-xs font-bold text-white">
              {switchNote}
            </div>
          )}
        </div>
        {!media.isLive && (media.seriesTitle || media.genre === "Dizi") && (
          <FavoriteButton seriesKey={media.seriesTitle || media.title} />
        )}
        <button
          ref={closeRef}
          tabIndex={-1}
          onClick={onClose}
          aria-label="Kapat"
          className="neon-soft sticky top-3 z-20 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white outline-none ring-purple-500 backdrop-blur transition focus:scale-110 focus:ring-4 active:scale-95 md:h-12 md:w-12"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Center play indicator — spacer fills available height */}
      <div className="pointer-events-none relative z-10 flex flex-1 items-center justify-center">
        <div
          className={`flex h-20 w-20 items-center justify-center rounded-full bg-purple-600/90 text-white shadow-[0_0_80px_rgba(168,85,247,0.8)] transition-all duration-300 sm:h-28 sm:w-28 ${
            playing ? "scale-0 opacity-0" : "scale-100 opacity-100"
          }`}
        >
          <Play className="h-10 w-10 fill-white sm:h-12 sm:w-12" />
        </div>
      </div>

      {/* Bottom controls — flow container, never overflows */}
      <div
        className={`relative z-10 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 transition-opacity duration-500 sm:px-5 md:px-8 md:pb-6 ${uiVisible ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        {/* Resolution panel — anchored above controls, width-safe */}
        {showRes && (
          <div className="mb-3 ml-auto w-full max-w-xs overflow-hidden rounded-2xl border border-white/10 bg-black/90 p-2 backdrop-blur-xl shadow-[0_20px_60px_rgba(168,85,247,0.4)]">
            <div className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-purple-300">
              Çözünürlük
            </div>
            <div className="max-h-60 overflow-y-auto">
              {qualityOptions.map((r) => {
                const active = r.id === resolution;
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      setResolution(r.id);
                      setShowRes(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition ${
                      active ? "bg-purple-600/30 text-white" : "text-white/80 hover:bg-white/5"
                    }`}
                  >
                    <div>
                      <div className="text-sm font-semibold">{r.label}</div>
                      <div className="text-xs text-white/50">{r.note}</div>
                    </div>
                    {active && <Check className="h-4 w-4 text-purple-300" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mb-3 flex items-center gap-3 text-[10px] font-mono text-white/80 md:text-xs">
          <span className="tabular-nums">{fmt(progress)}</span>
          <div className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/15">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 to-fuchsia-400 shadow-[0_0_20px_rgba(168,85,247,0.8)]"
              style={{ width: `${pct}%` }}
            />
            <div
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_15px_rgba(168,85,247,0.9)]"
              style={{ left: `${pct}%` }}
            />
          </div>
          <span className="tabular-nums">{fmt(duration)}</span>
        </div>

        {/* Single horizontally-scrollable row keeps every button reachable at any width */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide md:gap-3">
          <button
            onClick={() => {
              const v = videoRef.current;
              if (v) v.currentTime = Math.max(0, v.currentTime - 10);
            }}
            aria-label="10 saniye geri"
            className="shrink-0 rounded-full bg-white/10 p-2.5 text-white backdrop-blur transition hover:bg-white/20 active:scale-95 md:p-3"
          >
            <SkipBack className="h-5 w-5" />
          </button>
          <button
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Duraklat" : "Oynat"}
            className="neon-soft shrink-0 rounded-full bg-purple-600 p-3 text-white transition hover:scale-105 active:scale-95 md:p-4"
          >
            {playing ? (
              <Pause className="h-6 w-6 fill-white md:h-7 md:w-7" />
            ) : (
              <Play className="h-6 w-6 fill-white md:h-7 md:w-7" />
            )}
          </button>
          <button
            onClick={() => {
              const v = videoRef.current;
              if (v) v.currentTime = Math.min(v.duration || 0, v.currentTime + 10);
            }}
            aria-label="10 saniye ileri"
            className="shrink-0 rounded-full bg-white/10 p-2.5 text-white backdrop-blur transition hover:bg-white/20 active:scale-95 md:p-3"
          >
            <SkipForward className="h-5 w-5" />
          </button>
          <div className="flex shrink-0 items-center gap-2 rounded-full bg-white/10 px-3 py-2 backdrop-blur">
            <button
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? "Sesi aç" : "Sessize al"}
              className="text-white transition active:scale-95"
            >
              {muted || volume === 0 ? (
                <VolumeX className="h-5 w-5" />
              ) : volume < 0.5 ? (
                <Volume1 className="h-5 w-5" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label="Ses seviyesi"
              className="h-1 w-20 cursor-pointer accent-purple-500 md:w-28"
            />
          </div>

          <div className="relative shrink-0">
            <button
              onClick={() => setShowLang((s) => !s)}
              aria-label="Dublaj ve altyazı"
              className={`flex items-center gap-2 rounded-full px-3 py-2.5 text-xs font-semibold backdrop-blur transition active:scale-95 md:px-4 md:py-3 md:text-sm ${
                showLang ? "bg-purple-600 text-white" : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              <Languages className="h-4 w-4" />
              <span className="hidden sm:inline">Dublaj / Altyazı</span>
            </button>
            {showLang && (
              <div className="absolute bottom-14 left-0 z-20 w-64 rounded-2xl border border-white/15 bg-black/90 p-3 text-white shadow-2xl backdrop-blur">
                <div className="mb-1 text-[11px] font-black uppercase tracking-widest text-purple-300">
                  Ses / Dublaj
                </div>
                {audioTracks.length === 0 ? (
                  <div className="mb-2 text-[11px] text-white/50">
                    Bu yayın tek ses kanalı sunuyor.
                  </div>
                ) : (
                  audioTracks.map((t) => (
                    <button
                      key={`a-${t.id}`}
                      onClick={() => pickAudio(t.id)}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-white/10"
                    >
                      <span className="truncate">{t.label}</span>
                      {activeAudio === t.id && <Check className="h-3.5 w-3.5 text-purple-300" />}
                    </button>
                  ))
                )}
                <div className="mb-1 mt-3 text-[11px] font-black uppercase tracking-widest text-purple-300">
                  Altyazı
                </div>
                <button
                  onClick={() => pickSub(-1)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-white/10"
                >
                  <span>Kapalı</span>
                  {activeSub === -1 && <Check className="h-3.5 w-3.5 text-purple-300" />}
                </button>
                {subTracks.map((t) => (
                  <button
                    key={`s-${t.id}`}
                    onClick={() => pickSub(t.id)}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-white/10"
                  >
                    <span className="truncate">{t.label}</span>
                    {activeSub === t.id && <Check className="h-3.5 w-3.5 text-purple-300" />}
                  </button>
                ))}
                {subTracks.length === 0 && (
                  <div className="text-[11px] text-white/50">Yayında altyazı bulunmuyor.</div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowRes((s) => !s)}
            aria-label="Çözünürlük"
            className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-2.5 text-xs font-semibold backdrop-blur transition active:scale-95 md:px-4 md:py-3 md:text-sm ${
              showRes ? "bg-purple-600 text-white" : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">{currentRes.label}</span>
          </button>

          <button
            onClick={() => setRemaster((value) => !value)}
            aria-label="AI Remaster"
            className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-2.5 text-xs font-semibold backdrop-blur transition active:scale-95 md:px-4 md:py-3 md:text-sm ${
              remaster ? "bg-purple-600 text-white" : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">AI Remaster</span>
          </button>

          <button
            onClick={() => setSmartAudio((value) => !value)}
            aria-label="Akıllı Ses"
            className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-2.5 text-xs font-semibold backdrop-blur transition active:scale-95 md:px-4 md:py-3 md:text-sm ${
              smartAudio ? "bg-purple-600 text-white" : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <AudioWaveform className="h-4 w-4" />
            <span className="hidden sm:inline">{audioMode}</span>
          </button>

          <button
            onClick={toggleFullscreen}
            aria-label={isFs ? "Tam ekrandan çık" : "Tam ekran"}
            title="Tam ekran (F)"
            className={`shrink-0 rounded-full p-2.5 text-white active:scale-95 md:p-3 ${isFs ? "bg-purple-600" : "bg-white/10"}`}
          >
            <Maximize2 className="h-5 w-5" />
          </button>

          {/* Always-visible inline close as a safety net on tiny viewports */}
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="ml-auto shrink-0 rounded-full bg-white/10 p-2.5 text-white active:scale-95 md:p-3"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-2 hidden items-center gap-2 text-[10px] text-white/60 xl:flex">
          <span className="rounded border border-white/20 px-2 py-1">SPACE Oynat</span>
          <span className="rounded border border-white/20 px-2 py-1">← → 10sn</span>
          <span className="rounded border border-white/20 px-2 py-1">R Çözünürlük</span>
          <span className="rounded border border-white/20 px-2 py-1">M Sessiz</span>
          <span className="rounded border border-white/20 px-2 py-1">Auto Fallback Aktif</span>
          <span className="rounded border border-white/20 px-2 py-1">ESC Kapat</span>
        </div>
      </div>
    </div>
  );
}

