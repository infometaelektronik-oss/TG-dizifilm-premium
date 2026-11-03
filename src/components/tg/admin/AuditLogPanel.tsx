import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { History, RefreshCw, Trash2 } from "lucide-react";
import { clearAuditLogs, listAuditLogs, type AuditRow } from "@/lib/admin-ops.functions";

const LEVEL_STYLE: Record<string, string> = {
  info: "border-sky-400/40 bg-sky-400/10 text-sky-200",
  success: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  warn: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  error: "border-red-400/40 bg-red-400/10 text-red-200",
};

export function AuditLogPanel() {
  const listFn = useServerFn(listAuditLogs);
  const clearFn = useServerFn(clearAuditLogs);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [level, setLevel] = useState("all");
  const [source, setSource] = useState("all");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listFn({ data: { level, source, limit: 150 } });
      setRows(res as AuditRow[]);
    } catch {
      try {
        const direct = await fetch("/api/audit-logs");
        if (direct.ok) {
          const data = await direct.json();
          setRows(data);
        } else {
          setRows([]);
        }
      } catch {
        setRows([]);
      }
    } finally {
      setLoading(false);
    }
  }, [listFn, level, source]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-cyan-500/25 bg-slate-900/60 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-200">
            <History className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-cyan-100">Sistem Log & Kazıma Geçmişi</h3>
            <p className="text-xs text-white/60">Otonom kazıyıcı işlemleri, eklenen/silinen kayıtlar ve hatalar.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs"
          >
            <option value="all">Tüm seviyeler</option>
            <option value="info">Bilgi</option>
            <option value="success">Başarılı</option>
            <option value="warn">Uyarı</option>
            <option value="error">Hata</option>
          </select>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs"
          >
            <option value="all">Tüm kaynaklar</option>
            <option value="scraper">Kazıyıcı</option>
            <option value="admin">Admin</option>
            <option value="system">Sistem</option>
          </select>
          <button onClick={refresh} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold">
            <RefreshCw className="h-3.5 w-3.5" /> Yenile
          </button>
          <button
            onClick={async () => {
              if (confirm("7 günden eski kayıtlar silinsin mi?")) {
                await clearFn();
                refresh();
              }
            }}
            className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/15"
          >
            <Trash2 className="h-3.5 w-3.5" /> Eskileri temizle
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        {loading ? (
          <div className="py-8 text-center text-white/60">Yükleniyor…</div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-white/60">Henüz kayıt yok. Kazıyıcı çalıştıkça burası dolacak.</div>
        ) : (
          <ol className="relative space-y-3 border-l border-white/10 pl-5">
            {rows.map((r) => (
              <li key={r.id} className="relative">
                <span className="absolute -left-[26px] top-2 h-2.5 w-2.5 rounded-full bg-cyan-400" />
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-[10px]">
                    <span className={`rounded border px-1.5 py-0.5 font-bold uppercase ${LEVEL_STYLE[r.level] ?? LEVEL_STYLE["info"]}`}>
                      {r.level}
                    </span>
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-white/60">{r.source}</span>
                    <span className="font-mono text-white/50">{r.action}</span>
                    <span className="ml-auto text-white/40">{new Date(r.created_at).toLocaleString("tr-TR")}</span>
                  </div>
                  <div className="mt-1.5 text-sm text-white/85">{r.message}</div>
                  {r.entity && (
                    <div className="mt-1 font-mono text-[10px] text-white/40">
                      {r.entity}{r.entity_id ? ` · ${r.entity_id.slice(0, 8)}` : ""}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
