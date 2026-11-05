import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckSquare,
  Repeat2,
  Square,
  Trash2,
  Wand2,
  Tv,
  Film,
  Clapperboard,
  Radio,
  Sparkles,
  Layers,
  Search,
  RefreshCw,
  Play,
  Check,
} from "lucide-react";
import type { StreamCategory, UserStream } from "@/lib/streams.functions";
import {
  bulkDeleteUserStreams,
  bulkUpdateUserStreams,
  hotSwapStreamUrl,
  removeUserStream,
  rowToStream,
} from "@/lib/streams.functions";
import { countryLabel } from "@/lib/media-classifier";

type Props = {
  streams: UserStream[];
  onChanged: () => void;
};

type MainTab = "Tümü" | "Live TV" | "Movies" | "Series" | "Radio";

const MAIN_TABS: { id: MainTab; label: string; icon: any; color: string }[] = [
  { id: "Tümü", label: "Tüm İçerikler", icon: Layers, color: "text-white" },
  { id: "Live TV", label: "Canlı TV", icon: Tv, color: "text-emerald-400" },
  { id: "Movies", label: "Filmler (Sinema)", icon: Film, color: "text-amber-400" },
  { id: "Series", label: "Diziler", icon: Clapperboard, color: "text-purple-400" },
  { id: "Radio", label: "Radyolar", icon: Radio, color: "text-cyan-400" },
];

const TV_SUB_CATEGORIES = [
  "Tümü",
  "Ulusal",
  "Haber",
  "Spor",
  "Sinema Kanalları",
  "Dizi Kanalları",
  "Belgesel",
  "Çocuk",
  "Müzik",
  "Yabancı TV",
];

const MOVIE_SUB_CATEGORIES = [
  "Tümü",
  "Yerli Sinema",
  "Yeşilçam Klasikleri",
  "Yabancı Sinema",
  "Komedi",
  "Aksiyon",
  "Dram",
  "Bilim Kurgu",
];

const SERIES_SUB_CATEGORIES = [
  "Tümü",
  "Kanal D",
  "Show TV",
  "Star TV",
  "ATV",
  "TRT 1",
  "NOW",
  "Efsaneler",
  "Yabancı Dizi",
];

const RADIO_SUB_CATEGORIES = [
  "Tümü",
  "Ulusal Radyo",
  "Pop Müzik",
  "Slow Müzik",
  "Haber / Spor",
];

