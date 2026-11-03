import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckSquare, Repeat2, Square, Trash2, Wand2 } from "lucide-react";
import type { StreamCategory, UserStream } from "@/lib/streams.functions";
import {
  bulkDeleteUserStreams,
  bulkUpdateUserStreams,
  hotSwapStreamUrl,
  removeUserStream,
} from "@/lib/streams.functions";
import { countryLabel } from "@/lib/media-classifier";

type Props = {
  streams: UserStream[];
  onChanged: () => void;
};

type Filter = "Tümü" | StreamCategory;
const FILTERS: Filter[] = ["Tümü", "Live TV", "Series", "Movies", "Radio"];

const CATEGORY_LABEL: Record<string, string> = {
  "Live TV": "Canlı TV",
  Series: "Dizi",
  Movies: "Film",
  Radio: "Radyo",
};

export function CardManager({ streams, onChanged }: Props) {
  const removeFn = useServerFn(removeUserStream);
  const hotSwapFn = useServerFn(hotSwapStreamUrl);
  const bulkUpdateFn = useServerFn(bulkUpdateUserStreams);
  const bulkDeleteFn = useServerFn(bulkDeleteUserStreams);

  const [filter, setFilter] = useState<Filter>("Tümü");
  const [countryFilter, setCountryFilter] = useState<string>("Tümü");
  const [q, setQ] = useState("");
  const [local, setLocal] = useState<UserStream[]>(streams);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState<StreamCategory | "">("");
  const [bulkSub, setBulkSub] = useState("");
  const [bulkCountry, setBulkCountry] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [swapId, setSwapId] = useState<string | null>(null);
  const [swapUrl, setSwapUrl] = useState("");
  const [swapBusy, setSwapBusy] = useState(false);

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
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Kaynak değiştirilemedi");
    } finally {
      setSwapBusy(false);
    }
  };

  useEffect(() => setLocal(streams), [streams]);

  const countries = useMemo(() => {
    const set = new Set<string>();
    local.forEach((s) => s.country && set.add(s.country));
    return ["Tümü", ...Array.from(set).sort()];
  }, [local]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return local.filter((s) => {
      if (filter !== "Tümü" && s.category !== filter) return false;
      if (countryFilter !== "Tümü" && (s.country || "") !== countryFilter) return false;
      if (term && !s.title.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [local, filter, countryFilter, q]);

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
      setNote(`${res.updated} içerik güncellendi (${label}).`);
      setSelected(new Set());
      onChanged();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Toplu güncelleme başarısız");
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`${ids.length} içerik kalıcı olarak silinsin mi?`)) return;
    setBulkBusy(true);
    try {
      const res = await bulkDeleteFn({ data: { ids } });
      setNote(`${res.deleted} içerik silindi.`);
      setSelected(new Set());
      onChanged();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Silinemedi");
    } finally {
      setBulkBusy(false);
    }
  };

  const onDelete = async (id: string, title: string) => {
    if (!confirm(`"${title}" silinsin mi?`)) return;
    setBusyId(id);
    try {
      await removeFn({ data: { id } });
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Silinemedi");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-3xl border border-purple-500/20 bg-white/5 p-5 backdrop-blur">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-black">Kart Yönetimi</h3>
        <span className="text-xs text-white/50">
          {filtered.length}/{local.length} içerik · {selected.size} seçili
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ara…"
            className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none"
          >
            {FILTERS.map((c) => (
              <option key={c} value={c}>
                {c === "Tümü" ? "Tüm kategoriler" : CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none"
          >
            {countries.map((c) => (
              <option key={c} value={c}>
                {c === "Tümü" ? "Tüm ülkeler" : countryLabel(c)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Toplu düzenleme çubuğu */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-purple-500/25 bg-black/40 p-3">
        <button
          onClick={toggleAll}
          className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white"
        >
          {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          {allSelected ? "Seçimi kaldır" : "Listedekileri seç"}
        </button>

        <select
          value={bulkCategory}
          onChange={(e) => setBulkCategory(e.target.value as StreamCategory | "")}
          className="rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-xs text-white"
        >
          <option value="">Kategori seç…</option>
          {(["Live TV", "Series", "Movies", "Radio"] as StreamCategory[]).map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <input
          value={bulkSub}
          onChange={(e) => setBulkSub(e.target.value)}
          placeholder="Alt kategori (Haber, Spor…)"
          className="w-44 rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-xs text-white"
        />
        <input
          value={bulkCountry}
          onChange={(e) => setBulkCountry(e.target.value)}
          placeholder="Ülke (Türkiye, Italy…)"
          className="w-44 rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-xs text-white"
        />
        <button
          disabled={bulkBusy || selected.size === 0 || (!bulkCategory && !bulkSub && !bulkCountry)}
          onClick={() => {
            const patch: Record<string, unknown> = {};
            if (bulkCategory) patch.category = bulkCategory;
            if (bulkSub) patch.subCategory = bulkSub;
            if (bulkCountry) patch.country = bulkCountry;
            runBulk(patch, "alan güncelleme");
          }}
          className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-black text-white disabled:opacity-40"
        >
          <Wand2 className="h-4 w-4" /> Seçiliyi güncelle
        </button>
        <button
          disabled={bulkBusy || selected.size === 0}
          onClick={() => runBulk({ isActive: true }, "yayına al")}
          className="rounded-xl bg-emerald-600/80 px-4 py-2 text-xs font-black text-white disabled:opacity-40"
        >
          Yayına al
        </button>
        <button
          disabled={bulkBusy || selected.size === 0}
          onClick={() => runBulk({ isActive: false }, "yayından kaldır")}
          className="rounded-xl bg-amber-500/80 px-4 py-2 text-xs font-black text-black disabled:opacity-40"
        >
          Yayından kaldır
        </button>
        <button
          disabled={bulkBusy || selected.size === 0}
          onClick={bulkDelete}
          className="rounded-xl bg-red-600/80 px-4 py-2 text-xs font-black text-white disabled:opacity-40"
        >
          Seçiliyi sil
        </button>
        {note && <span className="text-xs text-purple-200">{note}</span>}
      </div>

      <div className="grid grid-cols-1 gap-2">
        {filtered.slice(0, 400).map((s) => {
          const isSel = selected.has(s.id);
          return (
            <div
              key={s.id}
              className={`rounded-2xl border p-3 ${
                isSel ? "border-purple-400 bg-purple-600/15" : "border-white/10 bg-black/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <button onClick={() => toggle(s.id)} className="text-purple-200" aria-label="Seç">
                  {isSel ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                </button>
                <img
                  loading="lazy"
                  src={s.posterUrl || `https://picsum.photos/seed/${s.id}/120/180`}
                  alt={s.title}
                  className="h-14 w-10 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-black">{s.title}</div>
                  <div className="truncate text-[11px] text-purple-200">
                    {CATEGORY_LABEL[s.category] || s.category}
                    {s.subCategory ? ` · ${s.subCategory}` : ""}
                    {s.country ? ` · ${countryLabel(s.country)}` : ""}
                    {s.isActive === false ? " · ⏸ karantina" : ""}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSwapId(swapId === s.id ? null : s.id);
                    setSwapUrl(swapId === s.id ? "" : s.sourceUrl || "");
                  }}
                  className="rounded-lg bg-cyan-500/25 p-2 text-cyan-100"
                  title="Yayın kaynağını değiştir"
                >
                  <Repeat2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDelete(s.id, s.title)}
                  disabled={busyId === s.id}
                  className="rounded-lg bg-red-500/30 p-2 text-red-100 disabled:opacity-50"
                  title="Sil"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {swapId === s.id && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-cyan-500/25 bg-black/50 p-3">
                  <input
                    value={swapUrl}
                    onChange={(e) => setSwapUrl(e.target.value)}
                    placeholder="Yeni m3u8 / stream adresi"
                    className="min-w-[240px] flex-1 rounded-lg border border-white/15 bg-black/60 px-3 py-2 text-xs text-white outline-none"
                  />
                  <button
                    onClick={() => applySwap(s.id)}
                    disabled={swapBusy || !swapUrl.trim()}
                    className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-black text-black disabled:opacity-40"
                  >
                    Anında değiştir
                  </button>
                  <span className="text-[11px] text-white/45">
                    Eski adres yedek olarak saklanır, yayın kesintisiz devam eder.
                  </span>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-white/50">
            Sonuç yok.
          </div>
        )}
      </div>
    </section>
  );
}
