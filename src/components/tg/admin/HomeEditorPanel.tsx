import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Save, Search, Trash2, X } from "lucide-react";
import {
  deleteHomeRow,
  getAppSettings,
  getStreamFacets,
  listHomeRowsAdmin,
  reorderHomeRows,
  saveHomeRow,
  searchStreamsAdmin,
  setAppSettings,
  setHomeRowItems,
  type AdminStream,
  type AppSettings,
  type HomeRowRule,
  type HomeRowWithItems,
} from "@/lib/home-layout.functions";
import type { UserStream } from "@/lib/streams.functions";

const CATS = [
  { v: "", l: "Hepsi" },
  { v: "Live TV", l: "Canlı TV" },
  { v: "Series", l: "Dizi" },
  { v: "Movies", l: "Film" },
  { v: "Radio", l: "Radyo" },
];

type Facets = { countries: { value: string; n: number }[]; subCategories: { value: string; n: number }[] };

type Draft = {
  id?: string;
  title: string;
  kind: "row" | "hero";
  mode: "manual" | "rule";
  display: "poster" | "channel";
  rule: HomeRowRule;
  maxItems: number;
  enabled: boolean;
};

const input =
  "rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500";

export function HomeEditorPanel() {
  const listFn = useServerFn(listHomeRowsAdmin);
  const saveFn = useServerFn(saveHomeRow);
  const deleteFn = useServerFn(deleteHomeRow);
  const reorderFn = useServerFn(reorderHomeRows);
  const facetsFn = useServerFn(getStreamFacets);
  const getSettingsFn = useServerFn(getAppSettings);
  const setSettingsFn = useServerFn(setAppSettings);

  const [rows, setRows] = useState<HomeRowWithItems[]>([]);
  const [facets, setFacets] = useState<Facets>({ countries: [], subCategories: [] });
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [itemsFor, setItemsFor] = useState<HomeRowWithItems | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listFn());
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Şeritler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [listFn]);

  useEffect(() => {
    reload();
    facetsFn().then(setFacets).catch(() => {});
    getSettingsFn().then(setSettings).catch(() => {});
  }, [reload, facetsFn, getSettingsFn]);

  const move = async (idx: number, dir: -1 | 1) => {
    const next = [...rows];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setRows(next);
    await reorderFn({ data: { ids: next.map((r) => r.id) } });
  };

  const toggle = async (r: HomeRowWithItems) => {
    await saveFn({ data: { ...toDraft(r), id: r.id, enabled: !r.enabled } });
    reload();
  };

  const remove = async (r: HomeRowWithItems) => {
    if (!confirm(`"${r.title}" şeridi silinsin mi? (İçindeki yayınlar silinmez.)`)) return;
    await deleteFn({ data: { id: r.id } });
    reload();
  };

  const save = async () => {
    if (!editing) return;
    try {
      await saveFn({ data: editing });
      setNote("Kaydedildi. Ana sayfa yenilendiğinde görünür.");
      setEditing(null);
      reload();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Kaydedilemedi");
    }
  };

  const updateSetting = async (patch: Partial<AppSettings>) => {
    setSettings((s) => (s ? { ...s, ...patch } : s));
    await setSettingsFn({ data: patch });
  };

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-purple-500/20 bg-white/5 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h3 className="text-lg font-black">Ana Sayfa Düzenleyici</h3>
            <p className="text-xs text-white/55">
              Ana sayfada sadece buradaki şeritler, buradaki sırayla görünür. Boş şeritler gizlenir.
            </p>
          </div>
          <button
            onClick={() =>
              setEditing({ title: "", kind: "row", mode: "manual", display: "poster", rule: {}, maxItems: 40, enabled: true })
            }
            className="ml-auto flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-black text-white"
          >
            <Plus className="h-4 w-4" /> Yeni şerit
          </button>
        </div>

        {settings && (
          <div className="mt-4 flex flex-wrap gap-3 rounded-2xl border border-white/10 bg-black/40 p-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.scraperEnabled}
                onChange={(e) => updateSetting({ scraperEnabled: e.target.checked })}
              />
              Otomatik tarayıcı açık
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.autoPublish}
                onChange={(e) => updateSetting({ autoPublish: e.target.checked })}
              />
              Taranan yeni kayıtları onaysız yayına al
            </label>
            <span className="text-xs text-white/45">
              Kapalıyken yeni kayıtlar "Karantina & Onay" sekmesinde onayını bekler.
            </span>
          </div>
        )}
        {note && <div className="mt-3 text-sm text-purple-200">{note}</div>}
      </div>

      {loading && <div className="text-sm text-white/50">Yükleniyor…</div>}

      <div className="space-y-3">
        {rows.map((r, i) => (
          <div
            key={r.id}
            className={`rounded-2xl border p-4 transition ${
              r.enabled ? "border-white/10 bg-black/40 hover:border-purple-500/30" : "border-white/5 bg-black/10 opacity-60"
            }`}
          >
            <div className="flex flex-wrap items-center gap-3">
              {/* Position Badge & Reorder Controls */}
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-600/20 font-mono text-xs font-black text-purple-300">
                  #{i + 1}
                </span>
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="rounded p-1 hover:bg-white/15 disabled:opacity-25"
                    title="Yukarı Taşı"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === rows.length - 1}
                    className="rounded p-1 hover:bg-white/15 disabled:opacity-25"
                    title="Aşağı Taşı"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-black text-white">{r.title}</span>
                  {r.kind === "hero" && (
                    <span className="rounded-full bg-amber-500/25 px-2.5 py-0.5 text-[10px] font-black text-amber-300">
                      ÖNE ÇIKANLAR (HERO)
                    </span>
                  )}
                  {r.title.toLowerCase().includes("ulusal") && (
                    <span className="rounded-full bg-cyan-500/25 px-2.5 py-0.5 text-[10px] font-black text-cyan-300">
                      ULUSAL KANALLAR
                    </span>
                  )}
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/70">
                    {r.mode === "manual" ? "Elle seçim" : "Otomatik kural"}
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/70">
                    {r.items.length} öğe
                  </span>
                </div>
                <div className="mt-1 truncate text-xs text-white/50">
                  {r.mode === "rule" ? describeRule(r.rule) : r.items.slice(0, 6).map((s) => s.title).join(", ") || "Boş"}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {r.mode === "manual" && (
                  <button onClick={() => setItemsFor(r)} className="rounded-xl bg-cyan-500/25 px-3 py-2 text-xs font-black text-cyan-100 hover:bg-cyan-500/35">
                    İçerikleri seç
                  </button>
                )}
                <button onClick={() => setEditing({ ...toDraft(r), id: r.id })} className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black hover:bg-white/20">
                  Düzenle
                </button>
                <button onClick={() => toggle(r)} className="rounded-xl bg-white/10 p-2 hover:bg-white/20" title={r.enabled ? "Gizle" : "Göster"}>
                  {r.enabled ? <Eye className="h-4 w-4 text-emerald-400" /> : <EyeOff className="h-4 w-4 text-white/40" />}
                </button>
                <button onClick={() => remove(r)} className="rounded-xl bg-red-500/20 p-2 text-red-200 hover:bg-red-500/40" title="Sil">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <RowEditor draft={editing} setDraft={setEditing} facets={facets} onSave={save} onCancel={() => setEditing(null)} />
      )}
      {itemsFor && (
        <ItemsPicker
          row={itemsFor}
          facets={facets}
          onClose={() => {
            setItemsFor(null);
            reload();
          }}
        />
      )}
    </section>
  );
}

