import { Tv2 } from "lucide-react";

export type CategoryCard = {
  id: string;
  name: string;
  // matching token used against stream.channelGroup / stream.subCategory / title
  match: string[];
  accent: string;
  kind: "kanal" | "film" | "platform";
  logo?: string;
};

export const HOME_CATEGORIES: CategoryCard[] = [
  // Kanal Dizileri
  { id: "atv", name: "ATV", match: ["atv"], accent: "from-red-500 to-orange-600", kind: "kanal" },
  { id: "star", name: "Star TV", match: ["star tv", "star"], accent: "from-blue-500 to-indigo-700", kind: "kanal" },
  { id: "show", name: "Show TV", match: ["show tv", "show"], accent: "from-yellow-500 to-amber-600", kind: "kanal" },
  { id: "kanald", name: "Kanal D", match: ["kanal d", "kanald"], accent: "from-rose-500 to-pink-700", kind: "kanal" },
  { id: "now", name: "NOW", match: ["now", "fox"], accent: "from-emerald-500 to-teal-700", kind: "kanal" },
  // Film
  { id: "filmler", name: "Filmler", match: ["film", "movie", "movies"], accent: "from-purple-500 to-fuchsia-700", kind: "film" },
  // Platformlar
  { id: "netflix", name: "Netflix", match: ["netflix"], accent: "from-red-600 to-red-900", kind: "platform" },
  { id: "disney", name: "Disney+", match: ["disney"], accent: "from-blue-700 to-indigo-900", kind: "platform" },
  { id: "prime", name: "Amazon Prime", match: ["prime", "amazon"], accent: "from-sky-500 to-blue-800", kind: "platform" },
  { id: "exxen", name: "Exxen", match: ["exxen"], accent: "from-zinc-500 to-zinc-800", kind: "platform" },
  { id: "blutv", name: "BluTV", match: ["blutv", "blu tv"], accent: "from-cyan-500 to-blue-700", kind: "platform" },
  { id: "gain", name: "Gain", match: ["gain"], accent: "from-fuchsia-500 to-purple-800", kind: "platform" },
];

type Props = {
  active: string | null;
  onPick: (id: string | null) => void;
  counts: Record<string, number>;
};

export function ChannelCards({ active, onPick, counts }: Props) {
  const groups: { title: string; kind: CategoryCard["kind"] }[] = [
    { title: "Kanal Dizileri", kind: "kanal" },
    { title: "Filmler", kind: "film" },
    { title: "Özel Platformlar", kind: "platform" },
  ];

  return (
    <div className="space-y-8">
      {groups.map((g) => {
        const items = HOME_CATEGORIES.filter((c) => c.kind === g.kind);
        return (
          <section key={g.kind}>
            <div className="mb-3 flex items-center gap-3 md:mb-4">
              <div className="h-7 w-1.5 rounded-full bg-gradient-to-b from-purple-500 to-fuchsia-700 md:h-8" />
              <h2 className="text-lg font-black tracking-tight md:text-xl">{g.title}</h2>
              {active && items.some((i) => i.id === active) && (
                <button
                  onClick={() => onPick(null)}
                  className="ml-auto rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 hover:bg-white/5"
                >
                  Tümünü göster
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-6">
              {items.map((c) => {
                const isActive = active === c.id;
                const count = counts[c.id] ?? 0;
                return (
                  <button
                    key={c.id}
                    onClick={() => onPick(isActive ? null : c.id)}
                    className={`group relative aspect-[4/3] overflow-hidden rounded-2xl border text-left transition-all ${
                      isActive
                        ? "border-purple-400 ring-2 ring-purple-500/50 scale-[1.02]"
                        : "border-white/10 hover:border-white/30 hover:scale-[1.02]"
                    } bg-gradient-to-br ${c.accent}`}
                  >
                    <div className="absolute inset-0 bg-black/30 transition-opacity group-hover:bg-black/10" />
                    <div className="relative flex h-full flex-col justify-between p-3 md:p-4">
                      <Tv2 className="h-5 w-5 text-white/80" />
                      <div>
                        <div className="text-base font-black tracking-tight text-white md:text-lg">
                          {c.name}
                        </div>
                        <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-white/70">
                          {count} içerik
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
