import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "@/components/tg/Sidebar";
import { PosterCard } from "@/components/tg/PosterCard";
import { HeroSlider } from "@/components/tg/HeroSlider";
import { HomeRows } from "@/components/tg/HomeRows";
import { VideoPlayer } from "@/components/tg/VideoPlayer";
import { SearchView } from "@/components/tg/SearchView";
import { SettingsView } from "@/components/tg/Settings";
import { ScheduleView } from "@/components/tg/Schedule";
import type { Media } from "@/components/tg/data";
import { useEnrichment } from "@/components/tg/useEnrichment";
import { streamToMedia, useAllStreams } from "@/components/tg/AdminSources";
import { LiveTV } from "@/components/tg/LiveTV";
import { AIAssistant, AIAssistantFab } from "@/components/tg/AIAssistant";
import { NotificationBell } from "@/components/tg/NotificationBell";
import { RadioView } from "@/components/tg/RadioView";
import { TGTVView } from "@/components/tg/TGTV";
import { getHomeLayout, type HomeRowWithItems } from "@/lib/home-layout.functions";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TG. Dizi Film — Otonom Yayın Platformu" },
      {
        name: "description",
        content:
          "TG. Dizi Film: ATV, Star, Show, Kanal D, NOW dizileri ve film platformları tek çatı altında — AI destekli otonom yayın motoru.",
      },
    ],
  }),
  component: TGApp,
});

const NO_TITLES: string[] = [];
const NAV_LABELS = ["Ana Sayfa", "Canlı TV", "Radyo", "Yayın Akışı", "Diziler", "Filmler", "TG TV", "Ara", "Ayarlar"];


