import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Save } from "lucide-react";
import { listLayoutSections, saveLayoutSections, type LayoutSection } from "@/lib/smart-admin.functions";

export function LayoutBuilderPanel() {
  const listFn = useServerFn(listLayoutSections);
  const saveFn = useServerFn(saveLayoutSections);
  const [sections, setSections] = useState<LayoutSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setSections(await listFn());
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const move = (index: number, dir: -1 | 1) => {
    setSections((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((s, i) => ({ ...s, position: i }));
    });
  };

  const save = async () => {
    setSaving(true);
    setNote("");
    try {
      await saveFn({
        data: {
          sections: sections.map((s, i) => ({ id: s.id, position: i, enabled: s.enabled, title: s.title })),
        },
      });
      setNote("Ana sayfa düzeni kaydedildi. Ziyaretçiler yenilediğinde yeni sıralamayı görecek.");
    } catch (e) {
      setNote(`Hata: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-white/60">
        <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div>
          <h3 className="text-base font-black">Canlı Görsel Düzenleyici</h3>
          <p className="text-xs text-white/60">Ana sayfadaki şeritlerin sırasını, adını ve görünürlüğünü buradan yönet.</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 rounded-2xl bg-purple-400 px-5 py-2.5 text-sm font-black text-black disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Kaydet
        </button>
      </div>

      {note && <div className="rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-xs text-white/70">{note}</div>}

      <div className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/5">
        {sections.map((s, i) => (
          <div key={s.id} className={`flex items-center gap-3 p-3 ${s.enabled ? "" : "opacity-50"}`}>
            <span className="w-6 text-center text-xs text-white/40">{i + 1}</span>
            <input
              value={s.title}
              onChange={(e) =>
                setSections((prev) => prev.map((p) => (p.id === s.id ? { ...p, title: e.target.value } : p)))
              }
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
            />
            <span className="hidden rounded bg-white/5 px-2 py-1 text-[10px] text-white/50 sm:block">{s.key}</span>
            <button
              onClick={() => setSections((prev) => prev.map((p) => (p.id === s.id ? { ...p, enabled: !p.enabled } : p)))}
              className="rounded-lg bg-white/5 p-2 hover:bg-white/10"
            >
              {s.enabled ? <Eye className="h-4 w-4 text-emerald-300" /> : <EyeOff className="h-4 w-4 text-white/40" />}
            </button>
            <button onClick={() => move(i, -1)} className="rounded-lg bg-white/5 p-2 hover:bg-white/10">
              <ArrowUp className="h-4 w-4" />
            </button>
            <button onClick={() => move(i, 1)} className="rounded-lg bg-white/5 p-2 hover:bg-white/10">
              <ArrowDown className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
