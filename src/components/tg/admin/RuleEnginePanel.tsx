import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Trash2, Wand2, Zap } from "lucide-react";
import {
  applyRulesToExisting,
  deleteAutomationRule,
  listAutomationRules,
  saveAutomationRule,
  type RuleRow,
} from "@/lib/admin-ops.functions";

const FIELDS = [
  { id: "url", label: "URL" },
  { id: "title", label: "Başlık" },
  { id: "group", label: "Grup / Alt kategori" },
  { id: "any", label: "Herhangi biri" },
] as const;

const OPS = [
  { id: "contains", label: "içeriyorsa" },
  { id: "starts_with", label: "ile başlıyorsa" },
  { id: "ends_with", label: "ile bitiyorsa" },
  { id: "equals", label: "eşitse" },
  { id: "regex", label: "regex eşleşiyorsa" },
] as const;

const CATEGORIES = ["", "Series", "Movies", "Live TV", "Radio"];

type Draft = {
  name: string;
  matchField: (typeof FIELDS)[number]["id"];
  matchOperator: (typeof OPS)[number]["id"];
  matchValue: string;
  setCategory: string;
  setSubCategory: string;
  setCountry: string;
  setIsForeign: "" | "true" | "false";
  setIsActive: "" | "true" | "false";
  priority: number;
};

const emptyDraft: Draft = {
  name: "",
  matchField: "url",
  matchOperator: "contains",
  matchValue: "",
  setCategory: "",
  setSubCategory: "",
  setCountry: "",
  setIsForeign: "",
  setIsActive: "",
  priority: 100,
};

