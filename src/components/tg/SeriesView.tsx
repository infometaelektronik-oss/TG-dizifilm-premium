import { useMemo, useState } from "react";
import { streamToMedia } from "./AdminSources";
import type { Media } from "./data";
import type { UserStream } from "@/lib/streams.functions";
import { PosterCard } from "./PosterCard";
import { Clapperboard, Tv, Star, Film, Sparkles } from "lucide-react";

type Props = {
  focusedKey: string | null;
  registerRef: (key: string, el: HTMLElement | null) => void;
  onPick: (m: Media) => void;
  streams: UserStream[];
  getEnrichment?: (title: string) => { posterUrl?: string; backdropUrl?: string } | null | undefined;
};

type ChannelFilter =
  | "Tümü"
  | "Kanal D"
  | "Show TV"
  | "Star TV"
  | "ATV"
  | "TRT 1"
  | "NOW"
  | "Efsaneler"
  | "Yabancı Dizi";

const CHANNELS: { id: ChannelFilter; label: string; badgeColor: string; bgGradient: string }[] = [
  { id: "Tümü", label: "Tüm Diziler", badgeColor: "bg-white/20 text-white", bgGradient: "from-purple-600 to-fuchsia-600" },
  { id: "Kanal D", label: "Kanal D Dizileri", badgeColor: "bg-blue-500/20 text-blue-300 border border-blue-500/30", bgGradient: "from-blue-600 to-indigo-700" },
  { id: "Show TV", label: "Show TV Dizileri", badgeColor: "bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30", bgGradient: "from-fuchsia-600 to-pink-700" },
  { id: "Star TV", label: "Star TV Dizileri", badgeColor: "bg-red-500/20 text-red-300 border border-red-500/30", bgGradient: "from-red-600 to-rose-700" },
  { id: "ATV", label: "ATV Dizileri", badgeColor: "bg-amber-500/20 text-amber-300 border border-amber-500/30", bgGradient: "from-amber-600 to-orange-700" },
  { id: "TRT 1", label: "TRT 1 Dizileri", badgeColor: "bg-red-700/20 text-red-200 border border-red-700/30", bgGradient: "from-red-800 to-neutral-900" },
  { id: "NOW", label: "NOW (FOX) Dizileri", badgeColor: "bg-orange-500/20 text-orange-300 border border-orange-500/30", bgGradient: "from-orange-600 to-amber-700" },
  { id: "Efsaneler", label: "Efsane Türk Dizileri", badgeColor: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30", bgGradient: "from-yellow-600 to-amber-700" },
  { id: "Yabancı Dizi", label: "Yabancı Diziler", badgeColor: "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30", bgGradient: "from-cyan-600 to-blue-700" },
];

export function SeriesView({ focusedKey, registerRef, onPick, streams, getEnrichment }: Props) {
  const [selectedChannel, setSelectedChannel] = useState<ChannelFilter>("Tümü");

  // Get all items in category === "Series"
  const seriesStreams = useMemo(() => {
    return streams.filter((s) => s.category === "Series");
  }, [streams]);

  // Group series by network / channel_group
  const groupedByChannel = useMemo(() => {
    const groups: Record<string, Media[]> = {};

    CHANNELS.filter((c) => c.id !== "Tümü").forEach((c) => {
      groups[c.id] = [];
    });

    seriesStreams.forEach((s) => {
      const media = streamToMedia(s);
      const grp = s.channelGroup || "";
      const sub = s.subCategory || "";

      // Match channel
      let targetChannel = "Efsaneler";
      if (/kanal\s*d/i.test(grp) || /kanal\s*d/i.test(sub)) targetChannel = "Kanal D";
      else if (/show/i.test(grp) || /show/i.test(sub)) targetChannel = "Show TV";
      else if (/star/i.test(grp) || /star/i.test(sub)) targetChannel = "Star TV";
      else if (/atv/i.test(grp) || /atv/i.test(sub)) targetChannel = "ATV";
      else if (/trt/i.test(grp) || /trt/i.test(sub)) targetChannel = "TRT 1";
      else if (/now|fox/i.test(grp) || /now|fox/i.test(sub)) targetChannel = "NOW";
      else if (/yabancı/i.test(grp) || /yabancı/i.test(sub) || s.isForeign) targetChannel = "Yabancı Dizi";
      else if (/efsane/i.test(grp) || /efsane/i.test(sub)) targetChannel = "Efsaneler";
      else targetChannel = "Efsaneler";

      if (!groups[targetChannel]) groups[targetChannel] = [];
      groups[targetChannel].push(media);
    });

    return groups;
  }, [seriesStreams]);

  // Filtered series list if a single channel is selected
  const activeSeriesList = useMemo(() => {
    if (selectedChannel === "Tümü") {
      return seriesStreams.map(streamToMedia);
    }
    return groupedByChannel[selectedChannel] || [];
  }, [selectedChannel, seriesStreams, groupedByChannel]);

  if (seriesStreams.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-12 text-center text-white/60">
        Henüz hiç dizi eklenmemiş. Yönetim panelinden dizi ekleyebilir veya M3U yükleyebilirsiniz.
      </div>
    );
  }

  let cardCounter = 0;

  return (
    <div className="space-y-8 pb-12">
      {/* Başlık ve İstatistikler */}
      <div className="rounded-3xl border border-purple-500/30 bg-gradient-to-r from-purple-900/40 via-fuchsia-900/20 to-black/60 p-5 md:p-7 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-fuchsia-600 shadow-lg shadow-purple-900/50">
              <Clapperboard className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white md:text-3xl">Diziler</h1>
                <span className="rounded-full bg-purple-500/30 px-3 py-1 text-xs font-black uppercase tracking-wider text-purple-200">
                  {seriesStreams.length} Dizi & Bölüm
                </span>
              </div>
              <p className="mt-1 text-xs text-white/70 md:text-sm">
                Türkiye'nin en popüler ulusal kanal dizileri (Kanal D, Show TV, Star TV, ATV, TRT 1, NOW) ve unutulmaz efsaneler.
              </p>
            </div>
          </div>
        </div>

        {/* ULUSAL KANAL VE KATEGORİ FİLTRE ÇİPLERİ */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {CHANNELS.map((ch) => {
            const active = selectedChannel === ch.id;
            const count =
              ch.id === "Tümü"
                ? seriesStreams.length
                : (groupedByChannel[ch.id] || []).length;

            return (
              <button
                key={ch.id}
                onClick={() => setSelectedChannel(ch.id)}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition md:text-sm ${
                  active
                    ? `bg-gradient-to-r ${ch.bgGradient} text-white shadow-lg shadow-purple-900/40 ring-2 ring-white/30 scale-105`
                    : "bg-white/5 text-white/70 hover:bg-white/15 hover:text-white border border-white/10"
                }`}
              >
                <span>{ch.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                    active ? "bg-black/30 text-white" : "bg-white/10 text-white/50"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* GÖRÜNÜM: TEK BİR KANAL SEÇİLİYSE */}
      {selectedChannel !== "Tümü" && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-6 w-1 rounded-full bg-purple-500" />
              <h2 className="text-xl font-black text-white">{selectedChannel} Dizileri</h2>
              <span className="text-xs text-white/50 font-medium">
                ({activeSeriesList.length} yapım)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
            {activeSeriesList.map((m) => {
              const fk = `series-card-${cardCounter++}`;
              const en = getEnrichment ? getEnrichment(m.title) : null;
              return (
                <div key={m.id} onClick={() => onPick(m)} className="cursor-pointer">
                  <PosterCard
                    media={m}
                    focused={focusedKey === fk}
                    registerRef={(el) => registerRef(fk, el)}
                    focusKey={fk}
                    onPick={onPick}
                    posterOverride={en?.posterUrl}
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* GÖRÜNÜM: "TÜMÜ" SEÇİLİYSE -> HER ULUSAL KANAL İÇİN AYRI ŞERİT / BLOK */}
      {selectedChannel === "Tümü" && (
        <div className="space-y-10">
          {CHANNELS.filter((c) => c.id !== "Tümü").map((ch) => {
            const items = groupedByChannel[ch.id] || [];
            if (items.length === 0) return null;

            return (
              <section key={ch.id} className="space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-3">
                    <div className={`h-7 w-1.5 rounded-full bg-gradient-to-b ${ch.bgGradient}`} />
                    <h2 className="text-xl font-black tracking-tight text-white">{ch.label}</h2>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${ch.badgeColor}`}>
                      {items.length} Dizi
                    </span>
                  </div>

                  <button
                    onClick={() => setSelectedChannel(ch.id)}
                    className="text-xs font-bold text-purple-300 hover:text-white transition"
                  >
                    Tümünü Gör →
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
                  {items.map((m) => {
                    const fk = `series-grid-${cardCounter++}`;
                    const en = getEnrichment ? getEnrichment(m.title) : null;
                    return (
                      <div key={m.id} onClick={() => onPick(m)} className="cursor-pointer">
                        <PosterCard
                          media={m}
                          focused={focusedKey === fk}
                          registerRef={(el) => registerRef(fk, el)}
                          focusKey={fk}
                          onPick={onPick}
                          posterOverride={en?.posterUrl}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
