import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import type { StreamCategory, UserStream } from "@/lib/streams.functions";
import {
  listUserStreams,
  listUserStreamsPage,
  removeUserStream,
  saveUserStream,
  rowToStream,
} from "@/lib/streams.functions";
import { loadStore } from "@/db/native-db";
import { checkIsAdmin, claimFirstAdmin } from "@/lib/admin.functions";

import { CardManager } from "./admin/CardManager";
import { EpisodeManager } from "./admin/EpisodeManager";
import { AutonomousPanel } from "./admin/AutonomousPanel";
import { RuleEnginePanel } from "./admin/RuleEnginePanel";
import { AuditLogPanel } from "./admin/AuditLogPanel";
import { RolesPanel } from "./admin/RolesPanel";
import { TrashPanel } from "./admin/TrashPanel";
import { MonitorPanel } from "./admin/MonitorPanel";
import { SmartToolsPanel } from "./admin/SmartToolsPanel";
import { PreviewWallPanel } from "./admin/PreviewWallPanel";
import { QuarantinePanel } from "./admin/QuarantinePanel";
import { LayoutBuilderPanel } from "./admin/LayoutBuilderPanel";
import { BackupPanel } from "./admin/BackupPanel";
import { HomeEditorPanel } from "./admin/HomeEditorPanel";
import { ContentManagerPanel } from "./admin/ContentManagerPanel";
import type { Media } from "./data";

type Props = {
  focusedKey: string | null;
  registerRef: (key: string, el: HTMLElement | null) => void;
  onPick: (m: Media) => void;
  streams: UserStream[];
  onChanged: () => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  totalCount?: number;
};

const fallbackPoster = "https://picsum.photos/seed/tg-custom-source/600/900";

export function streamToMedia(stream: UserStream): Media {
  return {
    id: `custom-${stream.id}`,
    title: stream.title,
    year: stream.releaseYear ?? new Date().getFullYear(),
    genre:
      stream.category === "Series"
        ? "Dizi"
        : stream.category === "Movies"
          ? "Film"
          : stream.category === "Radio"
            ? "Radyo"
            : "Canlı TV",
    genres: [typeof stream.subCategory === "string" ? stream.subCategory : stream.category],

    duration: "Kaynak",
    rating: stream.imdbRating != null ? stream.imdbRating.toFixed(1) : "—",
    poster: stream.posterUrl || fallbackPoster,
    backdrop: stream.backdropUrl || stream.posterUrl || fallbackPoster,
    description: stream.description || `${stream.category}`,
    video: stream.sourceUrl,
    publishedAt: stream.publishedAt,
    subCategory: typeof stream.subCategory === "string" ? stream.subCategory : undefined,
    country: stream.country,
    isForeign: stream.isForeign,
    seriesTitle: stream.seriesTitle,
    season: stream.season,
    episode: stream.episode,
    streamId: stream.id,
    backupUrls: stream.backupUrls,
    cast: stream.castList,
    isLive: stream.category === "Live TV",
    referer: stream.referer,
  };
}

const TYPE_OPTIONS: { id: "movie" | "series" | "live" | "radio"; label: string; category: StreamCategory }[] = [
  { id: "movie", label: "Film", category: "Movies" },
  { id: "series", label: "Dizi", category: "Series" },
  { id: "live", label: "Canlı TV", category: "Live TV" },
  { id: "radio", label: "Radyo", category: "Radio" },
];

