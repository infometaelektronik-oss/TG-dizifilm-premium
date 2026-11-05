import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckSquare, Lock, Pencil, Play, Save, Square, Trash2, X } from "lucide-react";
import {
  addStreamsToHomeRow,
  editStreamFull,
  getStreamFacets,
  hardDeleteStreams,
  listHomeRowsAdmin,
  searchStreamsAdmin,
  type AdminStream,
  type HomeRowWithItems,
} from "@/lib/home-layout.functions";
import { bulkUpdateUserStreams, rowToStream, type StreamCategory } from "@/lib/streams.functions";
import { loadStore } from "@/db/native-db";
import { streamToMedia } from "../AdminSources";
import type { Media } from "../data";

const CATS: { v: StreamCategory; l: string }[] = [
  { v: "Live TV", l: "Canlı TV" },
  { v: "Series", l: "Dizi" },
  { v: "Movies", l: "Film" },
  { v: "Radio", l: "Radyo" },
];
const PAGE = 60;
const input =
  "rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500";

type Facets = { countries: { value: string; n: number }[]; subCategories: { value: string; n: number }[] };

export function ContentManagerPanel({ onPick }: { onPick: (m: Media) => void }) {
  const searchFn = useServerFn(searchStreamsAdmin);
  const facetsFn = useServerFn(getStreamFacets);
  const rowsFn = useServerFn(listHomeRowsAdmin);
  const bulkFn = useServerFn(bulkUpdateUserStreams);
  const hardDeleteFn = useServerFn(hardDeleteStreams);
  const addToRowFn = useServerFn(addStreamsToHomeRow);

  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [country, setCountry] = useState("");
  const [sub, setSub] = useState("");
  const [origin, setOrigin] = useState<"all" | "local" | "foreign">("all");
  const [status, setStatus] = useState<"all" | "active" | "quarantine">("all");
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<AdminStream[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<Facets>({ countries: [], subCategories: [] });
  const [homeRows, setHomeRows] = useState<HomeRowWithItems[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<AdminStream | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [bCat, setBCat] = useState("");
  const [bCountry, setBCountry] = useState("");
  const [bSub, setBSub] = useState("");
  const [bOrigin, setBOrigin] = useState("");
  const [bRow, setBRow] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await searchFn({
        data: {
          q: q || undefined,
          category: category || undefined,
          country: country || undefined,
          subCategory: sub || undefined,
          origin,
          status,
          offset,
          limit: PAGE,
        },
      });
      if (res && Array.isArray(res.items)) {
        setItems(res.items);
        setTotal(res.total);
        return;
      }
    } catch {
      // Fallback to loadStore
    }

    try {
      const store = loadStore();
      let list = (store.user_streams || []).filter((s) => !s.deleted_at);
      if (q) {
        const term = q.toLowerCase();
        list = list.filter((s) => s.title.toLowerCase().includes(term));
      }
      if (category) list = list.filter((s) => s.category === category);
      if (country) list = list.filter((s) => s.country === country);
      if (sub) list = list.filter((s) => s.sub_category === sub);
      if (origin === "local") list = list.filter((s) => !s.is_foreign);
      if (origin === "foreign") list = list.filter((s) => s.is_foreign);
      if (status === "active") list = list.filter((s) => s.is_active !== false && !s.quarantine_reason);
      if (status === "quarantine") list = list.filter((s) => s.is_active === false || s.quarantine_reason);

      const pageItems = list.slice(offset, offset + PAGE).map((s) => ({
        ...rowToStream(s),
        manualLock: Boolean(s.manual_lock),
      }));
      setItems(pageItems);
      setTotal(list.length);
    } catch {
      setNote("Veriler yüklenemedi");
    }
  }, [searchFn, q, category, country, sub, origin, status, offset]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);
  useEffect(() => setOffset(0), [q, category, country, sub, origin, status]);
  useEffect(() => {
    facetsFn().then(setFacets).catch(() => {});
    rowsFn().then(setHomeRows).catch(() => {});
  }, [facetsFn, rowsFn]);

  const ids = Array.from(selected);
  const allOnPage = items.length > 0 && items.every((s) => selected.has(s.id));
  const toggle = (id: string) =>
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setNote(null);
    try {
      setNote(await fn());
      setSelected(new Set());
      load();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "İşlem başarısız");
    } finally {
      setBusy(false);
    }
  };

  const applyBulk = () =>
    run(async () => {
      const patch: Record<string, unknown> = {};
      if (bCat) patch.category = bCat;
      if (bCountry) patch.country = bCountry;
      if (bSub) patch.subCategory = bSub;
      if (bOrigin) patch.isForeign = bOrigin === "f";
      const r = await bulkFn({ data: { ids, patch } });
      return `${r.updated} kayıt güncellendi ve kilitlendi.`;
    });

  const [activePreset, setActivePreset] = useState("all");

  const applyPreset = (presetKey: string) => {
    setActivePreset(presetKey);
    setOffset(0);
    if (presetKey === "all") {
      setCategory(""); setOrigin("all"); setSub(""); setStatus("all");
    } else if (presetKey === "tr-national") {
      setCategory("Live TV"); setOrigin("local"); setSub("Ulusal"); setStatus("active");
    } else if (presetKey === "tr-news") {
      setCategory("Live TV"); setOrigin("local"); setSub("Haber"); setStatus("active");
    } else if (presetKey === "tr-sports") {
      setCategory("Live TV"); setOrigin("local"); setSub("Spor"); setStatus("active");
    } else if (presetKey === "foreign-tv") {
      setCategory("Live TV"); setOrigin("foreign"); setSub(""); setStatus("active");
    } else if (presetKey === "foreign-news") {
      setCategory("Live TV"); setOrigin("foreign"); setSub("Yabancı Haber"); setStatus("active");
    } else if (presetKey === "movies") {
      setCategory("Movies"); setOrigin("all"); setSub(""); setStatus("active");
    } else if (presetKey === "series") {
      setCategory("Series"); setOrigin("all"); setSub(""); setStatus("active");
    } else if (presetKey === "radio") {
      setCategory("Radio"); setOrigin("all"); setSub(""); setStatus("active");
    } else if (presetKey === "quarantine") {
      setCategory(""); setOrigin("all"); setSub(""); setStatus("quarantine");
    }
  };

  const handleAiCategorize = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/smart-tools/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ai-categorize" }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Hata oluştu");
      setNote(data.summary || "AI kanal sınıflandırması tamamlandı.");
      facetsFn().then(setFacets).catch(() => {});
      load();
    } catch (e: any) {
      setNote(e.message || "Sınıflandırma hatası");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-purple-500/20 bg-white/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black">İçerik Yöneticisi &amp; Kategori Ağacı</h3>
            <p className="text-xs text-white/55">
              Kanalları dil, kategori ve yayın türüne göre ayrıştır. Türk kanalları ile yabancı kanallar net olarak birbirinden ayrılmıştır.
            </p>
          </div>
          <button
            onClick={handleAiCategorize}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-purple-600 px-4 py-2 text-xs font-black text-white hover:opacity-95 disabled:opacity-50"
          >
            🧠 AI ile Kanalları Ayrıştır
          </button>
        </div>

        {/* Quick Filter Presets Chips */}
        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-white/10 pt-3">
          {[
            { id: "all", label: "🌟 Tümü" },
            { id: "tr-national", label: "🇹🇷 Türk / Ulusal TV" },
            { id: "tr-news", label: "📰 Türk Haber" },
            { id: "tr-sports", label: "⚽ Türk Spor" },
            { id: "foreign-tv", label: "🌍 Yabancı TV" },
            { id: "foreign-news", label: "🌐 Yabancı Haber" },
            { id: "movies", label: "🎬 Film" },
            { id: "series", label: "🍿 Dizi" },
            { id: "radio", label: "📻 Radyo" },
            { id: "quarantine", label: "🧪 Karantina" },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                activePreset === p.id
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                  : "bg-white/10 text-white/70 hover:bg-white/15"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <input className={`${input} min-w-[200px] flex-1`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ada göre ara…" />
          <select className={input} value={category} onChange={(e) => { setCategory(e.target.value); setActivePreset("custom"); }}>
            <option value="">Tüm kategoriler</option>
            {CATS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
          </select>
          <select className={input} value={origin} onChange={(e) => { setOrigin(e.target.value as typeof origin); setActivePreset("custom"); }}>
            <option value="all">Yerli + Yabancı</option>
            <option value="local">🇹🇷 Sadece yerli</option>
            <option value="foreign">🌍 Sadece yabancı</option>
          </select>
          <select className={input} value={country} onChange={(e) => { setCountry(e.target.value); setActivePreset("custom"); }}>
            <option value="">Tüm ülkeler</option>
            <option value="__none">Ülkesi boş olanlar</option>
            {facets.countries.map((c) => <option key={c.value} value={c.value}>{c.value} ({c.n})</option>)}
          </select>
          <select className={input} value={sub} onChange={(e) => { setSub(e.target.value); setActivePreset("custom"); }}>
            <option value="">Tüm alt kategoriler</option>
            <option value="__none">Alt kategorisi boş</option>
            {facets.subCategories.map((c) => <option key={c.value} value={c.value}>{c.value} ({c.n})</option>)}
          </select>
          <select className={input} value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setActivePreset("custom"); }}>
            <option value="all">Yayında + karantina</option>
            <option value="active">Sadece yayında</option>
            <option value="quarantine">Sadece karantina</option>
          </select>
        </div>
      </div>

      <div className="sticky top-20 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-purple-500/30 bg-slate-950/95 p-3 backdrop-blur">
        <button
          onClick={() =>
            setSelected((p) => {
              const n = new Set(p);
              items.forEach((s) => (allOnPage ? n.delete(s.id) : n.add(s.id)));
              return n;
            })
          }
          className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold"
        >
          {allOnPage ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />} Sayfadakileri seç
        </button>
        <span className="text-xs text-white/60">{selected.size} seçili</span>
        <select className={input} value={bCat} onChange={(e) => setBCat(e.target.value)}>
          <option value="">Kategori…</option>
          {CATS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
        </select>
        <input className={`${input} w-32`} list="cm-countries" value={bCountry} onChange={(e) => setBCountry(e.target.value)} placeholder="Ülke…" />
        <datalist id="cm-countries">{facets.countries.map((c) => <option key={c.value} value={c.value} />)}</datalist>
        <input className={`${input} w-32`} list="cm-subs" value={bSub} onChange={(e) => setBSub(e.target.value)} placeholder="Alt kategori…" />
        <datalist id="cm-subs">{facets.subCategories.map((c) => <option key={c.value} value={c.value} />)}</datalist>
        <select className={input} value={bOrigin} onChange={(e) => setBOrigin(e.target.value)}>
          <option value="">Yerli/Yabancı…</option>
          <option value="l">Yerli</option>
          <option value="f">Yabancı</option>
        </select>
        <button
          disabled={busy || !ids.length || (!bCat && !bCountry && !bSub && !bOrigin)}
          onClick={applyBulk}
          className="rounded-xl bg-purple-600 px-3 py-2 text-xs font-black disabled:opacity-40"
        >
          Uygula
        </button>
        <button
          disabled={busy || !ids.length}
          onClick={() => run(async () => `${(await bulkFn({ data: { ids, patch: { isActive: true } } })).updated} kayıt yayına alındı.`)}
          className="rounded-xl bg-emerald-600/80 px-3 py-2 text-xs font-black disabled:opacity-40"
        >
          Yayına al
        </button>
        <button
          disabled={busy || !ids.length}
          onClick={() => run(async () => `${(await bulkFn({ data: { ids, patch: { isActive: false } } })).updated} kayıt yayından kaldırıldı.`)}
          className="rounded-xl bg-amber-500/80 px-3 py-2 text-xs font-black text-black disabled:opacity-40"
        >
          Yayından kaldır
        </button>
        <select className={input} value={bRow} onChange={(e) => setBRow(e.target.value)}>
          <option value="">Şeride ekle…</option>
          {homeRows.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
        </select>
        <button
          disabled={busy || !ids.length || !bRow}
          onClick={() =>
            run(async () => {
              await addToRowFn({ data: { rowId: bRow, streamIds: ids } });
              return `${ids.length} kayıt şeride eklendi (şerit "elle seçim" moduna geçti).`;
            })
          }
          className="rounded-xl bg-cyan-500/80 px-3 py-2 text-xs font-black text-black disabled:opacity-40"
        >
          Ekle
        </button>
        <button
          disabled={busy || !ids.length}
          onClick={() => {
            if (!confirm(`${ids.length} kayıt KALICI olarak silinsin mi? Bu geri alınamaz.`)) return;
            run(async () => `${(await hardDeleteFn({ data: { ids } })).deleted} kayıt kalıcı olarak silindi.`);
          }}
          className="flex items-center gap-1 rounded-xl bg-red-600 px-3 py-2 text-xs font-black disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" /> Kalıcı sil
        </button>
        {note && <span className="w-full text-xs text-purple-200">{note}</span>}
      </div>

      <div className="space-y-2">
        {items.map((s) => {
          const sel = selected.has(s.id);
          return (
            <div key={s.id} className={`flex items-center gap-3 rounded-2xl border p-3 ${sel ? "border-purple-400 bg-purple-600/15" : "border-white/10 bg-black/30"}`}>
              <button onClick={() => toggle(s.id)} className="text-purple-200" aria-label="Seç">
                {sel ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
              </button>
              {s.posterUrl ? (
                <img loading="lazy" src={s.posterUrl} alt="" className="h-10 w-10 rounded-lg bg-white/5 object-contain" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-sm font-black">{s.title.slice(0, 1)}</div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 truncate text-sm font-black">
                  {s.title}
                  {s.manualLock && <Lock className="h-3.5 w-3.5 text-amber-300" aria-label="Elle kilitli" />}
                </div>
                <div className="truncate text-[11px] text-purple-200">
                  {CATS.find((c) => c.v === s.category)?.l || s.category}
                  {s.subCategory ? ` · ${s.subCategory}` : ""} · {s.country || "ülke yok"} · {s.isForeign ? "Yabancı" : "Yerli"}
                  {s.isActive ? "" : " · ⏸ karantina"}
                </div>
              </div>
              <button onClick={() => onPick(streamToMedia(s))} className="rounded-lg bg-white/10 p-2" title="Oynat">
                <Play className="h-4 w-4" />
              </button>
              <button onClick={() => setEditing(s)} className="rounded-lg bg-purple-600/60 p-2" title="Düzenle">
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-white/50">Sonuç yok.</div>
        )}
      </div>

      <div className="flex items-center justify-center gap-3 text-sm">
        <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))} className="rounded-xl bg-white/10 px-4 py-2 disabled:opacity-30">
          ‹ Önceki
        </button>
        <span className="text-white/60">
          {total === 0 ? 0 : offset + 1}–{Math.min(offset + PAGE, total)} / {total}
        </span>
        <button disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)} className="rounded-xl bg-white/10 px-4 py-2 disabled:opacity-30">
          Sonraki ›
        </button>
      </div>

      {editing && (
        <EditDialog
          stream={editing}
          facets={facets}
          onClose={(changed) => {
            setEditing(null);
            if (changed) load();
          }}
        />
      )}
    </section>
  );
}

function EditDialog({ stream, facets, onClose }: { stream: AdminStream; facets: Facets; onClose: (changed: boolean) => void }) {
  const editFn = useServerFn(editStreamFull);
  const [f, setF] = useState({
    title: stream.title,
    category: stream.category,
    subCategory: (stream.subCategory as string) || "",
    country: stream.country || "",
    isForeign: Boolean(stream.isForeign),
    isActive: stream.isActive !== false,
    posterUrl: stream.posterUrl || "",
    sourceUrl: stream.sourceUrl,
    seriesTitle: stream.seriesTitle || "",
    season: stream.season ?? null,
    episode: stream.episode ?? null,
    description: stream.description || "",
    manualLock: true,
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await editFn({ data: { id: stream.id, ...f } });
      onClose(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, el: React.ReactNode, wide = false) => (
    <label className={`block ${wide ? "md:col-span-2" : ""}`}>
      <span className="mb-1 block text-xs font-bold text-purple-200">{label}</span>
      {el}
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur">
      <div className="mt-10 w-full max-w-2xl rounded-3xl border border-purple-500/30 bg-slate-950 p-6">
        <div className="mb-4 flex items-center">
          <h3 className="text-lg font-black">Kaydı düzenle</h3>
          <button onClick={() => onClose(false)} className="ml-auto rounded-xl bg-white/10 p-2"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {field("Ad", <input className={`${input} w-full`} value={f.title} onChange={(e) => set({ title: e.target.value })} />, true)}
          {field(
            "Kategori",
            <select className={`${input} w-full`} value={f.category} onChange={(e) => set({ category: e.target.value as StreamCategory })}>
              {CATS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
            </select>,
          )}
          {field(
            "Alt kategori",
            <>
              <input className={`${input} w-full`} list="ed-subs" value={f.subCategory} onChange={(e) => set({ subCategory: e.target.value })} placeholder="Ulusal, Haber, Spor…" />
              <datalist id="ed-subs">{facets.subCategories.map((c) => <option key={c.value} value={c.value} />)}</datalist>
            </>,
          )}
          {field(
            "Ülke",
            <>
              <input className={`${input} w-full`} list="ed-countries" value={f.country} onChange={(e) => set({ country: e.target.value })} placeholder="Türkiye, Almanya…" />
              <datalist id="ed-countries">{facets.countries.map((c) => <option key={c.value} value={c.value} />)}</datalist>
            </>,
          )}
          {field(
            "Yerli / Yabancı",
            <select className={`${input} w-full`} value={f.isForeign ? "f" : "l"} onChange={(e) => set({ isForeign: e.target.value === "f" })}>
              <option value="l">Yerli</option>
              <option value="f">Yabancı</option>
            </select>,
          )}
          {field("Logo / afiş adresi", <input className={`${input} w-full`} value={f.posterUrl} onChange={(e) => set({ posterUrl: e.target.value })} />, true)}
          {field("Yayın adresi", <input className={`${input} w-full`} value={f.sourceUrl} onChange={(e) => set({ sourceUrl: e.target.value })} />, true)}
          {f.category === "Series" && (
            <>
              {field("Dizi adı", <input className={`${input} w-full`} value={f.seriesTitle} onChange={(e) => set({ seriesTitle: e.target.value })} />, true)}
              {field("Sezon", <input type="number" className={`${input} w-full`} value={f.season ?? ""} onChange={(e) => set({ season: e.target.value ? Number(e.target.value) : null })} />)}
              {field("Bölüm", <input type="number" className={`${input} w-full`} value={f.episode ?? ""} onChange={(e) => set({ episode: e.target.value ? Number(e.target.value) : null })} />)}
            </>
          )}
          {field("Açıklama", <textarea className={`${input} w-full`} rows={3} value={f.description} onChange={(e) => set({ description: e.target.value })} />, true)}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.isActive} onChange={(e) => set({ isActive: e.target.checked })} /> Yayında
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.manualLock} onChange={(e) => set({ manualLock: e.target.checked })} /> Otomatik sistem dokunmasın (kilitli)
          </label>
        </div>
        {err && <div className="mt-3 rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-200">{err}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => onClose(false)} className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold">Vazgeç</button>
          <button onClick={save} disabled={busy} className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-black disabled:opacity-40">
            <Save className="h-4 w-4" /> Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