function toDraft(r: HomeRowWithItems): Draft {
  return {
    title: r.title,
    kind: r.kind,
    mode: r.mode,
    display: r.display,
    rule: r.rule || {},
    maxItems: r.maxItems,
    enabled: r.enabled,
  };
}

function describeRule(rule: HomeRowRule): string {
  const parts: string[] = [];
  if (rule.category) parts.push(CATS.find((c) => c.v === rule.category)?.l || rule.category);
  if (rule.country) parts.push(`Ülke: ${rule.country}`);
  if (rule.sub_category) parts.push(`Alt: ${rule.sub_category}`);
  if (rule.is_foreign === true) parts.push("Yabancı");
  if (rule.is_foreign === false) parts.push("Yerli");
  if (rule.search) parts.push(`"${rule.search}" geçenler`);
  return parts.join(" · ") || "Tüm aktif yayınlar";
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur">
      <div className="mt-10 w-full max-w-3xl rounded-3xl border border-purple-500/30 bg-slate-950 p-6">
        <div className="mb-4 flex items-center">
          <h3 className="text-lg font-black">{title}</h3>
          <button onClick={onClose} className="ml-auto rounded-xl bg-white/10 p-2">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function RowEditor({
  draft,
  setDraft,
  facets,
  onSave,
  onCancel,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  facets: Facets;
  onSave: () => void;
  onCancel: () => void;
}) {
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const setRule = (patch: Partial<HomeRowRule>) => set({ rule: { ...draft.rule, ...patch } });
  return (
    <Modal title={draft.id ? "Şeridi düzenle" : "Yeni şerit"} onClose={onCancel}>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="mb-1 block text-xs font-bold text-purple-200">Şerit adı</span>
          <input className={`${input} w-full`} value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="Örn: ATV Dizileri" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-purple-200">Yer</span>
          <select className={`${input} w-full`} value={draft.kind} onChange={(e) => set({ kind: e.target.value as Draft["kind"] })}>
            <option value="row">Normal şerit</option>
            <option value="hero">Üstteki büyük afiş (slider)</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-purple-200">Görünüm</span>
          <select className={`${input} w-full`} value={draft.display} onChange={(e) => set({ display: e.target.value as Draft["display"] })}>
            <option value="poster">Afiş kartı (dizi/film)</option>
            <option value="channel">Kanal logosu (canlı TV)</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-purple-200">İçerik nasıl seçilsin?</span>
          <select className={`${input} w-full`} value={draft.mode} onChange={(e) => set({ mode: e.target.value as Draft["mode"] })}>
            <option value="manual">Elle — ben tek tek seçeceğim</option>
            <option value="rule">Otomatik — kurala uyanlar girsin</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-purple-200">En fazla öğe</span>
          <input
            type="number"
            min={1}
            max={200}
            className={`${input} w-full`}
            value={draft.maxItems}
            onChange={(e) => set({ maxItems: Math.max(1, Math.min(200, Number(e.target.value) || 1)) })}
          />
        </label>
      </div>

      {draft.mode === "rule" && (
        <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-black/40 p-4 md:grid-cols-2">
          <div className="text-xs font-black uppercase tracking-widest text-purple-200 md:col-span-2">Kural</div>
          <label className="block">
            <span className="mb-1 block text-xs text-white/60">Kategori</span>
            <select className={`${input} w-full`} value={draft.rule.category || ""} onChange={(e) => setRule({ category: e.target.value || undefined })}>
              {CATS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-white/60">Ülke</span>
            <select className={`${input} w-full`} value={draft.rule.country || ""} onChange={(e) => setRule({ country: e.target.value || undefined })}>
              <option value="">Hepsi</option>
              {facets.countries.map((c) => <option key={c.value} value={c.value}>{c.value} ({c.n})</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-white/60">Alt kategori</span>
            <select className={`${input} w-full`} value={draft.rule.sub_category || ""} onChange={(e) => setRule({ sub_category: e.target.value || undefined })}>
              <option value="">Hepsi</option>
              {facets.subCategories.map((c) => <option key={c.value} value={c.value}>{c.value} ({c.n})</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-white/60">Yerli / Yabancı</span>
            <select
              className={`${input} w-full`}
              value={draft.rule.is_foreign === undefined ? "" : draft.rule.is_foreign ? "f" : "l"}
              onChange={(e) => setRule({ is_foreign: e.target.value === "" ? undefined : e.target.value === "f" })}
            >
              <option value="">Hepsi</option>
              <option value="l">Yerli</option>
              <option value="f">Yabancı</option>
            </select>
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1 block text-xs text-white/60">Adında geçen kelime (isteğe bağlı)</span>
            <input className={`${input} w-full`} value={draft.rule.search || ""} onChange={(e) => setRule({ search: e.target.value || undefined })} placeholder="Örn: TRT" />
          </label>
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold">Vazgeç</button>
        <button
          onClick={onSave}
          disabled={!draft.title.trim()}
          className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-black disabled:opacity-40"
        >
          <Save className="h-4 w-4" /> Kaydet
        </button>
      </div>
    </Modal>
  );
}

function ItemsPicker({ row, facets, onClose }: { row: HomeRowWithItems; facets: Facets; onClose: () => void }) {
  const searchFn = useServerFn(searchStreamsAdmin);
  const setItemsFn = useServerFn(setHomeRowItems);
  const [items, setItems] = useState<UserStream[]>(row.items);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [country, setCountry] = useState("");
  const [results, setResults] = useState<AdminStream[]>([]);
  const [busy, setBusy] = useState(false);

  const search = useCallback(async () => {
    const res = await searchFn({ data: { q: q || undefined, category: category || undefined, country: country || undefined, limit: 60 } });
    setResults(res.items);
  }, [searchFn, q, category, country]);

  useEffect(() => {
    const t = setTimeout(search, 250);
    return () => clearTimeout(t);
  }, [search]);

  const has = new Set(items.map((i) => i.id));
  const moveItem = (idx: number, dir: -1 | 1) => {
    const next = [...items];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setItems(next);
  };

  const save = async () => {
    setBusy(true);
    try {
      await setItemsFn({ data: { rowId: row.id, streamIds: items.map((i) => i.id) } });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`"${row.title}" içerikleri`} onClose={onClose}>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-2 text-xs font-black uppercase tracking-widest text-purple-200">Şeritteki sıra ({items.length})</div>
          <div className="max-h-[50vh] space-y-1 overflow-y-auto pr-1">
            {items.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2 rounded-xl bg-white/5 px-2 py-1.5 text-sm">
                <span className="w-6 text-right text-xs text-white/40">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{s.title}</span>
                <button onClick={() => moveItem(i, -1)} className="rounded p-1 hover:bg-white/10"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button onClick={() => moveItem(i, 1)} className="rounded p-1 hover:bg-white/10"><ArrowDown className="h-3.5 w-3.5" /></button>
                <button onClick={() => setItems(items.filter((x) => x.id !== s.id))} className="rounded p-1 text-red-300 hover:bg-white/10"><X className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            {items.length === 0 && <div className="text-xs text-white/40">Sağdan içerik ekle.</div>}
          </div>
        </div>
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-white/40" />
              <input className={`${input} w-full pl-8`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ara…" />
            </div>
            <select className={input} value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
            </select>
            <select className={`${input} w-full`} value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">Tüm ülkeler</option>
              {facets.countries.map((c) => <option key={c.value} value={c.value}>{c.value}</option>)}
            </select>
          </div>
          <div className="max-h-[50vh] space-y-1 overflow-y-auto pr-1">
            {results.map((s) => (
              <button
                key={s.id}
                disabled={has.has(s.id)}
                onClick={() => setItems([...items, s])}
                className="flex w-full items-center gap-2 rounded-xl bg-white/5 px-2 py-1.5 text-left text-sm hover:bg-purple-600/20 disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{s.title}</span>
                <span className="shrink-0 text-[10px] text-white/45">{s.country || "—"}{s.isActive ? "" : " · karantina (ana sayfada görünmez)"}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold">Vazgeç</button>
        <button onClick={save} disabled={busy} className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-black disabled:opacity-40">
          <Save className="h-4 w-4" /> Kaydet
        </button>
      </div>
    </Modal>
  );
}
