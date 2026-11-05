import type { Media } from "./data";
import { PosterCard } from "./PosterCard";
import { streamToMedia } from "./AdminSources";
import type { HomeRowWithItems } from "@/lib/home-layout.functions";
import { useServerFn } from "@tanstack/react-start";
import { recordCategoryClick } from "@/lib/engagement.functions";

type Props = {
  rows: HomeRowWithItems[];
  focusedKey: string;
  registerRef: (key: string, el: HTMLElement | null) => void;
  onPlay: (m: Media) => void;
};

/** Renders rows with Dynamic UI Tuning interaction recording. */
export function HomeRows({ rows, focusedKey, registerRef, onPlay }: Props) {
  const recordClickFn = useServerFn(recordCategoryClick);

  const handlePick = (m: Media, row: HomeRowWithItems, cat?: string) => {
    recordClickFn({
      data: {
        category: row.rule?.category || cat || m.genre || "Genel",
        rowTitle: row.title,
      },
    }).catch(() => {});
    onPlay(m);
  };
  return (
    <div className="mt-8 space-y-10">
      {rows.map((row, ri) => {
        if (row.items.length === 0) return null;
        return (
          <section key={row.id}>
            <div className="mb-3 flex items-center gap-3">
              <div className="h-7 w-1.5 rounded-full bg-gradient-to-b from-purple-500 to-fuchsia-700 md:h-8" />
              <h2 className="text-lg font-black tracking-tight md:text-xl">{row.title}</h2>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white/60">
                {row.items.length}
              </span>
            </div>
            <div className="-mx-2 flex gap-3 overflow-x-auto px-2 pb-2 scrollbar-hide md:gap-4">
              {row.items.map((s, i) => {
                const fk = `card-${ri}-${i}`;
                const m = streamToMedia(s);
                if (row.display === "channel") {
                  const isFocus = focusedKey === fk;
                  return (
                    <button
                      key={s.id}
                      ref={(el) => registerRef(fk, el)}
                      data-focus-key={fk}
                      tabIndex={-1}
                      onClick={() => handlePick(m, row, s.category)}
                      className={`flex aspect-[4/3] w-[150px] flex-shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 outline-none transition active:scale-95 md:w-[170px] ${
                        isFocus ? "neon-ring scale-105 bg-purple-600/20" : "hover:bg-white/10"
                      }`}
                    >
                      {s.logoUrl || s.posterUrl ? (
                        <img
                          loading="lazy"
                          src={s.logoUrl || s.posterUrl}
                          alt={s.title}
                          className="h-14 w-14 rounded-xl object-contain"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-700 text-2xl font-black">
                          {s.title.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="line-clamp-1 text-sm font-black text-white">{s.title}</div>
                      <span className="rounded-full bg-red-600/80 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
                        Canlı
                      </span>
                    </button>
                  );
                }
                return (
                  <div key={s.id} className="flex-shrink-0">
                    <PosterCard
                      media={m}
                      focused={focusedKey === fk}
                      registerRef={(el) => registerRef(fk, el)}
                      focusKey={fk}
                      onPick={(picked) => handlePick(picked, row, s.category)}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