function TGApp() {
  const [activeNav, setActiveNav] = useState(0);
  const [focusedKey, setFocusedKey] = useState<string>("nav-0");
  const [playing, setPlaying] = useState<Media | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("Tümü");
  const [movieGenre, setMovieGenre] = useState<string>("Tümü");
  const { streams } = useAllStreams();
  const [homeRows, setHomeRows] = useState<HomeRowWithItems[]>([]);
  const [homeLoaded, setHomeLoaded] = useState(false);

  useEffect(() => {
    getHomeLayout()
      .then(setHomeRows)
      .catch(() => setHomeRows([]))
      .finally(() => setHomeLoaded(true));
  }, []);

  // Admin paneli sidebar'dan kaldırıldı — sadece gizli URL /tgdizifilm-admin-paneli
  const safeSetActiveNav = useCallback((idx: number) => setActiveNav(idx), []);




  const refs = useRef<Map<string, HTMLElement>>(new Map());
  const registerRef = useCallback((key: string, el: HTMLElement | null) => {
    if (el) refs.current.set(key, el);
    else refs.current.delete(key);
  }, []);


  // After view change, focus a sensible default
  useEffect(() => {
    const t = setTimeout(() => {
      const map = refs.current;
      const candidates =
        activeNav === 0
          ? ["hero-play", "card-0-0"]
          : activeNav === 1
            ? ["live-mine-0", "live-ch-0"]
            : activeNav === 2
              ? ["radio-0"]
              : activeNav === 3
                ? ["sched-0-0"]
                : activeNav === 4
                  ? ["series-0"]
                  : activeNav === 5
                    ? ["film-0"]
                    : activeNav === 6
                      ? ["tgtv-0"]
                      : activeNav === 7
                        ? ["search-input", "result-0"]
                        : activeNav === 8
                          ? ["set-0-0"]
                          : ["admin-login", "admin-field-0", "admin-submit", "admin-play-0"];
      const firstMain = candidates.map((key) => map.get(key)).find(Boolean);
      if (firstMain) {
        const key = firstMain.getAttribute("data-focus-key") || "";
        setFocusedKey(key);
      }
    }, 80);
    return () => clearTimeout(t);
  }, [activeNav]);

  // Apply DOM focus + scroll on focusedKey change
  useEffect(() => {
    const el = refs.current.get(focusedKey);
    if (el) {
      el.focus({ preventScroll: true });
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }
  }, [focusedKey]);

  // Spatial navigation
  const move = useCallback(
    (dir: "up" | "down" | "left" | "right") => {
      const current = refs.current.get(focusedKey);
      if (!current) return;
      const a = current.getBoundingClientRect();
      const ax = a.left + a.width / 2;
      const ay = a.top + a.height / 2;

      let best: { key: string; score: number } | null = null;
      refs.current.forEach((el, key) => {
        if (key === focusedKey) return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        const dx = x - ax;
        const dy = y - ay;
        let primary = 0;
        let cross = 0;
        if (dir === "right") {
          if (dx <= 4) return;
          primary = dx;
          cross = Math.abs(dy);
        } else if (dir === "left") {
          if (dx >= -4) return;
          primary = -dx;
          cross = Math.abs(dy);
        } else if (dir === "down") {
          if (dy <= 4) return;
          primary = dy;
          cross = Math.abs(dx);
        } else {
          if (dy >= -4) return;
          primary = -dy;
          cross = Math.abs(dx);
        }
        const score = primary + cross * 2;
        const candidate: { key: string; score: number } = { key, score };
        if (!best || candidate.score < best.score) best = candidate;
      });
      if (best) setFocusedKey((best as { key: string; score: number }).key);

    },
    [focusedKey],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (playing) return;
      if (aiOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          setAiOpen(false);
        }
        return;
      }
      const k = e.key;
      // Don't hijack typing in the search input
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";

      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(k)) {
        if (isTyping && (k === "ArrowLeft" || k === "ArrowRight")) return;
        e.preventDefault();
        if (k === "ArrowUp") move("up");
        if (k === "ArrowDown") move("down");
        if (k === "ArrowLeft") move("left");
        if (k === "ArrowRight") move("right");
        return;
      }

      if (k === "Enter" || k === " ") {
        if (isTyping && k === " ") return;
        if (focusedKey.startsWith("nav-")) {
          e.preventDefault();
          const idx = parseInt(focusedKey.slice(4), 10);
          safeSetActiveNav(idx);
          return;
        }
        const el = refs.current.get(focusedKey);
        if (el) {
          e.preventDefault();
          el.click();
        }
      }

      if (k === "Escape" || k === "Backspace") {
        if (isTyping) return;
        e.preventDefault();
        setFocusedKey(`nav-${activeNav}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusedKey, move, playing, activeNav, aiOpen]);

  const sidebarFocused = focusedKey.startsWith("nav-");
  const focusedNavIndex = sidebarFocused
    ? parseInt(focusedKey.slice(4), 10)
    : activeNav;

  const userSeriesChannels = useMemo(() => {
    const groups = new Map<string, Media[]>();
    streams
      .filter((stream) => stream.category === "Series")
      .forEach((stream) => {
        const media = streamToMedia(stream);
        const title =
          stream.seriesTitle ||
          media.title.split(/\s*[-–]\s*Sezon|\s+S\d+E\d+/i)[0] ||
          media.title;
        const existing = groups.get(title) || [];
        existing.push(media);
        groups.set(title, existing);
      });
    return Array.from(groups.entries()).map(([name, items], index) => ({
      id: `user-series-${index}`,
      name,
      logo: name.slice(0, 1).toUpperCase(),
      accent: "from-purple-500 to-fuchsia-700",
      items: items.sort(
        (a, b) => (a.season ?? 0) - (b.season ?? 0) || (a.episode ?? 0) - (b.episode ?? 0),
      ),
    }));
  }, [streams]);
  const allPlayable = useMemo(() => streams.map(streamToMedia).filter((item) => item.video), [streams]);

  const getEnrichment = useEnrichment(NO_TITLES);

  const headerTitle = NAV_LABELS[activeNav];

  // Action when poster card clicked
  const playMedia = (m: Media) => setPlaying(m);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-black text-white">
      <Sidebar
        activeIndex={activeNav}
        focused={sidebarFocused}
        focusIndex={focusedNavIndex}
        registerRef={registerRef}
        onSelect={safeSetActiveNav}
      />

      <main className="relative flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-purple-700/20 blur-[180px]" />

        <div className="relative z-10 px-4 pb-28 pt-16 sm:px-6 md:px-10 md:pb-20 md:pt-8">
          {/* Top bar */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 md:mb-8">
            <div>
              <div className="font-orbitron text-[10px] font-semibold uppercase tracking-[0.4em] text-purple-300/80 md:text-xs">
                TG. Dizi Film
              </div>
              {activeNav !== 0 && (
                <h1 className="mt-1 font-orbitron text-2xl font-black md:text-3xl">{headerTitle}</h1>
              )}
            </div>
            <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="hidden items-center gap-3 text-xs font-mono text-white/50 lg:flex">
              <kbd className="rounded border border-white/15 bg-white/5 px-2 py-1">▲ ▼ ◀ ▶</kbd>
              <span>D-Pad</span>
              <kbd className="rounded border border-white/15 bg-white/5 px-2 py-1">ENTER</kbd>
              <span>Seç</span>
              <kbd className="rounded border border-white/15 bg-white/5 px-2 py-1">ESC</kbd>
              <span>Menü</span>
            </div>
            </div>
          </div>


          {/* === ANA SAYFA: tamamen admin panelindeki "Ana Sayfa" sekmesinden yönetilir === */}
          {activeNav === 0 && (() => {
            const hero = homeRows.find((r) => r.kind === "hero" && r.items.length > 0);
            const rows = homeRows.filter((r) => r.kind === "row");
            const hasAny = homeRows.some((r) => r.items.length > 0);
            return (
              <>
                {hero && <HeroSlider items={hero.items.map(streamToMedia)} onPlay={playMedia} />}
                <HomeRows rows={rows} focusedKey={focusedKey} registerRef={registerRef} onPlay={playMedia} />
                {homeLoaded && !hasAny && (
                  <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-12 text-center text-white/60">
                    Ana sayfada gösterilecek içerik yok. Yönetim panelindeki "Ana Sayfa" sekmesinden şerit ekleyebilirsin.
                  </div>
                )}
              </>
            );
          })()}

          {/* === DİZİLER — sadece category=Series, sezon/bölüm hiyerarşili === */}
          {activeNav === 4 && (() => {
            if (userSeriesChannels.length === 0) {
              return (
                <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-12 text-center text-white/60">
                  Henüz hiç dizi eklenmemiş. Admin → AI Kazıyıcı veya M3U yükleme ile dizi ekleyebilirsin.
                </div>
              );
            }
            let counter = 0;
            return (
              <div className="space-y-8">
                {userSeriesChannels.map((ch) => (
                  <section key={ch.id}>
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-700 text-sm font-black">
                        {ch.logo}
                      </div>
                      <h2 className="text-xl font-black">{ch.name}</h2>
                      <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-purple-200">
                        {ch.items.length} bölüm
                      </span>
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
                      {ch.items.map((m) => {
                        const fk = `series-${counter++}`;
                        const en = getEnrichment(m.title);
                        return (
                          <div key={m.id} onClick={() => playMedia(m)} className="cursor-pointer">
                            <PosterCard
                              media={m}
                              focused={focusedKey === fk}
                              registerRef={(el) => registerRef(fk, el)}
                              focusKey={fk}
                              onPick={playMedia}
                              posterOverride={en?.posterUrl}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            );
          })()}

          {/* === FILMLER === */}
          {activeNav === 5 && (() => {
            const MOVIE_GENRES = ["Tümü", "Aksiyon", "Komedi", "Dram", "Bilim Kurgu", "Korku", "Romantik", "Animasyon", "Belgesel", "Diğer"] as const;
            // Canlı yayınlar bu sekmeye asla girmez: yalnızca kategorisi "Movies" olan
            // ve gerçek bir video dosyasına işaret eden kayıtlar listelenir.
            const userMovies = streams
              .filter(
                (s) =>
                  s.category === "Movies" &&
                  /\.(mp4|mkv|avi|mov|webm)(\?|$)/i.test(s.sourceUrl),
              )
              .map(streamToMedia);
            const all: Media[] = userMovies;
            const filtered = movieGenre === "Tümü"
              ? all
              : all.filter((m) => {
                  const hay = [m.subCategory || "", m.genre, ...(m.genres || []), m.description].join(" ").toLowerCase();
                  return hay.includes(movieGenre.toLowerCase());
                });
            return (
              <section>
                <div className="mb-5 flex items-center gap-3">
                  <div className="h-8 w-1.5 rounded-full bg-gradient-to-b from-purple-400 to-fuchsia-600" />
                  <h2 className="text-xl font-black tracking-tight">Filmler</h2>
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white/60">
                    {filtered.length} başlık
                  </span>
                </div>
                <div className="mb-5 flex flex-wrap gap-2">
                  {MOVIE_GENRES.map((g) => {
                    const active = movieGenre === g;
                    return (
                      <button
                        key={g}
                        onClick={() => setMovieGenre(g)}
                        className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-widest transition ${
                          active
                            ? "bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.5)]"
                            : "bg-white/10 text-white/70 hover:bg-white/15"
                        }`}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4 md:gap-5">
                  {filtered.map((m, i) => {
                    const fk = `film-${i}`;
                    const en = getEnrichment(m.title);
                    return (
                      <div key={m.id} onClick={() => playMedia(m)} className="cursor-pointer">
                        <PosterCard
                          media={m}
                          focused={focusedKey === fk}
                          registerRef={(el) => registerRef(fk, el)}
                          focusKey={fk}
                          onPick={playMedia}
                          posterOverride={en?.posterUrl}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })()}

          {activeNav === 1 && (
            <LiveTV focusedKey={focusedKey} registerRef={registerRef} onPick={playMedia} streams={streams} />
          )}

          {activeNav === 2 && (
            <RadioView focusedKey={focusedKey} registerRef={registerRef} onPick={playMedia} streams={streams} />
          )}

          {activeNav === 3 && <ScheduleView registerRef={registerRef} focusedKey={focusedKey} />}

          {/* === TG TV === */}
          {activeNav === 6 && <TGTVView focusedKey={focusedKey} registerRef={registerRef} />}

          {activeNav === 7 && (
            <SearchView
              focusedKey={focusedKey}
              registerRef={registerRef}
              streams={streams}
              onPick={playMedia}
              query={query}
              setQuery={setQuery}
              genre={genre}
              setGenre={setGenre}
            />
          )}

          {activeNav === 8 && <SettingsView registerRef={registerRef} focusedKey={focusedKey} />}

          {/* Admin paneli sadece /tgdizifilm-admin-paneli URL'sinden erişilir */}


        </div>


      </main>

      <AIAssistantFab focusedKey={focusedKey} registerRef={registerRef} onOpen={() => setAiOpen(true)} />
      <AIAssistant open={aiOpen} onClose={() => setAiOpen(false)} focusedKey={focusedKey} registerRef={registerRef} />

      {playing && <VideoPlayer media={playing} playlist={allPlayable} onAutoNext={setPlaying} onClose={() => setPlaying(null)} />}
    </div>
  );
}

