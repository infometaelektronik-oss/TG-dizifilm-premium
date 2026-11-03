import type { Media } from "./data";
import { PosterCard } from "./PosterCard";
import { HOME_CATEGORIES, type CategoryCard } from "./ChannelCards";

type Props = {
  media: Media[];
  focusedKey: string;
  registerRef: (key: string, el: HTMLElement | null) => void;
  onPlay: (m: Media) => void;
  getPosterOverride?: (title: string) => string | undefined;
};

const GROUPS: { title: string; kind: CategoryCard["kind"] }[] = [
  { title: "Popüler Diziler", kind: "kanal" },
  { title: "Filmler", kind: "film" },
  { title: "Özel Platformlar", kind: "platform" },
];

function matchCard(m: Media, card: CategoryCard): boolean {
  const haystack = [
    m.title,
    m.subCategory ?? "",
    m.seriesTitle ?? "",
    m.genre,
    m.description,
  ]
    .join(" ")
    .toLowerCase();
  return card.match.some((tok) => haystack.includes(tok));
}

export function ChannelRows({ media, focusedKey, registerRef, onPlay, getPosterOverride }: Props) {
  let counter = 0;
  return (
    <div className="space-y-10">
      {GROUPS.map((g) => {
        const cats = HOME_CATEGORIES.filter((c) => c.kind === g.kind);
        return (
          <div key={g.kind} className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-7 w-1.5 rounded-full bg-gradient-to-b from-purple-500 to-fuchsia-700 md:h-8" />
              <h2 className="text-lg font-black tracking-tight md:text-xl">{g.title}</h2>
            </div>
            {cats.map((c) => {
              const items = media.filter((m) => matchCard(m, c));
              return (
                <section key={c.id}>
                  <div className="mb-3 flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${c.accent} text-[11px] font-black text-white shadow`}
                    >
                      {c.name.slice(0, 1)}
                    </div>
                    <h3 className="text-base font-bold tracking-tight md:text-lg">
                      {c.name}
                    </h3>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white/60">
                      {items.length}
                    </span>
                  </div>
                  {items.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-xs text-white/40">
                      Henüz içerik yok — otonom motor tarama yapıyor.
                    </div>
                  ) : (
                    <div className="-mx-2 flex gap-3 overflow-x-auto px-2 pb-2 scrollbar-hide md:gap-4">
                      {items.map((m) => {
                        const fk = `card-0-${counter++}`;
                        const poster = getPosterOverride?.(m.title);
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
                              posterOverride={poster}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
