import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Database, Gauge, RefreshCw, Wifi } from "lucide-react";
import { getSystemLoad, type SystemLoad } from "@/lib/admin-ops.functions";

function bytesLabel(n: number) {
  if (n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(1)} ${units[i]}`;
}

function Metric({
  icon,
  label,
  value,
  sub,
  tone = "cyan",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "cyan" | "emerald" | "amber" | "rose";
}) {
  const tones: Record<string, string> = {
    cyan: "border-cyan-500/25 text-cyan-200",
    emerald: "border-emerald-500/25 text-emerald-200",
    amber: "border-amber-500/25 text-amber-200",
    rose: "border-rose-500/25 text-rose-200",
  };
  return (
    <div className={`rounded-2xl border bg-slate-900/60 p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider opacity-80">
        {icon} {label}
      </div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-white/50">{sub}</div>}
    </div>
  );
}

export function MonitorPanel() {
  const loadFn = useServerFn(getSystemLoad);
  const [data, setData] = useState<SystemLoad | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadFn());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [loadFn]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-emerald-500/25 bg-slate-900/60 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-200">
            <Gauge className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-emerald-100">Sistem Kaynak & Bant Genişliği İzleme</h3>
            <p className="text-xs text-white/60">Veritabanı yükü, proxy trafiği ve son 24 saatlik API kullanımı.</p>
          </div>
        </div>
        <button onClick={refresh} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Yenile
        </button>
      </div>

      {!data ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
          {loading ? "Metrikler yükleniyor…" : "Metrikler alınamadı."}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              icon={<Activity className="h-3.5 w-3.5" />}
              label="Yayındaki içerik"
              value={data.streams.active.toLocaleString("tr-TR")}
              sub={`${data.streams.quarantine.toLocaleString("tr-TR")} karantinada · toplam ${data.streams.total.toLocaleString("tr-TR")}`}
              tone="emerald"
            />
            <Metric
              icon={<Database className="h-3.5 w-3.5" />}
              label="Veritabanı gecikmesi"
              value={`${data.dbLatencyMs} ms`}
              sub={`${data.streams.trashed} kayıt geri dönüşümde`}
              tone="cyan"
            />
            <Metric
              icon={<Wifi className="h-3.5 w-3.5" />}
              label="Proxy trafiği (24s)"
              value={data.proxy24h.requests.toLocaleString("tr-TR")}
              sub={`${bytesLabel(data.proxy24h.bytes)} bant genişliği`}
              tone="amber"
            />
            <Metric
              icon={<Gauge className="h-3.5 w-3.5" />}
              label="Log olayları (24s)"
              value={data.logs24h.total.toLocaleString("tr-TR")}
              sub={`${data.logs24h.errors} hata · ${data.logs24h.warns} uyarı`}
              tone={data.logs24h.errors > 0 ? "rose" : "cyan"}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 text-sm font-bold">Kazıyıcı kaynakları</div>
              <Bar label="Aktif tohum" value={data.seeds.total - data.seeds.disabled} max={Math.max(1, data.seeds.total)} tone="bg-emerald-400" />
              <Bar label="Devre dışı" value={data.seeds.disabled} max={Math.max(1, data.seeds.total)} tone="bg-white/30" />
              <Bar label="Hata veren" value={data.seeds.failing} max={Math.max(1, data.seeds.total)} tone="bg-rose-400" />
              <div className="mt-3 text-[11px] text-white/50">
                Son tarama: {data.latestScanAt ? new Date(data.latestScanAt).toLocaleString("tr-TR") : "henüz yok"}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 text-sm font-bold">İçerik havuzu dağılımı</div>
              <Bar label="Yayında" value={data.streams.active} max={Math.max(1, data.streams.total)} tone="bg-emerald-400" />
              <Bar label="Karantina" value={data.streams.quarantine} max={Math.max(1, data.streams.total)} tone="bg-amber-400" />
              <Bar label="Çöp kutusu" value={data.streams.trashed} max={Math.max(1, data.streams.total)} tone="bg-rose-400" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Bar({ label, value, max, tone }: { label: string; value: number; max: number; tone: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="mb-2">
      <div className="mb-1 flex justify-between text-[11px] text-white/60">
        <span>{label}</span>
        <span>{value.toLocaleString("tr-TR")} ({pct}%)</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
