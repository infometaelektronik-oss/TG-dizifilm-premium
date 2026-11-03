import { useMemo } from "react";
import type { Media } from "./data";
import { PosterCard } from "./PosterCard";
import { countryLabel } from "@/lib/media-classifier";

type Props = {
  foreignSeries: Media[];
  foreignChannels: Media[];
  focusedKey: string;
  registerRef: (key: string, el: HTMLElement | null) => void;
  onPlay: (m: Media) => void;
  getPosterOverride?: (title: string) => string | undefined;
};

/** Yabancı Diziler + ülke bazlı Yabancı Kanallar şeritleri. */
export function ForeignRows({
  foreignSeries,
  foreignChannels,
  focusedKey,
  registerRef,
  onPlay,
  getPosterOverride,
}: Props) {
  const byCountry = useMemo(() => {
    const map = new Map<string, Media[]>();
    foreignChannels.forEach((m) => {
      const key = m.country || "Diğer";
      const list = map.get(key) || [];
      list.push(m);
      map.set(key, list);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 14);
  }, [foreignChannels]);

  let counter = 0;
  const Row = ({ title, items, badge }: { title: string; items: Media[]; badge?: string }) => (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-700 text-[11px] font-black text-white shadow">
          {title.slice(0, 1)}
        </div>
        <h3 className="text-base font-bold tracking-tight md:text-lg">{title}</h3>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white/60">
          {badge || items.length}
        </span>
      </div>
      <div className="-mx-2 flex gap-3 overflow-x-auto px-2 pb-2 scrollbar-hide md:gap-4">
        {items.slice(0, 30).map((m) => {
          const fk = `foreign-${counter++}`;
          return (
            <div
              key={m.id}
              onClick={() => onPlay(m)}
              className="w-[140px] flex-shrink-0 cursor-pointer md:w-[160px]"
            >
              <PosterCard
                media={m}
                focused={focusedKey === fk}
                registerRef={(el) => registerRef(fk, el)}
                focusKey={fk}
                onPick={onPlay}
                posterOverride={getPosterOverride?.(m.title)}
              />
            </div>
          );
        })}
      </div>
    </section>
  );

  if (foreignSeries.length === 0 && byCountry.length === 0) return null;

  return (
    <div className="space-y-10">
      {foreignSeries.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-7 w-1.5 rounded-full bg-gradient-to-b from-sky-500 to-indigo-700 md:h-8" />
            <h2 className="text-lg font-black tracking-tight md:text-xl">Yabancı Diziler</h2>
          </div>
          <Row title="Yabancı Diziler" items={foreignSeries} />
        </div>
      )}

      {byCountry.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-7 w-1.5 rounded-full bg-gradient-to-b from-cyan-400 to-blue-700 md:h-8" />
            <h2 className="text-lg font-black tracking-tight md:text-xl">Yabancı Kanallar</h2>
          </div>
          {byCountry.map(([country, items]) => (
            <Row key={country} title={countryLabel(country)} items={items} />
          ))}
        </div>
      )}
    </div>
  );
}