export function AdminSources({ focusedKey, registerRef, onPick, streams, onChanged }: Props) {
  const addFn = useServerFn(saveUserStream);
  const deleteFn = useServerFn(removeUserStream);
  const checkAdminFn = useServerFn(checkIsAdmin);
  const claimAdminFn = useServerFn(claimFirstAdmin);
  const formPanelRef = useRef<HTMLElement | null>(null);

  const [signedIn, setSignedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  const [tab, setTab] = useState<
    | "home"
    | "content"
    | "sources"
    | "cards"
    | "episodes"
    | "autonomous"
    | "smart"
    | "wall"
    | "layout"
    | "rules"
    | "logs"
    | "roles"
    | "trash"
    | "monitor"
    | "backup"
  >("home");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{
    title: string;
    streamUrl: string;
    posterUrl: string;
    category: string;
    type: "movie" | "series" | "live" | "radio";
  }>({ title: "", streamUrl: "", posterUrl: "", category: "", type: "movie" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(Boolean(session)));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!signedIn) { setIsAdmin(false); setAdminChecked(false); return; }
    checkAdminFn()
      .then((r) => setIsAdmin(r.isAdmin))
      .catch(() => setIsAdmin(false))
      .finally(() => setAdminChecked(true));
  }, [signedIn, checkAdminFn]);

  const submit = async () => {
    setError(null); setBusy(true);
    try {
      const selected = TYPE_OPTIONS.find((t) => t.id === form.type);
      await addFn({
        data: {
          title: form.title,
          category: selected?.category || "Movies",
          subCategory: form.category || undefined,
          sourceUrl: form.streamUrl,
          posterUrl: form.posterUrl || fallbackPoster,
        },
      });
      setForm({ title: "", streamUrl: "", posterUrl: "", category: "", type: form.type });
      onChanged();
      requestAnimationFrame(() => formPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "İçerik eklenemedi");
    } finally { setBusy(false); }
  };

  const claimAdmin = async () => {
    try { await claimAdminFn(); setIsAdmin(true); }
    catch (e) { alert(e instanceof Error ? e.message : "Atanamadı"); }
  };

  if (!signedIn) {
    return <AdminLogin focusedKey={focusedKey} registerRef={registerRef} />;
  }

  if (adminChecked && !isAdmin) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-amber-500/30 bg-white/5 p-8 text-center">
        <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-amber-300" />
        <h2 className="text-2xl font-black">Yetkisiz Hesap</h2>
        <p className="mb-5 mt-2 text-sm text-white/60">Bu hesabın admin yetkisi yok. İlk admin olarak kendini atayabilirsin.</p>
        <button onClick={claimAdmin} className="w-full rounded-2xl bg-amber-500 px-5 py-4 font-black text-black">
          İlk admin olarak ata
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">
        {[
          { id: "home" as const, label: "🏠 Ana Sayfa" },
          { id: "content" as const, label: "📺 İçerik Yöneticisi" },
          { id: "sources" as const, label: "İçerik Ekle" },
          { id: "cards" as const, label: "Kart Yönetimi" },
          { id: "episodes" as const, label: "🎬 Bölümler" },
          { id: "autonomous" as const, label: "Otonom Kazıyıcı" },
          { id: "smart" as const, label: "🧠 Akıllı Araçlar" },
          { id: "wall" as const, label: "🧪 Karantina & Onay" },
          { id: "rules" as const, label: "⚙️ Otomasyon Kuralları" },
          { id: "logs" as const, label: "📜 Sistem Logu" },
          { id: "roles" as const, label: "👥 Roller" },
          { id: "trash" as const, label: "🗑 Geri Dönüşüm" },
          { id: "monitor" as const, label: "📊 Canlı İzleme" },
          { id: "backup" as const, label: "💾 Yedekle & Aktar" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === t.id ? "bg-purple-600 text-white" : "text-white/70 hover:bg-white/5"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "home" && <HomeEditorPanel />}
      {tab === "content" && <ContentManagerPanel onPick={onPick} />}
      {tab === "cards" && <CardManager streams={streams} onChanged={onChanged} />}
      {tab === "episodes" && <EpisodeManager streams={streams} />}
      {tab === "autonomous" && <AutonomousPanel onChanged={onChanged} />}
      {tab === "smart" && <SmartToolsPanel onChanged={onChanged} />}
      {tab === "wall" && <QuarantinePanel onChanged={onChanged} />}
      {tab === "layout" && <LayoutBuilderPanel />}
      {tab === "rules" && <RuleEnginePanel />}
      {tab === "logs" && <AuditLogPanel />}
      {tab === "roles" && <RolesPanel />}
      {tab === "trash" && <TrashPanel onChanged={onChanged} />}
      {tab === "monitor" && <MonitorPanel />}
      {tab === "backup" && <BackupPanel onChanged={onChanged} />}

      {tab === "sources" && (
        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <section ref={formPanelRef} className="relative z-10 rounded-3xl border border-purple-500/20 bg-slate-950/80 p-5 backdrop-blur lg:sticky lg:top-6 lg:self-start">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-600/25 text-purple-200">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-black">Yeni İçerik Ekle</h2>
                <p className="text-xs text-white/55">Film veya dizi kartı ekle.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-purple-200">Tür</span>
                <div className="flex gap-2">
                  {TYPE_OPTIONS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setForm((f) => ({ ...f, type: c.id }))}
                      className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold ${form.type === c.id ? "bg-purple-600 text-white" : "bg-white/10 text-white/80"}`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              {([
                ["title", "Başlık", "Örn: Çukur"],
                ["streamUrl", "Stream URL (.m3u8/.mp4)", "https://.../stream.m3u8"],
                ["posterUrl", "Poster URL", "https://.../poster.jpg"],
                ["category", "Kategori (tür)", "Örn: Aksiyon, Dram"],
              ] as const).map(([name, label, placeholder]) => (
                <label key={name} className="block">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-purple-200">{label}</span>
                  <input
                    value={form[name]}
                    onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none transition focus:ring-4 focus:ring-purple-500/70"
                  />
                </label>
              ))}
              {error && <div className="rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-200">{error}</div>}
              <button
                onClick={submit}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-purple-600 px-5 py-4 font-black text-white disabled:opacity-50 active:scale-95"
              >
                <Plus className="h-5 w-5" /> {busy ? "Ekleniyor…" : "İçeriği Ekle"}
              </button>
            </div>
          </section>

          <section className="relative z-0">
            <div className="mb-4 flex flex-wrap items-center gap-3 text-white/70">
              <Link2 className="h-5 w-5 text-purple-300" /> {streams.length} içerik
            </div>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {streams.map((stream, i) => (
                <div key={stream.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex gap-4">
                    <img loading="lazy" src={stream.posterUrl || fallbackPoster} alt={stream.title} className="h-24 w-16 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-black">{stream.title}</div>
                      <div className="mt-1 text-xs font-bold text-purple-200">
                        {stream.category === "Series" ? "Dizi" : "Film"}
                        {stream.subCategory ? ` · ${stream.subCategory}` : ""}
                      </div>
                      <div className="mt-1 truncate text-xs text-white/45">{stream.sourceUrl}</div>
                      <div className="mt-3 flex gap-2">
                        <button
                          ref={(el) => registerRef(`admin-play-${i}`, el)}
                          data-focus-key={`admin-play-${i}`}
                          tabIndex={-1}
                          onClick={() => onPick(streamToMedia(stream))}
                          className={`rounded-xl bg-white px-3 py-2 text-xs font-black text-black outline-none ${focusedKey === `admin-play-${i}` ? "neon-ring scale-105 bg-purple-500 text-white" : ""}`}
                        >Oynat</button>
                        <button
                          onClick={async () => {
                            if (!confirm(`"${stream.title}" silinsin mi?`)) return;
                            try { await deleteFn({ data: { id: stream.id } }); onChanged(); }
                            catch (e) { alert(e instanceof Error ? e.message : "Silinemedi"); }
                          }}
                          className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white"
                        ><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

/** Every active stream (Turkish first). Used by the public app. */
export function useAllStreams() {
  const listFn = useServerFn(listUserStreams);
  const [streams, setStreams] = useState<UserStream[]>(() => {
    try {
      const store = loadStore();
      const list = (store.user_streams || []).filter((s) => s.is_active !== false && !s.deleted_at);
      return list.map(rowToStream);
    } catch {
      return [];
    }
  });

  const refresh = async () => {
    try {
      const res = await fetch("/api/db/data");
      if (res.ok) {
        const store = await res.json();
        if (store?.user_streams && Array.isArray(store.user_streams) && store.user_streams.length > 0) {
          const list = store.user_streams.filter((s: any) => s.is_active !== false && !s.deleted_at);
          setStreams(list.map(rowToStream));
          return;
        }
      }
      const data = await listFn();
      if (Array.isArray(data) && data.length > 0) {
        setStreams(data);
      }
    } catch {
      // Keep existing streams on network error
    }
  };

  useEffect(() => {
    refresh();
    const handleSync = () => refresh();
    window.addEventListener("tg-db-synced", handleSync);
    return () => window.removeEventListener("tg-db-synced", handleSync);
  }, []);

  return { streams, refresh };
}

export function useUserStreams() {
  const [streams, setStreams] = useState<UserStream[]>(() => {
    try {
      const store = loadStore();
      return (store.user_streams || []).filter((s) => !s.deleted_at).map(rowToStream);
    } catch {
      return [];
    }
  });
  const [totalCount, setTotalCount] = useState(() => streams.length);

  const refresh = async () => {
    try {
      const res = await fetch("/api/db/data");
      if (res.ok) {
        const store = await res.json();
        if (store?.user_streams && Array.isArray(store.user_streams) && store.user_streams.length > 0) {
          const all = store.user_streams.filter((s: any) => !s.deleted_at).map(rowToStream);
          setStreams(all);
          setTotalCount(all.length);
        }
      }
    } catch {
      // Keep existing
    }
  };

  useEffect(() => {
    refresh();
    const handleSync = () => refresh();
    window.addEventListener("tg-db-synced", handleSync);
    return () => window.removeEventListener("tg-db-synced", handleSync);
  }, []);

  return {
    streams,
    refresh,
    loadMore: async () => {},
    hasMore: false,
    loadingMore: false,
    totalCount,
  };
}

function AdminLogin({
  focusedKey,
  registerRef,
}: {
  focusedKey: string | null;
  registerRef: (key: string, el: HTMLElement | null) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const u = username.trim().toLowerCase();
    const email = u.includes("@") ? u : `${u}@tgdizifilm.app`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setErr("Kullanıcı adı veya şifre hatalı.");
  };

  const input =
    "w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-white outline-none focus:ring-4 focus:ring-purple-500";
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-purple-500/30 bg-white/5 p-8 text-center">
      <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-purple-300" />
      <h2 className="text-2xl font-black">Admin Girişi</h2>
      <form onSubmit={login} className="mt-5 space-y-3 text-left">
        <input className={input} placeholder="Kullanıcı adı" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input className={input} type="password" placeholder="Şifre" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {err && <div className="text-sm text-red-400">{err}</div>}
        <button type="submit" disabled={loading} className="w-full rounded-2xl bg-purple-600 px-5 py-4 font-black text-white disabled:opacity-60">
          {loading ? "Giriş yapılıyor…" : "Giriş Yap"}
        </button>
      </form>
      <button
        ref={(el) => registerRef("admin-login", el)}
        data-focus-key="admin-login"
        tabIndex={-1}
        onClick={() => lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })}
        className={`mt-3 w-full rounded-2xl bg-white/10 px-5 py-3 text-sm font-bold text-white ${focusedKey === "admin-login" ? "neon-ring" : ""}`}
      >
        Google ile Giriş Yap
      </button>
    </div>
  );
}
