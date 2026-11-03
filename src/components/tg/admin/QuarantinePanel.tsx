import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Filter,
  Loader2,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  Undo2,
  X,
} from "lucide-react";

export type QuarantinedItem = {
  id: string;
  title: string;
  sourceUrl: string;
  category: string;
  subCategory?: string;
  country?: string;
  isForeign?: boolean;
  quarantineReason?: string;
  failureCount?: number;
  lastError?: string;
  posterUrl?: string;
  logoUrl?: string;
  lastCheckedAt?: string;
};

export function QuarantinePanel({ onChanged }: { onChanged?: () => void }) {
  const [items, setItems] = useState<QuarantinedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterReason, setFilterReason] = useState<string>("all");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [previewItem, setPreviewItem] = useState<QuarantinedItem | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const loadQuarantine = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/db/data");
      if (!res.ok) throw new Error("Veritabanı okunamadı");
      const db = await res.json();
      const streams = (db.user_streams || []) as any[];
      // Quarantined items: either is_active is explicitly false or quarantine_reason is non-null
      const quarantined = streams
        .filter((s) => s.is_active === false || Boolean(s.quarantine_reason))
        .map((s) => ({
          id: s.id,
          title: s.title || "İsimsiz",
          sourceUrl: s.source_url || "",
          category: s.category || "Live TV",
          subCategory: s.sub_category || undefined,
          country: s.country || undefined,
          isForeign: Boolean(s.is_foreign),
          quarantineReason: s.quarantine_reason || (s.failure_count > 0 ? "link_health_failed" : "manual"),
          failureCount: s.failure_count || 0,
          lastError: s.last_error || undefined,
          posterUrl: s.poster_url || s.logo_url || undefined,
          lastCheckedAt: s.last_checked_at || undefined,
        }));
      setItems(quarantined);
    } catch (e: any) {
      showToast(e.message || "Karantina listesi yüklenemedi", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuarantine();
  }, [loadQuarantine]);

  const handleAction = async (id: string, action: "approve" | "delete" | "unquarantine") => {
    setBusyAction(`${id}-${action}`);
    try {
      const res = await fetch("/api/quarantine/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "İşlem başarısız");

      setItems((prev) => prev.filter((i) => i.id !== id));
      showToast(
        action === "approve" || action === "unquarantine"
          ? "İçerik onaylandı ve ana sayfada yayına alındı!"
          : "İçerik sistemden tamamen kaldırıldı.",
      );
      onChanged?.();
    } catch (e: any) {
      showToast(e.message || "İşlem sırasında hata oluştu", "error");
    } finally {
      setBusyAction(null);
    }
  };

  const handleBulkAction = async (action: "approve_all" | "delete_all") => {
    if (items.length === 0) return;
    const confirmMsg =
      action === "approve_all"
        ? `Karantinadaki ${items.length} içeriğin tümü onaylanıp yayına alınsın mı?`
        : `Karantinadaki ${items.length} içerik kalıcı olarak silinsin mi?`;
    if (!confirm(confirmMsg)) return;

    setBusyAction(action);
    try {
      const res = await fetch("/api/quarantine/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids: items.map((i) => i.id) }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Toplu işlem başarısız");

      setItems([]);
      showToast(
        action === "approve_all"
          ? `${data.count || items.length} içerik onaylanıp yayına alındı!`
          : `${data.count || items.length} içerik kalıcı silindi.`,
      );
      onChanged?.();
    } catch (e: any) {
      showToast(e.message || "Hata oluştu", "error");
    } finally {
      setBusyAction(null);
    }
  };

  const handleRunHealthSweep = async () => {
    setBusyAction("sweep");
    try {
      const res = await fetch("/api/smart-tools/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "quarantine-sweep" }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Tarama başarısız");

      showToast(`Sağlık taraması tamamlandı: ${data.quarantined || 0} link karantinaya alındı.`);
      loadQuarantine();
      onChanged?.();
    } catch (e: any) {
      showToast(e.message || "Tarama hatası", "error");
    } finally {
      setBusyAction(null);
    }
  };

  const filtered = items.filter((item) => {
    const matchSearch =
      !search ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.sourceUrl.toLowerCase().includes(search.toLowerCase());
    const matchReason =
      filterReason === "all" ||
      (filterReason === "link_health_failed" && (item.quarantineReason === "link_health_failed" || (item.failureCount || 0) > 0)) ||
      (filterReason === "low_quality" && item.quarantineReason === "low_quality") ||
      (filterReason === "duplicate" && item.quarantineReason === "duplicate_merged") ||
      (filterReason === "manual" && (item.quarantineReason === "manual" || !item.quarantineReason));
    return matchSearch && matchReason;
  });

  const countHealthFailed = items.filter(
    (i) => i.quarantineReason === "link_health_failed" || (i.failureCount || 0) > 0,
  ).length;
  const countLowQuality = items.filter((i) => i.quarantineReason === "low_quality").length;
  const countDuplicate = items.filter((i) => i.quarantineReason === "duplicate_merged").length;
  const countManual = items.length - countHealthFailed - countLowQuality - countDuplicate;

  const reasonBadge = (reason?: string, fails?: number) => {
    if (reason === "link_health_failed" || (fails && fails > 0)) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/15 px-2.5 py-0.5 text-xs font-bold text-red-300">
          <AlertTriangle className="h-3 w-3" /> Bozuk Link ({fails || 1} hata)
        </span>
      );
    }
    if (reason === "low_quality") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-300">
          Düşük Çözünürlük
        </span>
      );
    }
    if (reason === "duplicate_merged") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/15 px-2.5 py-0.5 text-xs font-bold text-sky-300">
          Mükerrer Kopya
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/40 bg-purple-500/15 px-2.5 py-0.5 text-xs font-bold text-purple-300">
        Onay Bekliyor
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl px-5 py-3 shadow-2xl backdrop-blur transition-all ${
            toast.type === "success"
              ? "border border-emerald-500/50 bg-emerald-950/90 text-emerald-200"
              : "border border-red-500/50 bg-red-950/90 text-red-200"
          }`}
        >
          {toast.type === "success" ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          <span className="text-sm font-bold">{toast.text}</span>
        </div>
      )}

      {/* Header & Stats Banner */}
      <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-slate-900/60 to-purple-950/40 p-6 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-300">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Karantina & Onay Mekanizması</h2>
              <p className="text-xs text-white/60">
                Oynatılamayan, HTTP hatası veren veya yönetici onayı bekleyen engellenmiş içerikler.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRunHealthSweep}
              disabled={busyAction !== null}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-black hover:bg-amber-400 disabled:opacity-50"
            >
              {busyAction === "sweep" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Bozuk Linkleri Tara ve Karantinaya Al
            </button>
            <button
              onClick={() => handleBulkAction("approve_all")}
              disabled={items.length === 0 || busyAction !== null}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {busyAction === "approve_all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Tümünü Yayına Al ({items.length})
            </button>
            <button
              onClick={() => handleBulkAction("delete_all")}
              disabled={items.length === 0 || busyAction !== null}
              className="flex items-center gap-2 rounded-xl bg-red-600/80 px-4 py-2 text-xs font-black text-white hover:bg-red-600 disabled:opacity-50"
            >
              {busyAction === "delete_all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Tümünü Kalıcı Sil
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div
            onClick={() => setFilterReason("all")}
            className={`cursor-pointer rounded-2xl border p-3 transition ${
              filterReason === "all" ? "border-amber-500 bg-amber-500/15" : "border-white/10 bg-black/40 hover:bg-white/5"
            }`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">Toplam Karantinada</div>
            <div className="mt-1 text-2xl font-black text-amber-300">{items.length}</div>
          </div>
          <div
            onClick={() => setFilterReason("link_health_failed")}
            className={`cursor-pointer rounded-2xl border p-3 transition ${
              filterReason === "link_health_failed"
                ? "border-red-500 bg-red-500/15"
                : "border-white/10 bg-black/40 hover:bg-white/5"
            }`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-red-300/80">Bozuk Linkler</div>
            <div className="mt-1 text-2xl font-black text-red-400">{countHealthFailed}</div>
          </div>
          <div
            onClick={() => setFilterReason("low_quality")}
            className={`cursor-pointer rounded-2xl border p-3 transition ${
              filterReason === "low_quality"
                ? "border-amber-400 bg-amber-400/15"
                : "border-white/10 bg-black/40 hover:bg-white/5"
            }`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300/80">Düşük Kalite</div>
            <div className="mt-1 text-2xl font-black text-amber-400">{countLowQuality}</div>
          </div>
          <div
            onClick={() => setFilterReason("manual")}
            className={`cursor-pointer rounded-2xl border p-3 transition ${
              filterReason === "manual"
                ? "border-purple-400 bg-purple-400/15"
                : "border-white/10 bg-black/40 hover:bg-white/5"
            }`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-purple-300/80">Onay Bekleyen</div>
            <div className="mt-1 text-2xl font-black text-purple-300">{countManual}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Karantinadaki içeriklerde ara (başlık, URL)..."
            className="w-full rounded-xl border border-white/15 bg-black/50 py-2.5 pl-10 pr-4 text-sm text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "all", label: "Tümü" },
            { id: "link_health_failed", label: "Bozuk Linkler" },
            { id: "low_quality", label: "Düşük Kalite" },
            { id: "duplicate", label: "Mükerrer" },
            { id: "manual", label: "Bekleyenler" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterReason(f.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                filterReason === f.id
                  ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                  : "bg-white/10 text-white/70 hover:bg-white/15"
              }`}
            >
              {f.label}
            </button>
          ))}
          <button
            onClick={loadQuarantine}
            className="flex items-center gap-1 rounded-xl bg-white/10 p-2 text-white/70 hover:bg-white/20"
            title="Yenile"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* List / Table Component */}
      <div className="rounded-3xl border border-white/10 bg-black/40 p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-white/60">
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-amber-400" />
            <p className="text-sm">Karantinadaki içerikler yükleniyor...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-white/60">
            <CheckCircle2 className="mb-3 h-12 w-12 text-emerald-400/80" />
            <h3 className="text-base font-bold text-white">Karantinada İçerik Yok!</h3>
            <p className="mt-1 max-w-md text-xs text-white/50">
              Tüm yayınlar aktif ve onaylanmış durumda. Bozuk linkleri tespit etmek için yukarıdaki "Bozuk Linkleri Tara"
              butonuna tıklayabilirsiniz.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[11px] font-black uppercase tracking-wider text-white/40">
                  <th className="pb-3 pl-2">İçerik Başlığı</th>
                  <th className="pb-3">Kategori &amp; Ülke</th>
                  <th className="pb-3">Karantina Nedeni</th>
                  <th className="pb-3">Kaynak Adresi</th>
                  <th className="pb-3 pr-2 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((item) => {
                  const isBusyThis = busyAction?.startsWith(item.id);
                  return (
                    <tr key={item.id} className="transition hover:bg-white/[0.02]">
                      <td className="py-3.5 pl-2">
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-xl bg-white/10">
                            {item.posterUrl ? (
                              <img src={item.posterUrl} alt={item.title} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs font-black text-white/40">
                                TG
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 max-w-[260px]">
                            <div className="truncate font-black text-white">{item.title}</div>
                            {item.lastError && (
                              <div className="truncate text-[10px] text-red-300/80">{item.lastError}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 text-xs">
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-purple-300">{item.category}</span>
                          <span className="text-[10px] text-white/50">
                            {item.isForeign ? "🌍 Yabancı" : "🇹🇷 Türkiye"}
                            {item.subCategory ? ` · ${item.subCategory}` : ""}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5">{reasonBadge(item.quarantineReason, item.failureCount)}</td>

                      <td className="py-3.5 font-mono text-xs">
                        <div className="flex max-w-[260px] items-center gap-2">
                          <span className="truncate text-white/60">{item.sourceUrl}</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(item.sourceUrl);
                              showToast("Kaynak adresi panoya kopyalandı!");
                            }}
                            className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white"
                            title="Kopyala"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </td>

                      <td className="py-3.5 pr-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setPreviewItem(item)}
                            className="rounded-xl bg-white/10 px-2.5 py-1.5 text-xs font-bold text-white/80 hover:bg-white/20"
                            title="Önizle"
                          >
                            <Play className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleAction(item.id, "approve")}
                            disabled={isBusyThis}
                            className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-black text-white hover:bg-emerald-500 disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" /> Onayla
                          </button>
                          <button
                            onClick={() => handleAction(item.id, "unquarantine")}
                            disabled={isBusyThis}
                            className="flex items-center gap-1 rounded-xl bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/30 disabled:opacity-50"
                            title="Karantinadan çıkar"
                          >
                            <Undo2 className="h-3.5 w-3.5" /> Çıkar
                          </button>
                          <button
                            onClick={() => handleAction(item.id, "delete")}
                            disabled={isBusyThis}
                            className="rounded-xl bg-red-500/20 p-1.5 text-red-300 hover:bg-red-500/40 disabled:opacity-50"
                            title="Kalıcı Sil"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Video Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-white/20 bg-slate-950 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-white">{previewItem.title}</h3>
                <p className="truncate text-xs text-white/50">{previewItem.sourceUrl}</p>
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                className="rounded-full bg-white/10 p-2 text-white/80 hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
              <video
                src={`/api/public/stream-proxy?url=${encodeURIComponent(previewItem.sourceUrl)}`}
                controls
                autoPlay
                className="h-full w-full object-contain"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  handleAction(previewItem.id, "approve");
                  setPreviewItem(null);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white"
              >
                <Check className="h-4 w-4" /> Onayla ve Yayına Al
              </button>
              <button
                onClick={() => setPreviewItem(null)}
                className="rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white/70"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
