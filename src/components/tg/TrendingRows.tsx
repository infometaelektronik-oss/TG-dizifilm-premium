import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Flame, Radio } from "lucide-react";
import { getTrending } from "@/lib/engagement.functions";
import type { Media } from "./data";
import { PosterCard } from "./PosterCard";

type Props = {
  media: Media[]; // all playable media with streamId
  focusedKey: string;
  registerRef: (key: string, el: HTMLElement | null) => void;
  onPlay: (m: Media) => void;
};

export function TrendingRows({ media, focusedKey, registerRef, onPlay }: Props) {
  const fetchTrending = useServerFn(getTrending);
  const [ranked, setRanked] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchTrending()
        .then((r) => alive && setRanked(r.ranked.map((x) => x.id)))
        .catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [fetchTrending]);

  const byId = new Map(media.filter((m) => m.streamId).map((m) => [m.streamId!, m]));
  const ordered = ranked.map((id) => byId.get(id)).filter(Boolean) as Media[];
  const live = ordered.filter((m) => m.isLive).slice(0, 15);
  const series = ordered.filter((m) => m.genre === "Dizi").slice(0, 15);

  const rows = [
    { key: "tlive", title: "Şu An En Çok İzlenen Canlı Kanallar", icon: Radio, items: live },
    { key: "tseries", title: "Popüler Diziler · Trend", icon: Flame, items: series },
  ].filter((r) => r.items.length > 0);
  if (rows.length === 0) return null;

  return (
    <div className="mb-10 space-y-8">
      {rows.map((row, ri) => (
        <section key={row.key}>
          <div className="mb-3 flex items-center gap-2">
            <row.icon className="h-5 w-5 text-fuchsia-400" />
            <h2 className="text-lg font-black tracking-tight md:text-xl">{row.title}</h2>
            <span className="rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-fuchsia-300">Canlı veri</span>
          </div>
          <div className="-mx-2 flex gap-3 overflow-x-auto px-2 pb-2 scrollbar-hide md:gap-4">
            {row.items.map((m, i) => {
              const fk = `trend-${ri}-${i}`;
              return (
                <div key={m.id} onClick={() => onPlay(m)} className="relative w-[140px] flex-shrink-0 cursor-pointer md:w-[160px]">
                  <span className="absolute -left-1 top-1 z-10 font-orbitron text-3xl font-black text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
                    {i + 1}
                  </span>
                  <PosterCard
                    media={m}
                    focused={focusedKey === fk}
                    registerRef={(el) => registerRef(fk, el)}
                    focusKey={fk}
                    onPick={onPlay}
                  />
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
