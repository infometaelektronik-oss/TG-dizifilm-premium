import { Home, Tv, CalendarClock, Clapperboard, Film, Search, Settings, Radio, Sparkles, ShieldCheck } from "lucide-react";
import { forwardRef, useEffect, useMemo, useState } from "react";

type Item = { id: string; label: string; icon: React.ComponentType<{ className?: string }>; navIndex: number; href?: string };

const ALL_ITEMS: Item[] = [
  { id: "home", label: "Ana Sayfa", icon: Home, navIndex: 0 },
  { id: "live", label: "Canlı TV", icon: Tv, navIndex: 1 },
  { id: "radio", label: "Radyo", icon: Radio, navIndex: 2 },
  { id: "schedule", label: "Yayın Akışı", icon: CalendarClock, navIndex: 3 },
  { id: "series", label: "Diziler", icon: Clapperboard, navIndex: 4 },
  { id: "movies", label: "Filmler", icon: Film, navIndex: 5 },
  { id: "tgtv", label: "TG TV", icon: Sparkles, navIndex: 6 },
  { id: "search", label: "Ara", icon: Search, navIndex: 7 },
  { id: "settings", label: "Ayarlar", icon: Settings, navIndex: 8 },
  { id: "admin", label: "Yönetim", icon: ShieldCheck, navIndex: 9, href: "/tgdizifilm-admin-paneli" },
];

type Props = {
  activeIndex: number;
  focused: boolean;
  focusIndex: number;
  registerRef: (key: string, el: HTMLElement | null) => void;
  onSelect: (idx: number) => void;
  isAdmin?: boolean;
};

export const Sidebar = forwardRef<HTMLElement, Props>(function Sidebar(
  { activeIndex, focused, focusIndex, registerRef, onSelect, isAdmin = false },
  _ref,
) {
  // Admin sekmesi her zaman görünür — tıklanınca giriş ekranı açılır, yetkisiz hesap engellenir.
  void isAdmin;
  const items = useMemo(() => ALL_ITEMS, []);
  const [desktopNav, setDesktopNav] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const sync = () => setDesktopNav(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return (
    <>
      {/* Desktop / TV sidebar */}
      <aside
        className={`relative z-20 hidden h-screen flex-col justify-between border-r border-white/5 bg-[#0a0a0a] py-8 transition-all duration-300 md:flex ${
          focused ? "w-64" : "w-20"
        }`}
      >
        <div>
          <div className={`mb-10 px-6 ${focused ? "" : "px-3"}`}>
            {focused ? (
              <div className="flex items-center gap-3">
                <img
                  src="/assets/aistudio/Media_item_1_1bba30da.jpg"
                  alt="TG Dizi Film Logo"
                  className="h-10 w-10 shrink-0 rounded-xl object-cover border border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.5)]"
                />
                <div className="leading-none">
                  <div className="neon-text text-xl font-black tracking-tight">TG.</div>
                  <div className="neon-text mt-1 text-xs font-semibold tracking-[0.25em]">
                    DİZİ FİLM
                  </div>
                </div>
              </div>
            ) : (
              <img
                src="/assets/aistudio/Media_item_1_1bba30da.jpg"
                alt="TG Logo"
                className="h-10 w-10 mx-auto rounded-xl object-cover border border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.5)]"
              />
            )}
          </div>

          <nav className="flex flex-col gap-2 px-3">
            {items.map((it) => {
              const idx = it.navIndex;
              const isFocused = focused && focusIndex === idx;
              const isActive = activeIndex === idx;
              const Icon = it.icon;
              return (
                <button
                  key={it.id}
                  ref={(el) => {
                    if (desktopNav) registerRef(`nav-${idx}`, el);
                  }}
                  data-focus-key={`nav-${idx}`}
                  tabIndex={-1}
                  onClick={() => {
                    if (it.href) window.location.assign(it.href);
                    else onSelect(idx);
                  }}
                  className={`group flex items-center gap-4 rounded-xl px-4 py-3 text-left outline-none transition-all duration-200 ${
                    isFocused
                      ? "neon-ring scale-105 bg-purple-600/20 text-white"
                      : isActive
                        ? "bg-white/5 text-white"
                        : "text-white/60 hover:text-white"
                  }`}
                >
                  <Icon className={`h-6 w-6 shrink-0 ${isFocused ? "text-purple-300" : ""}`} />
                  {focused && (
                    <span className="truncate text-base font-medium">{it.label}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Mobile / tablet top brand bar */}
      <div className="fixed left-0 right-0 top-0 z-30 flex items-center justify-between border-b border-white/5 bg-black/80 px-4 py-2.5 backdrop-blur-xl md:hidden">
        <div className="flex items-center gap-2">
          <img
            src="/assets/aistudio/Media_item_1_1bba30da.jpg"
            alt="TG Logo"
            className="h-7 w-7 rounded-lg object-cover border border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.4)]"
          />
          <div className="neon-text text-base font-black tracking-wider">TG. DİZİ FİLM</div>
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-widest text-purple-300/80">
          {ALL_ITEMS.find((i) => i.navIndex === activeIndex)?.label ?? ""}
        </div>
      </div>

      {/* Mobile / tablet bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-white/10 bg-black/90 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden">
        {items.map((it) => {
          const idx = it.navIndex;
          const Icon = it.icon;
          const isActive = activeIndex === idx;
          return (
            <button
              key={it.id}
              ref={(el) => {
                if (!desktopNav) registerRef(`nav-${idx}`, el);
              }}
              data-focus-key={`nav-${idx}`}
              tabIndex={-1}
              onClick={() => {
                if (it.href) window.location.assign(it.href);
                else onSelect(idx);
              }}
              className={`flex min-w-[48px] flex-col items-center gap-0.5 rounded-xl px-2 py-2 outline-none transition active:scale-95 ${
                focused && focusIndex === idx
                  ? "neon-ring scale-105 text-purple-200"
                  : isActive
                  ? "text-purple-300"
                  : "text-white/60"
              }`}
            >
              <Icon
                className={`h-5 w-5 ${isActive ? "drop-shadow-[0_0_8px_rgba(192,132,252,0.9)]" : ""}`}
              />
              <span className="text-[10px] font-semibold">{it.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
});