export function RuleEnginePanel() {
  const listFn = useServerFn(listAutomationRules);
  const saveFn = useServerFn(saveAutomationRule);
  const delFn = useServerFn(deleteAutomationRule);
  const applyFn = useServerFn(applyRulesToExisting);

  const [rules, setRules] = useState<RuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRules(await listFn());
    } finally {
      setLoading(false);
    }
  }, [listFn]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = async () => {
    if (!draft.name.trim() || !draft.matchValue.trim()) return;
    setBusy(true);
    setNote(null);
    try {
      await saveFn({
        data: {
          name: draft.name.trim(),
          matchField: draft.matchField,
          matchOperator: draft.matchOperator,
          matchValue: draft.matchValue.trim(),
          setCategory: draft.setCategory || null,
          setSubCategory: draft.setSubCategory || null,
          setCountry: draft.setCountry || null,
          setIsForeign: draft.setIsForeign === "" ? null : draft.setIsForeign === "true",
          setIsActive: draft.setIsActive === "" ? null : draft.setIsActive === "true",
          priority: draft.priority,
          enabled: true,
        },
      });
      setDraft(emptyDraft);
      setNote("Kural kaydedildi.");
      refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  const applyExisting = async () => {
    setBusy(true);
    try {
      const r = await applyFn();
      setNote(`Kurallar uygulandı: ${r.updated}/${r.scanned} kayıt güncellendi.`);
      refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Uygulanamadı");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-purple-500/25 bg-gradient-to-br from-purple-950/50 to-slate-900/60 p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/25 text-purple-200">
              <Wand2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-purple-100">Otomasyon Kuralları (Eğer / İse)</h3>
              <p className="text-xs text-white/60">
                Örnek: URL "atv.com.tr" içeriyorsa → Kategori: Dizi, Alt kategori: Türk Dizileri.
                Kurallar hem kazıyıcıya hem de mevcut kayıtlara uygulanabilir.
              </p>
            </div>
          </div>
          <button
            onClick={applyExisting}
            disabled={busy}
            className="flex items-center gap-2 rounded-2xl bg-purple-500 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Mevcut kayıtlara uygula
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Kural adı"
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
          />
          <select
            value={draft.matchField}
            onChange={(e) => setDraft({ ...draft, matchField: e.target.value as Draft["matchField"] })}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
          >
            {FIELDS.map((f) => (
              <option key={f.id} value={f.id}>EĞER {f.label}</option>
            ))}
          </select>
          <select
            value={draft.matchOperator}
            onChange={(e) => setDraft({ ...draft, matchOperator: e.target.value as Draft["matchOperator"] })}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
          >
            {OPS.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          <input
            value={draft.matchValue}
            onChange={(e) => setDraft({ ...draft, matchValue: e.target.value })}
            placeholder="Değer (örn. atv.com.tr)"
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
          />

          <select
            value={draft.setCategory}
            onChange={(e) => setDraft({ ...draft, setCategory: e.target.value })}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c ? `İSE Kategori: ${c}` : "İSE Kategori: değiştirme"}</option>
            ))}
          </select>
          <input
            value={draft.setSubCategory}
            onChange={(e) => setDraft({ ...draft, setSubCategory: e.target.value })}
            placeholder="İSE Alt kategori (örn. Türk Dizileri)"
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
          />
          <input
            value={draft.setCountry}
            onChange={(e) => setDraft({ ...draft, setCountry: e.target.value })}
            placeholder="İSE Ülke (örn. Türkiye)"
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-3 gap-2">
            <select
              value={draft.setIsForeign}
              onChange={(e) => setDraft({ ...draft, setIsForeign: e.target.value as Draft["setIsForeign"] })}
              className="rounded-xl border border-white/10 bg-black/40 px-2 py-2 text-xs"
            >
              <option value="">Yabancı: —</option>
              <option value="true">Yabancı: evet</option>
              <option value="false">Yabancı: hayır</option>
            </select>
            <select
              value={draft.setIsActive}
              onChange={(e) => setDraft({ ...draft, setIsActive: e.target.value as Draft["setIsActive"] })}
              className="rounded-xl border border-white/10 bg-black/40 px-2 py-2 text-xs"
            >
              <option value="">Yayın: —</option>
              <option value="true">Yayına al</option>
              <option value="false">Karantina</option>
            </select>
            <input
              type="number"
              value={draft.priority}
              onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) || 0 })}
              className="rounded-xl border border-white/10 bg-black/40 px-2 py-2 text-xs"
              title="Öncelik"
            />
          </div>
        </div>

        <button
          onClick={save}
          disabled={busy}
          className="mt-3 flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/15 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Kuralı Kaydet
        </button>
        {note && <div className="mt-3 text-xs text-emerald-300">{note}</div>}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5">
        <div className="border-b border-white/10 px-4 py-3 text-sm font-bold">Kurallar ({rules.length})</div>
        {loading ? (
          <div className="p-6 text-center text-white/60">Yükleniyor…</div>
        ) : rules.length === 0 ? (
          <div className="p-6 text-center text-white/60">Henüz kural yok.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {rules.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-bold text-white/90">{r.name}</div>
                  <div className="mt-1 truncate text-[11px] text-white/55">
                    EĞER <span className="text-purple-200">{r.match_field}</span>{" "}
                    {OPS.find((o) => o.id === r.match_operator)?.label ?? r.match_operator}{" "}
                    <span className="text-purple-200">"{r.match_value}"</span> İSE →{" "}
                    {[
                      r.set_category && `kategori: ${r.set_category}`,
                      r.set_sub_category && `alt: ${r.set_sub_category}`,
                      r.set_country && `ülke: ${r.set_country}`,
                      r.set_is_foreign !== null && `yabancı: ${r.set_is_foreign ? "evet" : "hayır"}`,
                      r.set_is_active !== null && (r.set_is_active ? "yayına al" : "karantina"),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  <div className="mt-1 text-[10px] text-white/40">
                    öncelik {r.priority} · {r.hit_count} eşleşme
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (confirm("Kural silinsin mi?")) {
                      await delFn({ data: { id: r.id } });
                      refresh();
                    }
                  }}
                  className="rounded-lg bg-white/5 p-2 hover:bg-red-500/20"
                >
                  <Trash2 className="h-4 w-4 text-red-300" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
