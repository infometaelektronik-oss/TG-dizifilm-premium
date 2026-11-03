import { useState } from "react";
import {
  AlertTriangle,
  Bot,
  Check,
  Copy,
  Film,
  Gauge,
  Loader2,
  Play,
  RotateCw,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react";

export function SmartToolsPanel({ onChanged }: { onChanged?: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [minHeight, setMinHeight] = useState(480);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const append = (line: string) =>
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${line}`, ...prev].slice(0, 50));

  const runBackendAction = async (key: string, payload: Record<string, unknown>): Promise<string> => {
    const res = await fetch("/api/smart-tools/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "İşlem başarısız oldu.");
    }
    if (Array.isArray(data.samples)) {
      data.samples.forEach((s: string) => append(`  ${s}`));
    }
    return data.summary || "İşlem başarıyla tamamlandı.";
  };

  const run = async (key: string, runner: () => Promise<string>) => {
    setBusy(key);
    try {
      append(`Başlatıldı: ${key}...`);
      const summary = await runner();
      append(summary);
      showToast(summary, "success");
      onChanged?.();
    } catch (e: any) {
      const err = e instanceof Error ? e.message : String(e);
      append(`Hata: ${err}`);
      showToast(err, "error");
    } finally {
      setBusy(null);
    }
  };

  const runAllSequential = async () => {
    setBusy("all");
    try {
      append("=== Tüm Akıllı Araçlar Başlatılıyor ===");
      showToast("Tüm akıllı araçlar sırayla çalıştırılıyor...", "success");

      // 1. AI Categorize
      append("1/5: AI Kanal & Kategori Ayrıştırma...");
      const r1 = await runBackendAction("ai-categorize", { action: "ai-categorize" });
      append(r1);

      // 2. Normalizer
      append("2/5: İsim Temizleme & Logo...");
      const r2 = await runBackendAction("normalize", { action: "normalize", limit: 60 });
      append(r2);

      // 3. Dedupe
      append("3/5: Mükerrer Birleştirici...");
      const r3 = await runBackendAction("dedupe", { action: "dedupe" });
      append(r3);

      // 4. Quality
      append("4/5: Kalite Filtresi...");
      const r4 = await runBackendAction("quality", { action: "quality", limit: 60, minHeight });
      append(r4);

      // 5. Self-heal
      append("5/5: Kendi Kendini Onaran Yayın...");
      const r5 = await runBackendAction("heal", { action: "heal" });
      append(r5);

      append("=== Tüm İşlemler Başarıyla Tamamlandı ===");
      showToast("Tüm akıllı optimizasyonlar başarıyla tamamlandı!", "success");
      onChanged?.();
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : String(e);
      append(`Toplu işlem kesildi: ${msg}`);
      showToast(msg, "error");
    } finally {
      setBusy(null);
    }
  };

  const cards = [
    {
      key: "ai-categorize",
      icon: Bot,
      title: "AI Kanal & Kategori Ayrıştırma",
      desc: "Türk/Ulusal kanalları yabancı kanallardan, Türk Haber kanallarını yabancı haberlerden kesin çizgilerle ayıklar.",
      color: "from-amber-950/70",
      border: "border-amber-500/40",
      button: "bg-amber-400 hover:bg-amber-300",
      action: async () => runBackendAction("ai-categorize", { action: "ai-categorize" }),
    },
    {
      key: "normalize",
      icon: Sparkles,
      title: "AI İsim Temizleme & Logolama",
      desc: "TR_ATV_1080p_v3 gibi karmaşık isimleri ATV HD şekline getirir, uygun logoyu otomatik eşler.",
      color: "from-fuchsia-950/60",
      border: "border-fuchsia-500/30",
      button: "bg-fuchsia-400 hover:bg-fuchsia-300",
      action: async () => runBackendAction("normalize", { action: "normalize", limit: 50 }),
    },
    {
      key: "heal",
      icon: Wrench,
      title: "Kendi Kendini Onaran Yayın",
      desc: "Patlamış yayınlar için diğer kaynaklardan çalışan alternatif adresi bulup ana yayına atar.",
      color: "from-emerald-950/60",
      border: "border-emerald-500/30",
      button: "bg-emerald-400 hover:bg-emerald-300",
      action: async () => runBackendAction("heal", { action: "heal" }),
    },
    {
      key: "dedupe",
      icon: Copy,
      title: "Mükerrer İçerik Birleştirici",
      desc: "Aynı isimli yayınları tek başlık altında toplar, diğerlerini yedek kaynak olarak bağlar.",
      color: "from-sky-950/60",
      border: "border-sky-500/30",
      button: "bg-sky-400 hover:bg-sky-300",
      action: async () => runBackendAction("dedupe", { action: "dedupe" }),
    },
    {
      key: "quality",
      icon: Gauge,
      title: "Kalite Ölçümü & Otomatik Filtre",
      desc: `Çözünürlük ve bit hızı test edilir; ${minHeight}p altındaki yayınlar otomatik karantinaya alınır.`,
      color: "from-rose-950/60",
      border: "border-rose-500/30",
      button: "bg-rose-400 hover:bg-rose-300",
      action: async () => runBackendAction("quality", { action: "quality", limit: 50, minHeight }),
    },
    {
      key: "meta",
      icon: Film,
      title: "Otomatik Meta-Veri (TMDB / AI)",
      desc: "Sadece ismi olan film ve dizilere kapak, konu, çıkış yılı, IMDB puanı ve oyuncu kadrosu ekler.",
      color: "from-violet-950/60",
      border: "border-violet-500/30",
      button: "bg-violet-400 hover:bg-violet-300",
      action: async () => runBackendAction("meta", { action: "meta" }),
    },
  ];

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

      {/* Header and Master Button */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-purple-500/30 bg-gradient-to-r from-purple-950/40 via-slate-900/60 to-indigo-950/40 p-6 backdrop-blur">
        <div>
          <h2 className="text-xl font-black text-white">Akıllı Optimizasyon & AI Araçları</h2>
          <p className="text-xs text-white/60">
            Tüm işlemler arka planda asenkron çalışır; arayüz donmaz ve anlık bildirimler üretir.
          </p>
        </div>

        <button
          onClick={runAllSequential}
          disabled={busy !== null}
          className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-purple-600/30 transition hover:opacity-95 active:scale-95 disabled:opacity-50"
        >
          {busy === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {busy === "all" ? "Optimize Ediliyor…" : "Tüm Araçları Sırayla Çalıştır"}
        </button>
      </div>

      {/* Tool Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const isThisBusy = busy === c.key || busy === "all";
          return (
            <div
              key={c.key}
              className={`flex flex-col justify-between rounded-3xl border ${c.border} bg-gradient-to-br ${c.color} to-slate-900/70 p-5 shadow-xl transition`}
            >
              <div>
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white">
                    <c.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-black text-white">{c.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-white/60">{c.desc}</p>
                  </div>
                </div>

                {c.key === "quality" && (
                  <div className="mt-4 flex items-center justify-between rounded-xl bg-black/40 px-3 py-2 text-xs text-white/70">
                    <span>Alt kalite sınırı</span>
                    <select
                      value={minHeight}
                      onChange={(e) => setMinHeight(Number(e.target.value))}
                      className="rounded-lg border border-white/10 bg-black/70 px-2 py-1 text-xs text-white outline-none"
                    >
                      {[360, 480, 720, 1080].map((h) => (
                        <option key={h} value={h}>
                          {h}p
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <button
                onClick={() => run(c.key, c.action)}
                disabled={busy !== null}
                className={`mt-5 flex w-full items-center justify-center gap-2 rounded-2xl ${c.button} py-2.5 text-xs font-black text-black transition active:scale-95 disabled:opacity-50`}
              >
                {isThisBusy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>İşleniyor…</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-black" />
                    <span>Çalıştır</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Live Log Terminal */}
      {log.length > 0 && (
        <div className="rounded-3xl border border-white/10 bg-black/60 p-5 font-mono text-xs shadow-2xl backdrop-blur">
          <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2">
            <span className="flex items-center gap-2 font-bold text-emerald-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Canlı Sistem Kaydı
            </span>
            <button
              onClick={() => setLog([])}
              className="text-[11px] text-white/40 hover:text-white"
            >
              Temizle
            </button>
          </div>
          <div className="max-h-60 space-y-1.5 overflow-y-auto pr-2 text-white/75">
            {log.map((l, i) => (
              <div key={i} className="leading-relaxed">
                {l}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
