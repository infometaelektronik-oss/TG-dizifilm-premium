import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Grid2X2, Grid3X3, Loader2, RefreshCw, X } from "lucide-react";
import Hls from "hls.js";
import { listWallStreams, setWallStreamState, type WallItem } from "@/lib/smart-admin.functions";

function MiniPlayer({ url }: { url: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    setError(false);
    const proxied = `/api/public/stream-proxy?url=${encodeURIComponent(url)}`;
    let hls: Hls | null = null;
    const isHls = /\.m3u8(\?|$)/i.test(url);
    if (isHls && Hls.isSupported()) {
      hls = new Hls({ maxBufferLength: 6, enableWorker: true });
      hls.loadSource(proxied);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) setError(true); });
    } else {
      video.src = proxied;
    }
    video.muted = true;
    video.play().catch(() => undefined);
    return () => { hls?.destroy(); video.removeAttribute("src"); };
  }, [url]);

  if (error) {
    return <div className="flex h-full w-full items-center justify-center bg-red-950/40 text-xs text-red-300">Yayın açılmadı</div>;
  }
  return <video ref={ref} className="h-full w-full bg-black object-cover" muted playsInline />;
}

export function PreviewWallPanel({ onChanged }: { onChanged?: () => void }) {
  const listFn = useServerFn(listWallStreams);
  const stateFn = useServerFn(setWallStreamState);
  const [items, setItems] = useState<WallItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cols, setCols] = useState(3);
  const [onlyQuarantine, setOnlyQuarantine] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      setItems(await listFn({ data: { onlyQuarantine, limit: cols * cols } }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols, onlyQuarantine]);

  const decide = async (id: string, action: "approve" | "reject") => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await stateFn({ data: { id, action } });
    onChanged?.();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div>
          <h3 className="text-base font-black">Çoklu İzleme Duvarı</h3>
          <p className="text-xs text-white/60">
            Yayınları aynı anda sessizce izleyip tek tıkla onayla ya da ele. Onaylananlar anında yayına girer.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOnlyQuarantine((v) => !v)}
            className={`rounded-xl px-3 py-2 text-xs font-bold ${onlyQuarantine ? "bg-amber-400 text-black" : "bg-white/10"}`}
          >
            {onlyQuarantine ? "Bekleyenler" : "Tümü"}
          </button>
          <button onClick={() => setCols(2)} className={`rounded-xl p-2 ${cols === 2 ? "bg-white/20" : "bg-white/5"}`}>
            <Grid2X2 className="h-4 w-4" />
          </button>
          <button onClick={() => setCols(3)} className={`rounded-xl p-2 ${cols === 3 ? "bg-white/20" : "bg-white/5"}`}>
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button onClick={refresh} className="rounded-xl bg-white/10 p-2">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-white/60">
          Şu an izlenecek yayın yok.
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
          {items.map((item) => (
            <div key={item.id} className="overflow-hidden rounded-2xl border border-white/10 bg-black">
              <div className="aspect-video">
                <MiniPlayer url={item.source_url} />
              </div>
              <div className="space-y-2 p-3">
                <div className="truncate text-sm font-bold">{item.title}</div>
                <div className="flex flex-wrap gap-1 text-[10px] text-white/50">
                  <span className="rounded bg-white/5 px-1.5 py-0.5">{item.category}</span>
                  {item.quality_label && <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-emerald-200">{item.quality_label}</span>}
                  {item.bitrate_kbps ? <span>{item.bitrate_kbps} kbps</span> : null}
                  {item.fps ? <span>{item.fps} fps</span> : null}
                  {item.backup_count > 0 && <span className="text-sky-300">+{item.backup_count} yedek</span>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => decide(item.id, "approve")}
                    className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-400 py-2 text-xs font-black text-black"
                  >
                    <Check className="h-3.5 w-3.5" /> Onayla
                  </button>
                  <button
                    onClick={() => decide(item.id, "reject")}
                    className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-red-500/80 py-2 text-xs font-black"
                  >
                    <X className="h-3.5 w-3.5" /> Ele
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