export function CardManager({ streams, onChanged }: Props) {
  const removeFn = useServerFn(removeUserStream);
  const hotSwapFn = useServerFn(hotSwapStreamUrl);
  const bulkUpdateFn = useServerFn(bulkUpdateUserStreams);
  const bulkDeleteFn = useServerFn(bulkDeleteUserStreams);

  const [mainTab, setMainTab] = useState<MainTab>("Tümü");
  const [subFilter, setSubFilter] = useState<string>("Tümü");
  const [countryFilter, setCountryFilter] = useState<string>("Tümü");
  const [q, setQ] = useState("");
  const [local, setLocal] = useState<UserStream[]>(streams);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState<StreamCategory | "">("");
  const [bulkSub, setBulkSub] = useState("");
  const [bulkGroup, setBulkGroup] = useState("");
  const [bulkCountry, setBulkCountry] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [swapId, setSwapId] = useState<string | null>(null);
  const [swapUrl, setSwapUrl] = useState("");
  const [swapBusy, setSwapBusy] = useState(false);

  useEffect(() => {
    if (!streams || streams.length < 500) {
      fetch("/api/db/data")
        .then((r) => r.json())
        .then((store) => {
          if (store?.user_streams && Array.isArray(store.user_streams) && store.user_streams.length > 500) {
            setLocal(store.user_streams.filter((s: any) => !s.deleted_at).map(rowToStream));
          } else if (streams && streams.length > 0) {
            setLocal(streams);
          }
        })
        .catch(() => {
          if (streams) setLocal(streams);
        });
    } else {
      setLocal(streams);
    }
  }, [streams]);

  // Tab category count stats
  const counts = useMemo(() => {
    const c = { Tümü: local.length, "Live TV": 0, Movies: 0, Series: 0, Radio: 0 };
    local.forEach((s) => {
      if (s.category === "Live TV") c["Live TV"]++;
      else if (s.category === "Movies") c.Movies++;
      else if (s.category === "Series") c.Series++;
      else if (s.category === "Radio") c.Radio++;
    });
    return c;
  }, [local]);

  const activeSubCategories = useMemo(() => {
    if (mainTab === "Live TV") return TV_SUB_CATEGORIES;
    if (mainTab === "Movies") return MOVIE_SUB_CATEGORIES;
    if (mainTab === "Series") return SERIES_SUB_CATEGORIES;
    if (mainTab === "Radio") return RADIO_SUB_CATEGORIES;
    return [];
  }, [mainTab]);

  const countries = useMemo(() => {
    const set = new Set<string>();
    local.forEach((s) => s.country && set.add(s.country));
    return ["Tümü", ...Array.from(set).sort()];
  }, [local]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return local.filter((s) => {
      // Main tab filter
      if (mainTab !== "Tümü") {
        if (s.category !== mainTab) return false;
      }

      // Subcategory / Channel group filter
      if (subFilter !== "Tümü") {
        const subLow = (s.subCategory || "").toLowerCase();
        const grpLow = (s.channelGroup || "").toLowerCase();
        const filterLow = subFilter.toLowerCase();
        const match = subLow.includes(filterLow) || grpLow.includes(filterLow);
        if (!match) return false;
      }

      // Country filter
      if (countryFilter !== "Tümü" && (s.country || "") !== countryFilter) return false;

      // Search term
      if (term) {
        const hay = [s.title, s.subCategory, s.channelGroup, s.country, ...(s.tags || [])]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [local, mainTab, subFilter, countryFilter, q]);

  const allSelected = filtered.length > 0 && filtered.every((s) => selected.has(s.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) => {
      if (allSelected) {
        const next = new Set(prev);
        filtered.forEach((s) => next.delete(s.id));
        return next;
      }
      const next = new Set(prev);
      filtered.forEach((s) => next.add(s.id));
      return next;
    });

  const runBulk = async (patch: Record<string, unknown>, label: string) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBulkBusy(true);
    setNote(null);
    try {
      const res = await bulkUpdateFn({ data: { ids, patch } });
      setNote(`${res.updated} içerik başarıyla güncellendi (${label}).`);
      setSelected(new Set());
      onChanged();
      // Reload local data
      const refreshed = await fetch("/api/db/data").then((r) => r.json());
      if (refreshed?.user_streams) {
        setLocal(refreshed.user_streams.filter((s: any) => !s.deleted_at).map(rowToStream));
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Toplu güncelleme başarısız");
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`${ids.length} içerik geri dönüşüm kutusuna taşınsın mı?`)) return;
    setBulkBusy(true);
    try {
      const res = await bulkDeleteFn({ data: { ids } });
      setNote(`${res.deleted} içerik silindi.`);
      setSelected(new Set());
      onChanged();
      const refreshed = await fetch("/api/db/data").then((r) => r.json());
      if (refreshed?.user_streams) {
        setLocal(refreshed.user_streams.filter((s: any) => !s.deleted_at).map(rowToStream));
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Silinemedi");
    } finally {
      setBulkBusy(false);
    }
  };

  const applySwap = async (id: string) => {
    const url = swapUrl.trim();
    if (!url) return;
    setSwapBusy(true);
    setNote(null);
    try {
      await hotSwapFn({ data: { id, sourceUrl: url } });
      setNote("Yayın kaynağı anında güncellendi ve yayına alındı.");
      setSwapId(null);
      setSwapUrl("");
      onChanged();
      const refreshed = await fetch("/api/db/data").then((r) => r.json());
      if (refreshed?.user_streams) {
        setLocal(refreshed.user_streams.filter((s: any) => !s.deleted_at).map(rowToStream));
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Kaynak değiştirilemedi");
    } finally {
      setSwapBusy(false);
    }
  };

  const onDelete = async (id: string, title: string) => {
    if (!confirm(`"${title}" silinsin mi?`)) return;
    setBusyId(id);
    try {
      await removeFn({ data: { id } });
      onChanged();
      setLocal((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Silinemedi");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-3xl border border-purple-500/20 bg-white/5 p-4 backdrop-blur md:p-6">
      {/* Header & Synchronization */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-black text-white">Kart ve İçerik Yönetimi</h3>
            <span className="rounded-full bg-purple-500/20 px-2.5 py-0.5 text-xs font-bold text-purple-300">
              {filtered.length} / {local.length} İçerik
            </span>
          </div>
          <p className="mt-1 text-xs text-white/60">
            Canlı TV kanallarını, sinema filmlerini ve ulusal kanal dizilerini ayrı kategorilerde yönetin ve anında güncelleyin.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              localStorage.removeItem("tg_dizi_db");
              fetch("/api/db/data")
                .then((r) => r.json())
                .then((store) => {
                  if (store?.user_streams) {
                    setLocal(store.user_streams.filter((s: any) => !s.deleted_at).map(rowToStream));
                  }
                })
                .catch(() => {});
              onChanged();
            }}
            title="Önbelleği temizleyip güncel veritabanını yeniler"
            className="flex items-center gap-1.5 rounded-xl border border-purple-500/30 bg-purple-600/30 px-3 py-2 text-xs font-bold text-purple-200 transition hover:bg-purple-600/50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Senkronize Et
          </button>
        </div>
      </div>

      {/* 1. ANA KATEGORİ SEKMELERİ (Canlı TV, Filmler, Diziler, Radyolar) */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
        {MAIN_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = mainTab === tab.id;
          const count = counts[tab.id as keyof typeof counts] || 0;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setMainTab(tab.id);
                setSubFilter("Tümü");
                setSelected(new Set());
              }}
              className={`flex items-center justify-between rounded-2xl border p-3.5 text-left transition ${
                active
                  ? "border-purple-400 bg-gradient-to-r from-purple-600/30 to-fuchsia-600/30 shadow-[0_0_20px_rgba(168,85,247,0.3)] ring-1 ring-purple-400"
                  : "border-white/10 bg-black/30 hover:border-white/20 hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`h-5 w-5 ${tab.color}`} />
                <span className="text-xs font-black text-white md:text-sm">{tab.label}</span>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  active ? "bg-purple-500 text-white" : "bg-white/10 text-white/60"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 2. ALT KATEGORİ VE KANAL FİLTRE ÇİPLERİ */}
      {activeSubCategories.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5 rounded-2xl border border-white/10 bg-black/40 p-2.5">
          <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-purple-300">
            {mainTab === "Series"
              ? "Kanal Filtresi:"
              : mainTab === "Movies"
              ? "Tür:"
              : "Grup:"}
          </span>
          {activeSubCategories.map((sub) => {
            const active = subFilter === sub;
            return (
              <button
                key={sub}
                onClick={() => setSubFilter(sub)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  active
                    ? "bg-purple-600 text-white shadow-md shadow-purple-900/40"
                    : "bg-white/5 text-white/70 hover:bg-white/15 hover:text-white"
                }`}
              >
                {sub}
              </button>
            );
          })}
        </div>
      )}

      {/* 3. ARAMA VE ÜLKE FİLTRELERİ */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Başlık, etiket veya kategori ara…"
            className="w-full rounded-xl border border-white/15 bg-black/50 py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-purple-400"
          />
        </div>

        <select
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          className="rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-xs text-white outline-none focus:border-purple-400"
        >
          {countries.map((c) => (
            <option key={c} value={c} className="bg-neutral-900 text-white">
              {c === "Tümü" ? "Tüm Ülkeler" : countryLabel(c)}
            </option>
          ))}
        </select>

        <span className="text-xs text-white/50">
          {selected.size > 0 ? `${selected.size} seçildi` : ""}
        </span>
      </div>

      {/* 4. TOPLU İŞLEM VE HIZLI ETİKETLEME ÇUBUĞU */}
      <div className="mb-4 rounded-2xl border border-purple-500/25 bg-black/60 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={toggleAll}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/20"
          >
            {allSelected ? <CheckSquare className="h-4 w-4 text-purple-400" /> : <Square className="h-4 w-4" />}
            {allSelected ? "Seçimi Kaldır" : "Görünenlerin Tümünü Seç"}
          </button>

          {/* Hızlı Atama Butonları */}
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-purple-300">Hızlı Ata:</span>
              {mainTab === "Series" && (
                <>
                  {["Kanal D", "Show TV", "Star TV", "ATV", "TRT 1", "NOW", "Efsaneler"].map((ch) => (
                    <button
                      key={ch}
                      disabled={bulkBusy}
                      onClick={() =>
                        runBulk(
                          { category: "Series", channelGroup: ch, subCategory: `${ch} Dizileri` },
                          `${ch} Dizisi`,
                        )
                      }
                      className="rounded-lg bg-purple-500/20 px-2 py-1 text-[11px] font-bold text-purple-200 transition hover:bg-purple-500/40"
                    >
                      {ch}
                    </button>
                  ))}
                </>
              )}
              {mainTab === "Movies" && (
                <>
                  {["Yerli Sinema", "Yeşilçam Klasikleri", "Yabancı Sinema", "Komedi", "Aksiyon"].map((m) => (
                    <button
                      key={m}
                      disabled={bulkBusy}
                      onClick={() =>
                        runBulk(
                          { category: "Movies", channelGroup: m, subCategory: m },
                          m,
                        )
                      }
                      className="rounded-lg bg-amber-500/20 px-2 py-1 text-[11px] font-bold text-amber-200 transition hover:bg-amber-500/40"
                    >
                      {m}
                    </button>
                  ))}
                </>
              )}
              {mainTab === "Live TV" && (
                <>
                  {["Sinema Kanalları", "Dizi Kanalları", "Ulusal", "Spor", "Haber"].map((g) => (
                    <button
                      key={g}
                      disabled={bulkBusy}
                      onClick={() =>
                        runBulk(
                          { category: "Live TV", channelGroup: g, subCategory: g },
                          g,
                        )
                      }
                      className="rounded-lg bg-emerald-500/20 px-2 py-1 text-[11px] font-bold text-emerald-200 transition hover:bg-emerald-500/40"
                    >
                      {g}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Detaylı Toplu Güncelleme Formu */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
          <select
            value={bulkCategory}
            onChange={(e) => setBulkCategory(e.target.value as StreamCategory | "")}
            className="rounded-xl border border-white/15 bg-black/80 px-2.5 py-1.5 text-xs text-white outline-none"
          >
            <option value="">Kategori Değiştir…</option>
            <option value="Live TV">Canlı TV</option>
            <option value="Movies">Filmler (Sinema)</option>
            <option value="Series">Diziler</option>
            <option value="Radio">Radyolar</option>
          </select>

          <input
            value={bulkGroup}
            onChange={(e) => setBulkGroup(e.target.value)}
            placeholder="Kanal Grubu (Kanal D, Sinema Kanalları…)"
            className="w-48 rounded-xl border border-white/15 bg-black/80 px-2.5 py-1.5 text-xs text-white outline-none"
          />

          <input
            value={bulkSub}
            onChange={(e) => setBulkSub(e.target.value)}
            placeholder="Alt Kategori (Yerli Sinema, Haber…)"
            className="w-44 rounded-xl border border-white/15 bg-black/80 px-2.5 py-1.5 text-xs text-white outline-none"
          />

          <button
            disabled={bulkBusy || selected.size === 0 || (!bulkCategory && !bulkSub && !bulkGroup && !bulkCountry)}
            onClick={() => {
              const patch: Record<string, unknown> = {};
              if (bulkCategory) patch.category = bulkCategory;
              if (bulkSub) patch.subCategory = bulkSub;
              if (bulkGroup) patch.channelGroup = bulkGroup;
              if (bulkCountry) patch.country = bulkCountry;
              runBulk(patch, "alan güncelleme");
            }}
            className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-purple-500 disabled:opacity-40"
          >
            <Wand2 className="h-3.5 w-3.5" /> Seçilileri Güncelle
          </button>

          <button
            disabled={bulkBusy || selected.size === 0}
            onClick={() => runBulk({ isActive: true }, "yayına al")}
            className="rounded-xl bg-emerald-600/80 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-600 disabled:opacity-40"
          >
            Yayına Al
          </button>

          <button
            disabled={bulkBusy || selected.size === 0}
            onClick={() => runBulk({ isActive: false }, "yayından kaldır")}
            className="rounded-xl bg-amber-500/80 px-3 py-1.5 text-xs font-bold text-black transition hover:bg-amber-400 disabled:opacity-40"
          >
            Yayından Kaldır
          </button>

          <button
            disabled={bulkBusy || selected.size === 0}
            onClick={bulkDelete}
            className="rounded-xl bg-red-600/80 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-500 disabled:opacity-40"
          >
            Sil
          </button>

          {note && <span className="ml-auto text-xs font-bold text-purple-300">{note}</span>}
        </div>
      </div>

      {/* 5. İÇERİK KARTLARI LİSTESİ */}
      <div className="grid grid-cols-1 gap-2.5 max-h-[700px] overflow-y-auto pr-1">
        {filtered.slice(0, 300).map((s) => {
          const isSel = selected.has(s.id);
          const isMovie = s.category === "Movies";
          const isSeries = s.category === "Series";
          const isTV = s.category === "Live TV";
          const isRadio = s.category === "Radio";

          return (
            <div
              key={s.id}
              className={`rounded-2xl border p-3 transition ${
                isSel
                  ? "border-purple-400 bg-purple-600/20 shadow-md"
                  : "border-white/10 bg-black/40 hover:border-white/20"
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggle(s.id)}
                  className="text-purple-300 transition hover:text-white"
                  aria-label="Seç"
                >
                  {isSel ? <CheckSquare className="h-5 w-5 text-purple-400" /> : <Square className="h-5 w-5" />}
                </button>

                <img
                  loading="lazy"
                  src={s.posterUrl || `https://picsum.photos/seed/${s.id}/120/180`}
                  alt={s.title}
                  className="h-14 w-11 rounded-lg object-cover bg-neutral-900 border border-white/10"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-black text-white">{s.title}</span>

                    {/* Kategori Rozeti */}
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                        isMovie
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : isSeries
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                          : isTV
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                      }`}
                    >
                      {isMovie ? "Film" : isSeries ? "Dizi" : isTV ? "Canlı TV" : "Radyo"}
                    </span>

                    {/* Kanal Grubu / Ağ Rozeti */}
                    {s.channelGroup && (
                      <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white/80 border border-white/15">
                        {s.channelGroup}
                      </span>
                    )}

                    {/* Alt Kategori */}
                    {s.subCategory && s.subCategory !== s.channelGroup && (
                      <span className="rounded-md bg-purple-900/30 px-1.5 py-0.5 text-[10px] text-purple-200">
                        {s.subCategory}
                      </span>
                    )}

                    {s.isActive === false && (
                      <span className="rounded-md bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-300">
                        ⏸ Karantina
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-white/50">
                    <span className="truncate max-w-md font-mono text-[10px] text-white/40">
                      {s.sourceUrl}
                    </span>
                    {s.country && <span>· 🌍 {countryLabel(s.country)}</span>}
                    {s.streamType && <span>· {s.streamType}</span>}
                    {s.season && <span>· {s.season}. Sezon</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setSwapId(swapId === s.id ? null : s.id);
                      setSwapUrl(swapId === s.id ? "" : s.sourceUrl || "");
                    }}
                    className="rounded-xl border border-cyan-500/30 bg-cyan-500/20 p-2 text-cyan-200 transition hover:bg-cyan-500/40"
                    title="Yayın akış kaynağını değiştir (Hot-Swap)"
                  >
                    <Repeat2 className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => onDelete(s.id, s.title)}
                    disabled={busyId === s.id}
                    className="rounded-xl border border-red-500/30 bg-red-500/20 p-2 text-red-200 transition hover:bg-red-500/40 disabled:opacity-50"
                    title="Sil"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Hot-Swap Stream URL Değiştirme Kutusu */}
              {swapId === s.id && (
                <div className="mt-3 rounded-xl border border-cyan-500/30 bg-cyan-950/40 p-3">
                  <div className="mb-2 text-xs font-bold text-cyan-200">
                    ⚡ Yayın Akışı Kaynağını Değiştir (Hot-Swap)
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={swapUrl}
                      onChange={(e) => setSwapUrl(e.target.value)}
                      placeholder="Yeni m3u8 veya mp4 video adresi girin…"
                      className="min-w-[280px] flex-1 rounded-xl border border-white/20 bg-black/70 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                    />
                    <button
                      onClick={() => applySwap(s.id)}
                      disabled={swapBusy || !swapUrl.trim()}
                      className="rounded-xl bg-cyan-500 px-4 py-2 text-xs font-black text-black transition hover:bg-cyan-400 disabled:opacity-40"
                    >
                      {swapBusy ? "Kaydediliyor…" : "Anında Değiştir"}
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-white/50">
                    Eski adres yedek akış listesine kaydedilir, izleyiciler donma yaşamadan yeni kaynağa aktarılır.
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/15 p-12 text-center text-sm text-white/50">
            Arama kriterlerine uygun içerik bulunamadı.
          </div>
        )}
      </div>
    </section>
  );
}
