import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Activity } from "lucide-react";
import { getSystemStatus } from "@/lib/link-check.functions";

function relativeTime(iso: string | null): string {
  if (!iso) return "henüz tarama yok";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "az önce";
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa önce`;
  return `${Math.floor(h / 24)} gün önce`;
}

/**
 * Profesyonel "Otonom Motor" durum rozeti.
 * Aktif kanal sayısı + son tarama zamanını kullanıcıya gösterir.
 */
export function SystemStatusBadge() {
  const fetchStatus = useServerFn(getSystemStatus);
  const [status, setStatus] = useState<{
    activeCount: number;
    quarantineCount: number;
    lastCheckAt: string | null;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => fetchStatus().then((s) => alive && setStatus(s)).catch(() => {});
    load();
    const t = setInterval(load, 5 * 60_000); // 5 dk SWR
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [fetchStatus]);

  if (!status) return null;

  return (
    <div className="hidden items-center gap-3 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 sm:flex">
      <span className="status-dot-live h-2 w-2 rounded-full bg-emerald-400" />
      <div className="flex flex-col leading-tight">
        <span className="font-orbitron text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200">
          Sistem · Güncel
        </span>
        <span className="text-[10px] text-white/55">
          {status.activeCount.toLocaleString("tr-TR")} kanal · {relativeTime(status.lastCheckAt)}
        </span>
      </div>
      <Activity className="ml-1 h-3.5 w-3.5 text-emerald-300" />
    </div>
  );
}
