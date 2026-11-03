import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { RotateCcw, Trash2, Undo2 } from "lucide-react";
import {
  emptyExpiredTrash,
  listTrash,
  purgeTrashItem,
  restoreTrashItem,
  type TrashItem,
} from "@/lib/admin-ops.functions";

export function TrashPanel({ onChanged }: { onChanged?: () => void }) {
  const listFn = useServerFn(listTrash);
  const restoreFn = useServerFn(restoreTrashItem);
  const purgeFn = useServerFn(purgeTrashItem);
  const emptyFn = useServerFn(emptyExpiredTrash);

  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listFn());
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [listFn]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-rose-500/25 bg-slate-900/60 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-200">
            <Undo2 className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-rose-100">Geri Dönüşüm Kutusu</h3>
            <p className="text-xs text-white/60">
              Silinen kanal, dizi ve tohum kaynaklar 30 gün boyunca burada saklanır ve geri alınabilir.
            </p>
          </div>
        </div>
        <button
          onClick={async () => {
            if (confirm("Süresi dolan (30 gün+) kayıtlar kalıcı silinsin mi?")) {
              await emptyFn();
              refresh();
            }
          }}
          className="rounded-xl bg-white/5 px-3 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/15"
        >
          Süresi dolanları temizle
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5">
        <div className="border-b border-white/10 px-4 py-3 text-sm font-bold">Silinen kayıtlar ({items.length})</div>
        {loading ? (
          <div className="p-6 text-center text-white/60">Yükleniyor…</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-white/60">Geri dönüşüm kutusu boş.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {items.map((it) => (
              <div key={`${it.kind}-${it.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-bold text-white/90">
                    <span className="mr-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase text-white/60">
                      {it.kind === "stream" ? "yayın" : "tohum"}
                    </span>
                    {it.title}
                  </div>
                  <div className="mt-1 truncate text-[11px] text-white/50">{it.detail}</div>
                  <div className="mt-1 text-[10px] text-amber-300/80">
                    {new Date(it.deletedAt).toLocaleString("tr-TR")} · {it.daysLeft} gün sonra kalıcı silinir
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      await restoreFn({ data: { id: it.id, kind: it.kind } });
                      refresh();
                      onChanged?.();
                    }}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-500/90 px-3 py-2 text-xs font-black text-black"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Geri al
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm("Kalıcı silinsin mi? Bu geri alınamaz.")) {
                        await purgeFn({ data: { id: it.id, kind: it.kind } });
                        refresh();
                      }
                    }}
                    className="rounded-lg bg-white/5 p-2 hover:bg-red-500/20"
                  >
                    <Trash2 className="h-4 w-4 text-red-300" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
