import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminSources } from "@/components/tg/AdminSources";
import { VideoPlayer } from "@/components/tg/VideoPlayer";
import { SystemStatusBadge } from "@/components/tg/SystemStatusBadge";
import type { Media } from "@/components/tg/data";
import { useUserStreams } from "@/components/tg/AdminSources";

export const Route = createFileRoute("/tgdizifilm-admin-paneli")({
  head: () => ({
    meta: [
      { title: "TG Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPanelPage,
});

function AdminPanelPage() {
  const { streams, refresh, loadMore, hasMore, loadingMore, totalCount } = useUserStreams();
  const [playing, setPlaying] = useState<Media | null>(null);
  const [focusedKey, setFocusedKey] = useState<string>("admin-login");

  const registerRef = (key: string, el: HTMLElement | null) => {
    if (el && key === focusedKey) el.focus({ preventScroll: true });
  };

  return (
    <div className="min-h-screen w-screen overflow-x-hidden bg-black text-white">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-black/80 px-6 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <img
            src="/assets/aistudio/Media_item_1_1bba30da.jpg"
            alt="TG Logo"
            className="h-10 w-10 rounded-xl object-cover border border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.5)]"
          />
          <div>
            <div className="font-orbitron text-[10px] font-semibold uppercase tracking-[0.4em] text-purple-300/80">
              TG. DİZİ FİLM
            </div>
            <h1 className="mt-1 font-orbitron text-xl font-black md:text-2xl">Yönetim Paneli</h1>
          </div>
        </div>
        <SystemStatusBadge />
      </header>

      <main className="px-4 pb-20 pt-8 md:px-10">
        <AdminSources
          focusedKey={focusedKey}
          registerRef={(k, el) => {
            registerRef(k, el);
            setFocusedKey((prev) => prev || k);
          }}
          onPick={setPlaying}
          streams={streams}
          onChanged={refresh}
          onLoadMore={loadMore}
          hasMore={hasMore}
          loadingMore={loadingMore}
          totalCount={totalCount}
        />
      </main>

      {playing && (
        <VideoPlayer
          media={playing}
          playlist={[playing]}
          onAutoNext={setPlaying}
          onClose={() => setPlaying(null)}
        />
      )}
    </div>
  );
}
