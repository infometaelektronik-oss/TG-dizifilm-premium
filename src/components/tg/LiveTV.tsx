import { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { Grid2X2, Maximize2, Radio, Tv } from "lucide-react";
import type { Media } from "./data";
import { streamToMedia } from "./AdminSources";
import type { UserStream } from "@/lib/streams.functions";
import { proxiedStreamUrl } from "./v2-helpers";

type Props = {
  focusedKey: string | null;
  registerRef: (key: string, el: HTMLElement | null) => void;
  onPick: (m: Media) => void;
  streams: UserStream[];
};

const SUB_CATEGORIES = ["Tümü", "Ulusal", "Haber", "Sinema", "Belgesel", "Spor", "Çocuk", "Müzik"] as const;
type SubCat = (typeof SUB_CATEGORIES)[number];

// Built-in channels are presented as logo tiles. Selecting one plays the
// channel's headline title as a placeholder live source.
export function LiveTV({ focusedKey, registerRef, onPick, streams }: Props) {
  const allUserLive = useMemo(() => streams.filter((s) => s.category === "Live TV"), [streams]);
  const [sub, setSub] = useState<SubCat>("Tümü");
  const [origin, setOrigin] = useState<"local" | "foreign">("local");
  const [country, setCountry] = useState<string>("Tümü");
  const [shown, setShown] = useState(120);
  const foreignCountries = useMemo(() => {
    const counts = new Map<string, number>();
    allUserLive.forEach((s) => {
      if (s.isForeign && s.country) counts.set(s.country, (counts.get(s.country) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [allUserLive]);
  const userLive = useMemo(
    () =>
      allUserLive.filter((s) => {
        if (origin === "local" ? s.isForeign : !s.isForeign) return false;
        if (origin === "foreign" && country !== "Tümü" && s.country !== country) return false;
        if (sub !== "Tümü" && (s.subCategory || "").toLowerCase() !== sub.toLowerCase()) return false;
        return true;
      }),
    [allUserLive, sub, origin, country],
  );
  useEffect(() => setShown(120), [sub, origin, country]);
  const liveMedia = useMemo(() => userLive.slice(0, 4).map(streamToMedia), [userLive]);
  const [mosaic, setMosaic] = useState(false);

  return (
    <div className="space-y-10 pb-10">
      <div className="rounded-3xl border border-purple-500/30 bg-gradient-to-r from-purple-600/20 via-fuchsia-600/10 to-transparent p-6">
        <div className="flex items-center gap-3">
          <Tv className="h-6 w-6 text-purple-200" />
          <h2 className="text-2xl font-black">Canlı TV</h2>
          <span className="rounded-full bg-red-600/80 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
            <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white align-middle" />
            Canlı
          </span>
          <button
            ref={(el) => registerRef("live-mosaic", el)}
            data-focus-key="live-mosaic"
            tabIndex={-1}
            onClick={() => setMosaic((value) => !value)}
            className={`ml-auto flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-black outline-none transition active:scale-95 ${
              focusedKey === "live-mosaic" ? "neon-ring scale-105 bg-purple-600 text-white" : "bg-white/10 text-white"
            }`}
          >
            <Grid2X2 className="h-4 w-4" /> Mozaik
          </button>
        </div>
        <p className="mt-2 text-sm text-white/70">
          Bir kanal seç, doğrudan yayına geç. Alt kategorilerden süzme yapabilirsin.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {(["local", "foreign"] as const).map((o) => (
            <button
              key={o}
              ref={(el) => registerRef(`live-origin-${o}`, el)}
              data-focus-key={`live-origin-${o}`}
              tabIndex={-1}
              onClick={() => setOrigin(o)}
              className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-widest outline-none transition ${
                origin === o
                  ? "bg-white text-black"
                  : focusedKey === `live-origin-${o}`
                    ? "neon-ring bg-white/20 text-white"
                    : "bg-white/10 text-white/70"
              }`}
            >
              {o === "local" ? "Türk Kanalları" : "Yabancı Kanallar"}
            </button>
          ))}
          {origin === "foreign" && (
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="rounded-full border border-white/15 bg-black/60 px-4 py-2 text-xs font-bold text-white"
            >
              <option value="Tümü">Tüm ülkeler</option>
              {foreignCountries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {SUB_CATEGORIES.map((s, i) => {
            const active = sub === s;
            const fk = `live-sub-${i}`;
            return (
              <button
                key={s}
                ref={(el) => registerRef(fk, el)}
                data-focus-key={fk}
                tabIndex={-1}
                onClick={() => setSub(s)}
                className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-widest outline-none transition ${
                  active
                    ? "bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.5)]"
                    : focusedKey === fk
                      ? "neon-ring scale-105 bg-purple-600/40 text-white"
                      : "bg-white/10 text-white/70 hover:bg-white/15"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {mosaic && <MosaicView items={liveMedia.slice(0, 4)} onPick={onPick} />}

      {/* User-added live streams + built-in channel tiles, unified */}
      <section>
        <div className="mb-4 flex items-center gap-3">
          <Radio className="h-5 w-5 text-purple-300" />
          <h3 className="text-lg font-black tracking-tight">Kanallar</h3>
          <span className="text-xs text-white/50">{userLive.length}</span>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
          {userLive.slice(0, shown).map((s, i) => {
            const fk = `live-mine-${i}`;
            const isFocus = focusedKey === fk;
            return (
              <button
                key={s.id}
                ref={(el) => registerRef(fk, el)}
                data-focus-key={fk}
                tabIndex={-1}
                onClick={() => onPick(streamToMedia(s))}
                className={`group flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 outline-none transition active:scale-95 ${
                  isFocus ? "neon-ring scale-105 bg-purple-600/20" : "hover:bg-white/10"
                }`}
              >
                {s.posterUrl ? (
                  <img src={s.posterUrl} alt={s.title} className="h-16 w-16 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-700 text-2xl font-black">
                    {s.title.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="line-clamp-1 text-sm font-black text-white">{s.title}</div>
                <span className="rounded-full bg-red-600/80 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
                  Canlı
                </span>
              </button>
            );
          })}

        </div>
        {userLive.length > shown && (
          <button
            ref={(el) => registerRef("live-more", el)}
            data-focus-key="live-more"
            tabIndex={-1}
            onClick={() => setShown((n) => n + 120)}
            className={`mt-6 w-full rounded-2xl px-5 py-4 text-sm font-black outline-none ${
              focusedKey === "live-more" ? "neon-ring bg-purple-600 text-white" : "bg-white/10 text-white"
            }`}
          >
            Daha fazla göster ({userLive.length - shown} kanal daha)
          </button>
        )}
        {userLive.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-white/50">
            Bu filtrede kanal yok.
          </div>
        )}
      </section>
    </div>
  );
}

function MosaicView({ items, onPick }: { items: Media[]; onPick: (media: Media) => void }) {
  return (
    <section className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <div key={item.id} className="group relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
          <MiniLive media={item} />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/90 to-transparent p-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-black text-white">{item.title}</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-purple-200">Canlı Mozaik</div>
            </div>
            <button onClick={() => onPick(item)} className="rounded-full bg-white/15 p-2 text-white transition hover:bg-purple-600">
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}

function MiniLive({ media }: { media: Media }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    const raw = media.video || "";
    if (!video || !raw) return;
    const source = proxiedStreamUrl(raw, media.referer);
    let hls: Hls | null = null;
    if (/\.m3u8(?:\?|$)/i.test(raw) && Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hls.loadSource(source);
      hls.attachMedia(video);
    } else {
      video.src = source;
    }
    video.muted = true;
    video.play().catch(() => {});
    return () => hls?.destroy();
  }, [media.video, media.referer]);

  return <video ref={ref} poster={media.backdrop} muted playsInline className="h-full w-full object-cover opacity-90" />;
}
