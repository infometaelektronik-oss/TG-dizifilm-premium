import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, Search } from "lucide-react";
import { GENRES, type Media } from "./data";
import { streamToMedia } from "./AdminSources";
import type { UserStream } from "@/lib/streams.functions";
import { PosterCard } from "./PosterCard";

type Props = {
  focusedKey: string | null;
  registerRef: (key: string, el: HTMLElement | null) => void;
  onPick: (m: Media) => void;
  streams: UserStream[];
  query: string;
  setQuery: (q: string) => void;
  genre: string;
  setGenre: (g: string) => void;
};

// Minimal subset of the Web Speech API we use.
type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechCtor(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function SearchView({
  focusedKey,
  registerRef,
  onPick,
  streams,
  query,
  setQuery,
  genre,
  setGenre,
}: Props) {
  const all = useMemo(() => streams.map(streamToMedia), [streams]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q && genre === "Tümü") return [];
    return all.filter((m) => {
      const matchesQ =
        !q ||
        m.title.toLowerCase().includes(q) ||
        m.genre.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q);
      const matchesG = genre === "Tümü" || m.genres.includes(genre) || (m.subCategory || "") === genre;
      return matchesQ && matchesG;
    });
  }, [all, query, genre]);

  const [virtualQ, setVirtualQ] = useState(query);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const speechSupported = Boolean(getSpeechCtor());

  const toggleVoice = () => {
    const Ctor = getSpeechCtor();
    if (!Ctor) return;
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new Ctor();
    rec.lang = "tr-TR";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (ev) => {
      const t = ev.results?.[0]?.[0]?.transcript || "";
      if (t) {
        setQuery(t);
        setVirtualQ(t);
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    recRef.current = rec;
    setListening(true);
  };

  useEffect(() => () => recRef.current?.stop(), []);

  return (
    <div>
      {/* Search bar with mic */}
      <div className="mb-6 flex items-center gap-4">
        <div
          className={`flex flex-1 items-center gap-3 rounded-2xl border-2 px-5 py-4 backdrop-blur transition ${
            focusedKey === "search-input"
              ? "neon-ring border-purple-500 bg-purple-500/10"
              : "border-white/10 bg-white/5"
          }`}
        >
          <Search className="h-6 w-6 text-purple-300" />
          <input
            ref={(el) => registerRef("search-input", el)}
            data-focus-key="search-input"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setVirtualQ(e.target.value);
            }}
            placeholder="Dizi, film veya tür ara… veya mikrofona bas"
            className="w-full bg-transparent text-xl text-white placeholder:text-white/40 outline-none"
          />
          {speechSupported && (
            <button
              ref={(el) => registerRef("search-mic", el)}
              data-focus-key="search-mic"
              tabIndex={-1}
              onClick={toggleVoice}
              title={listening ? "Dinleme durduruluyor" : "Sesli ara"}
              className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
                listening
                  ? "badge-new-pulse text-white"
                  : focusedKey === "search-mic"
                    ? "neon-ring scale-105 bg-purple-600 text-white"
                    : "bg-white/10 text-purple-200 hover:bg-purple-600/40 hover:text-white"
              }`}
            >
              {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
          )}
          <span className="rounded-md bg-white/10 px-2 py-1 text-[10px] font-mono text-white/60">
            {results.length} sonuç
          </span>
        </div>
      </div>

      {/* Genre filter */}
      <div className="mb-8 flex flex-wrap gap-3">
        {GENRES.map((g, i) => {
          const isFocused = focusedKey === `genre-${i}`;
          const isActive = genre === g;
          return (
            <button
              key={g}
              ref={(el) => registerRef(`genre-${i}`, el)}
              data-focus-key={`genre-${i}`}
              tabIndex={-1}
              onClick={() => setGenre(g)}
              className={`rounded-full px-5 py-2.5 text-sm font-bold uppercase tracking-wider outline-none transition-all duration-150 ${
                isFocused
                  ? "neon-ring scale-105 bg-purple-600 text-white"
                  : isActive
                    ? "bg-purple-500/30 text-purple-100 ring-1 ring-purple-400/50"
                    : "bg-white/5 text-white/60 hover:text-white"
              }`}
            >
              {g}
            </button>
          );
        })}
      </div>

      {/* Result grid */}
      {results.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-16 text-center">
          <div className="text-2xl font-black text-white">Sonuç bulunamadı</div>
          <div className="mt-2 text-white/60">
            "{virtualQ || query}" için "{genre}" türünde eşleşme yok.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-5">
          {results.map((m, i) => (
            <PosterCard
              key={m.id}
              media={m}
              focused={focusedKey === `result-${i}`}
              registerRef={(el) => registerRef(`result-${i}`, el)}
              focusKey={`result-${i}`}
              onPick={onPick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
