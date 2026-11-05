import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Bot,
  CheckCircle2,
  Cpu,
  Film,
  Globe2,
  Layers,
  Loader2,
  Play,
  Plus,
  Power,
  Radio,
  RefreshCw,
  Send,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Tv,
  Zap,
} from "lucide-react";
import {
  addScraperSeed,
  bootstrapAndRun,
  deleteScraperSeed,
  listScraperSeeds,
  runAutonomousNow,
  toggleScraperSeed,
  type SeedRow,
} from "@/lib/autonomous.functions";

export function AutonomousPanel({ onChanged }: { onChanged?: () => void }) {
  const listFn = useServerFn(listScraperSeeds);
  const addFn = useServerFn(addScraperSeed);
  const delFn = useServerFn(deleteScraperSeed);
  const toggleFn = useServerFn(toggleScraperSeed);
  const runFn = useServerFn(runAutonomousNow);
  const bootstrapRunFn = useServerFn(bootstrapAndRun);

  const [seeds, setSeeds] = useState<SeedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [newHint, setNewHint] = useState("");

  // Core Stream Engine State
  const [coreApiUrl, setCoreApiUrl] = useState("");
  const [coreApiKey, setCoreApiKey] = useState("");
  const [coreAutoSync, setCoreAutoSync] = useState(true);
  const [coreSyncing, setCoreSyncing] = useState(false);
  const [coreSaved, setCoreSaved] = useState(false);
  const [coreStats, setCoreStats] = useState<any>(null);

  // Multi-Agent Network State (ChatGPT, Gemini, Claude)
  const [runningAgents, setRunningAgents] = useState(false);
  const [agentResults, setAgentResults] = useState<any>(null);

  // Telegram Settings State
  const [tgBotToken, setTgBotToken] = useState("");
  const [tgChatId, setTgChatId] = useState("");
  const [savingTg, setSavingTg] = useState(false);
  const [testingTg, setTestingTg] = useState(false);
  const [tgConfigured, setTgConfigured] = useState(false);

  // Media Crawler State (media_crawler.py integration)
  const [crawlInputMode, setCrawlInputMode] = useState<"url" | "raw">("url");
  const [crawlUrl, setCrawlUrl] = useState("");
  const [crawlRawText, setCrawlRawText] = useState("");
  const [crawlCategory, setCrawlCategory] = useState<"Live TV" | "Movies" | "Series" | "Radio">("Movies");
  const [crawlAutoImport, setCrawlAutoImport] = useState(true);
  const [crawling, setCrawling] = useState(false);
  const [crawlResults, setCrawlResults] = useState<any>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      setSeeds(await listFn());
    } finally {
      setLoading(false);
    }
  };

  const loadCoreConfig = async () => {
    try {
      const res = await fetch("/api/core-engine/config");
      if (res.ok) {
        const data = await res.json();
        setCoreApiUrl(data.apiUrl || "");
        setCoreApiKey(data.apiKey || "");
        setCoreAutoSync(data.autoSync !== false);
        if (data.lastStats) setCoreStats(data.lastStats);
      }
    } catch {
      // ignore
    }
  };

  const loadTgConfig = async () => {
    try {
      const res = await fetch("/api/autonomous/telegram-settings");
      if (res.ok) {
        const data = await res.json();
        setTgConfigured(Boolean(data.hasToken));
        setTgChatId(data.chatId || "");
        if (data.hasToken) setTgBotToken(data.botTokenMasked || "••••••••••••");
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    refresh();
    loadCoreConfig();
    loadTgConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const append = (line: string) =>
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${line}`, ...prev].slice(0, 30));

  // Multi-Agent Network Run
  const handleRunAgents = async () => {
    setRunningAgents(true);
    append("🤖 Çoklu Otonom Ajan Ağı (Gemini, Claude, ChatGPT) başlatılıyor…");
    try {
      const res = await fetch("/api/autonomous/run-agents", { method: "POST" });
      const data = await res.json();
      setAgentResults(data);
      if (data.ok) {
        append(`✓ Ajan Taraması Tamamlandı: ${data.totalIssuesFixed} problem otonom olarak giderildi.`);
        append(`📢 Telegram Raporu: "${data.telegramMessage}"`);
        onChanged?.();
      } else {
        append(`⚠ Ajan hatası: ${data.error || "Bilinmeyen hata"}`);
      }
    } catch (e: any) {
      append(`Ajan ağı bağlantı hatası: ${e.message}`);
    } finally {
      setRunningAgents(false);
    }
  };

  // Telegram Test Notification
  const handleSendTelegramTest = async () => {
    setTestingTg(true);
    append("✈️ Telegram özet raporu gönderiliyor…");
    try {
      const res = await fetch("/api/autonomous/telegram-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Ağa, programda yayın gecikmesi ve önbellek sıkıntısı vardı, Gemini Guardian tarafından çözüldü.",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        append(`✓ Telegram bildirimi başarıyla iletildi (${data.mode === "real" ? "Canlı Bot API" : "Simüle Edildi / Kaydedildi"}).`);
        append(`Rapor Formatı: "${data.message}"`);
      } else {
        append(`⚠ Telegram gönderim hatası: ${data.error || "İletilemedi"}`);
      }
    } catch (e: any) {
      append(`Telegram bağlantı hatası: ${e.message}`);
    } finally {
      setTestingTg(false);
    }
  };

  // Telegram Settings Save
  const handleSaveTelegramSettings = async () => {
    setSavingTg(true);
    try {
      const res = await fetch("/api/autonomous/telegram-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botToken: tgBotToken.includes("•") ? undefined : tgBotToken,
          chatId: tgChatId,
        }),
      });
      if (res.ok) {
        append("✓ Telegram Bot ayarları kaydedildi.");
        loadTgConfig();
      }
    } catch (e: any) {
      append(`Telegram ayar kaydetme hatası: ${e.message}`);
    } finally {
      setSavingTg(false);
    }
  };

  const handleSaveCoreConfig = async () => {
    try {
      const res = await fetch("/api/core-engine/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiUrl: coreApiUrl,
          apiKey: coreApiKey,
          autoSync: coreAutoSync,
        }),
      });
      if (res.ok) {
        setCoreSaved(true);
        append(`✓ Core Stream Engine API adresi kaydedildi: ${coreApiUrl || "(boş)"}`);
        setTimeout(() => setCoreSaved(false), 3000);
      }
    } catch (e: any) {
      append(`Kaydetme hatası: ${e.message}`);
    }
  };

  const handleSyncCoreEngine = async () => {
    if (!coreApiUrl.trim()) {
      append("⚠ Core Stream Engine API adresi boş. Lütfen önce API URL girin.");
      return;
    }
    setCoreSyncing(true);
    append(`⚡ Core Stream Engine ile canlı senkronizasyon başlatılıyor (${coreApiUrl})…`);
    try {
      const res = await fetch("/api/core-engine/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiUrl: coreApiUrl, apiKey: coreApiKey }),
      });
      const data = await res.json();
      if (data.ok) {
        setCoreStats(data.stats);
        append(
          `✓ Senkronizasyon başarılı: ${data.stats.remoteActive || 0} uzak akış sorgulandı, ${data.stats.synced || 0} yerel akış güncellendi.`
        );
        onChanged?.();
      } else {
        append(`⚠ Senkronizasyon hatası: ${data.error || "Bilinmeyen hata"}`);
      }
    } catch (e: any) {
      append(`Bağlantı hatası: ${e.message}`);
    } finally {
      setCoreSyncing(false);
    }
  };

  const handleRunCrawl = async () => {
    setCrawling(true);
    setCrawlResults(null);

    if (crawlInputMode === "raw") {
      if (!crawlRawText.trim()) {
        append("⚠ M3U veya link listesi metni boş. Lütfen aktarılacak içeriği yapıştırın.");
        setCrawling(false);
        return;
      }
      append(`📥 M3U / Akış Metni İçe Aktarılıyor (Kategori: ${crawlCategory})…`);
      try {
        const { importBackup } = await import("@/lib/admin-ops.functions");
        // We import the text directly
        const res = await fetch("/api/smart-tools/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "import-raw-m3u",
            content: crawlRawText,
            category: crawlCategory,
          }),
        });
        const data = await res.json();
        if (data.ok) {
          append(`✓ ${data.count || 0} adet medya içeriği başarıyla aktarıldı ve ana sayfa akışına bağlandı.`);
          onChanged?.();
        } else {
          append(`⚠ İçe aktarma hatası: ${data.error || "Bilinmeyen hata"}`);
        }
      } catch (e: any) {
        append(`İçe aktarma hatası: ${e.message}`);
      } finally {
        setCrawling(false);
      }
      return;
    }

    if (!crawlUrl.trim()) {
      append("⚠ Hedef web URL adresi boş. Lütfen taranacak bir sayfa veya akış adresi girin.");
      setCrawling(false);
      return;
    }

    append(`🕷️ Media Crawler başlatıldı: ${crawlUrl} (Kategori: ${crawlCategory})…`);
    try {
      const res = await fetch("/api/media-crawler/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: crawlUrl.trim(),
          category: crawlCategory,
          importToStreams: crawlAutoImport,
        }),
      });
      const data = await res.json();
      setCrawlResults(data);
      if (data.ok) {
        append(
          `✓ Media Crawler tamamlandı: ${data.media?.length || 0} medya akışı tespit edildi, ${data.importedCount || 0} yayın veritabanına aktarıldı.`
        );
        onChanged?.();
      } else {
        append(`⚠ Media Crawler hatası: ${data.errors?.[0]?.reason || data.error || "Akış bulunamadı."}`);
      }
    } catch (e: any) {
      append(`Crawler bağlantı hatası: ${e.message}`);
    } finally {
      setCrawling(false);
    }
  };

  const handleRun = async () => {
    setRunning(true);
    append("URL-Specter otonom tarama başlatıldı…");
    try {
      const res = await runFn({ data: { batchSize: 3 } });
      append(
        `Tamamlandı — ${res.processedSeeds} tohum işlendi, ${res.savedItems} yeni öğe karantinaya alındı, ${res.failed} hata.` +
          (res.savedItems === 0 && res.failed === 0 ? " Kaynaklardaki yayınlar zaten kayıtlı." : ""),
      );
      res.errors?.forEach((e) => append(`⚠ ${e}`));
      onChanged?.();
      refresh();
    } catch (e) {
      append(`Hata: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRunning(false);
    }
  };

  const handleBootstrap = async () => {
    setRunning(true);
    append("🌍 Kamuya açık Türkiye IPTV kaynakları ekleniyor + tam tarama başlıyor…");
    try {
      const res = await bootstrapRunFn({ data: undefined });
      append(
        `✓ ${res.bootstrapped} kaynak hazır · ${res.processedSeeds} tohum tarandı · ${res.savedItems} yeni yayın karantinada · ${res.failed} hata.` +
          (res.savedItems === 0 && res.failed === 0 ? " Yayınlar daha önce kaydedilmiş." : ""),
      );
      res.errors?.forEach((e) => append(`⚠ ${e}`));
      onChanged?.();
      refresh();
    } catch (e) {
      append(`Bootstrap hatası: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRunning(false);
    }
  };

  const handleAdd = async () => {
    if (!newUrl.trim()) return;
    try {
      await addFn({ data: { url: newUrl.trim(), hint: newHint.trim() || undefined, priority: 5 } });
      append(`Tohum eklendi: ${newUrl}`);
      setNewUrl("");
      setNewHint("");
      refresh();
    } catch (e) {
      append(`Ekleme hatası: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Autonomous Multi-Agent Network (ChatGPT, Gemini, Claude) */}
      <div className="rounded-3xl border border-purple-500/30 bg-gradient-to-br from-purple-950/70 via-slate-900/80 to-black p-5 shadow-2xl">
        <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/25 text-purple-300 ring-1 ring-purple-400/40">
              <Cpu className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-purple-100">Otonom Ajan Ağı & Self-Healing</h3>
                <span className="rounded-full bg-purple-500/20 px-2.5 py-0.5 text-[10px] font-bold text-purple-300 border border-purple-500/30">
                  Gemini + Claude + ChatGPT
                </span>
              </div>
              <p className="text-xs text-white/60">
                Arka planda çalışan yapay zekâ ağı, yayın kırılmalarını, şema uyumsuzluklarını ve mükerrer kayıtları
                kendi kendine onarır; Telegram üzerinden yöneticiye anlık özet raporlar gönderir.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRunAgents}
              disabled={runningAgents}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-purple-500 to-fuchsia-600 px-5 py-2.5 text-xs font-black text-white disabled:opacity-50 shadow-lg shadow-purple-500/20 hover:opacity-90 active:scale-95 transition"
            >
              {runningAgents ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {runningAgents ? "Ajanlar Tarıyor…" : "Ajan Ağını Çalıştır"}
            </button>
            <button
              onClick={handleSendTelegramTest}
              disabled={testingTg}
              className="flex items-center gap-2 rounded-2xl bg-sky-500/20 border border-sky-500/40 px-4 py-2.5 text-xs font-bold text-sky-200 hover:bg-sky-500/30 active:scale-95 transition"
              title="Ağa, programda şu sıkıntı vardı, şu ajan tarafından çözüldü."
            >
              {testingTg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span>Telegram Test Raporu</span>
            </button>
          </div>
        </div>

        {/* 3 Agents Badges */}
        <div className="grid gap-3 sm:grid-cols-3 pt-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-300">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Gemini Guardian</span>
            </div>
            <p className="mt-1 text-[11px] text-white/50">
              Yayın sağlığı, HLS/MP4 akış tipleri ve kırık link kontrolü sentineli.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
              <Layers className="h-4 w-4 text-cyan-400" />
              <span>Claude Code-Fixer</span>
            </div>
            <p className="mt-1 text-[11px] text-white/50">
              Veritabanı bütünlüğü, kategori ayrıştırması ve ana sayfa blok eşleşmesi.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span>ChatGPT Auto-Heal</span>
            </div>
            <p className="mt-1 text-[11px] text-white/50">
              Mükerrer yayınların ayıklanması, başlık gürültüsünün temizlenmesi.
            </p>
          </div>
        </div>

        {/* Telegram Configuration Drawer */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-3.5">
          <div className="flex items-center justify-between gap-3 text-xs mb-2">
            <span className="font-bold text-white/80">Telegram Bildirim Kanalı Ayarları</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tgConfigured ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>
              {tgConfigured ? "✓ Bot Aktif" : "Simüle Mod (Token Girilmedi)"}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1.5fr_1fr_auto]">
            <input
              type="password"
              value={tgBotToken}
              onChange={(e) => setTgBotToken(e.target.value)}
              placeholder="Telegram Bot Token (örn. 123456:ABC-DEF...)"
              className="rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs text-white"
            />
            <input
              value={tgChatId}
              onChange={(e) => setTgChatId(e.target.value)}
              placeholder="Chat / Kanal ID (örn. -100123456789)"
              className="rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs text-white"
            />
            <button
              onClick={handleSaveTelegramSettings}
              disabled={savingTg}
              className="rounded-xl bg-white/15 px-4 py-2 text-xs font-bold text-white hover:bg-white/20"
            >
              {savingTg ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Media Crawler Card (media_crawler.py Integration) */}
      <div className="rounded-3xl border border-sky-500/30 bg-gradient-to-br from-sky-950/70 via-slate-900/80 to-black p-5 shadow-2xl">
        <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/25 text-sky-300 ring-1 ring-sky-400/40">
              <Film className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-sky-100">Media Crawler & Film İçe Aktarma</h3>
                <span className="rounded-full bg-sky-500/20 px-2.5 py-0.5 text-[10px] font-bold text-sky-300 border border-sky-500/30">
                  media_crawler.py
                </span>
              </div>
              <p className="text-xs text-white/60">
                Tek bir film URL'si, doğrudan .m3u8/.mp4 adresi veya ham M3U listesi yapıştırın. Yapay zekâ kategorize
                eder, kapak görselini çeker ve anında ana sayfanızdaki "Filmler" ve "Popüler Diziler" satırlarına bağlar.
              </p>
            </div>
          </div>
          <button
            onClick={handleRunCrawl}
            disabled={crawling}
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 px-5 py-2.5 text-xs font-black text-black disabled:opacity-50 shadow-lg shadow-sky-500/20 hover:opacity-90 active:scale-95 transition"
          >
            {crawling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {crawling ? "İçerik Aktarılıyor…" : "Filmi / Akışı İçe Aktar"}
          </button>
        </div>

        {/* Input Mode Selector */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setCrawlInputMode("url")}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${crawlInputMode === "url" ? "bg-sky-500 text-black" : "bg-white/10 text-white/70 hover:bg-white/15"}`}
          >
            🌐 Web / Doğrudan Akış URL'si
          </button>
          <button
            onClick={() => setCrawlInputMode("raw")}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${crawlInputMode === "raw" ? "bg-sky-500 text-black" : "bg-white/10 text-white/70 hover:bg-white/15"}`}
          >
            📝 Ham M3U / Çoklu Link Metni
          </button>
        </div>

        {/* Category Selector Buttons */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-white/70 mr-1">Hedef Kategori:</span>
          {[
            { id: "Movies", label: "🎬 Film (Movies)", desc: "Ana sayfada 'Filmler' satırına eklenir" },
            { id: "Series", label: "🍿 Popüler Dizi (Series)", desc: "Ana sayfada 'Popüler Diziler' satırına eklenir" },
            { id: "Live TV", label: "📺 Canlı TV", desc: "Canlı TV listelerine eklenir" },
            { id: "Radio", label: "📻 Radyo", desc: "Radyo listelerine eklenir" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCrawlCategory(cat.id as any)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                crawlCategory === cat.id
                  ? "bg-purple-600 text-white ring-2 ring-purple-400/50 shadow-md"
                  : "bg-white/10 text-white/80 hover:bg-white/15"
              }`}
              title={cat.desc}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Inputs depending on mode */}
        {crawlInputMode === "url" ? (
          <div className="space-y-2">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                value={crawlUrl}
                onChange={(e) => setCrawlUrl(e.target.value)}
                placeholder="Film / Dizi Sayfa URL'si, katalog linki veya doğrudan .m3u8/.mp4 bağlantısı (https://...)"
                className="rounded-xl border border-sky-500/30 bg-black/60 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-xs font-medium text-white/80 cursor-pointer hover:bg-white/5">
                <input
                  type="checkbox"
                  checked={crawlAutoImport}
                  onChange={(e) => setCrawlAutoImport(e.target.checked)}
                  className="rounded accent-sky-500"
                />
                Doğrudan Yayına Al
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-white/50">
              <span className="font-semibold text-white/70">Hızlı Şablonlar:</span>
              <button
                type="button"
                onClick={() => {
                  setCrawlUrl("https://www.filmcehennemi.cx/izle/filmler?sayfa=1");
                  setCrawlCategory("Movies");
                }}
                className="rounded-lg bg-white/5 px-2 py-0.5 hover:bg-sky-500/20 hover:text-sky-300 transition"
              >
                🎬 FilmCehennemi Kataloğu
              </button>
              <button
                type="button"
                onClick={() => {
                  setCrawlUrl("https://www.kanald.com.tr/diziler?page=1");
                  setCrawlCategory("Series");
                }}
                className="rounded-lg bg-white/5 px-2 py-0.5 hover:bg-sky-500/20 hover:text-sky-300 transition"
              >
                🍿 Kanal D Popüler Diziler
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              value={crawlRawText}
              onChange={(e) => setCrawlRawText(e.target.value)}
              rows={4}
              placeholder="#EXTM3U veya her satırda bir film linki olacak şekilde yapıştırın..."
              className="w-full font-mono rounded-xl border border-sky-500/30 bg-black/60 p-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-white/50">
              <span className="font-semibold text-white/70">Örnek Şablon:</span>
              <button
                type="button"
                onClick={() => {
                  setCrawlRawText(
                    `#EXTM3U\n#EXTINF:-1 tvg-logo="https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600" group-title="Filmler",Dağ II (Full HD)\nhttps://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8\n#EXTINF:-1 tvg-logo="https://images.unsplash.com/photo-1485846234645-a62644f84728?w=600" group-title="Filmler",Ayla (Full HD)\nhttps://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8`
                  );
                  setCrawlCategory("Movies");
                }}
                className="rounded-lg bg-white/5 px-2 py-0.5 hover:bg-sky-500/20 hover:text-sky-300 transition"
              >
                📋 Örnek Film Listesi Yapıştır
              </button>
            </div>
          </div>
        )}

        {/* Discovered Media Candidates */}
        {crawlResults && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-4">
            <div className="flex items-center justify-between gap-3 text-xs border-b border-white/10 pb-2.5 mb-2.5">
              <span className="font-bold text-sky-300">
                Keşif Sonucu: {crawlResults.media?.length || 0} Medya Akışı ({crawlResults.importedCount || 0} Yayına Alındı)
              </span>
              <span className="text-[11px] text-white/40">Sayfa Sayısı: {crawlResults.pages_visited || 1}</span>
            </div>

            {crawlResults.media && crawlResults.media.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {crawlResults.media.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 p-2.5 text-xs">
                    <div className="truncate flex-1">
                      <span className="mr-2 rounded px-1.5 py-0.5 text-[10px] font-mono bg-sky-500/20 text-sky-300 uppercase">
                        {item.kind}
                      </span>
                      <span className="font-bold text-white mr-2">{item.title || "Film / Akış"}</span>
                      <span className="font-mono text-white/60">{item.url}</span>
                    </div>
                    {item.drm_detected && (
                      <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[10px] text-rose-300 font-bold">
                        DRM
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-white/50 py-2">
                Bu sayfada doğrudan medya akışı bulunamadı veya sayfa erişim koruması uyguluyor.
              </p>
            )}
          </div>
        )}
      </div>

      {/* 3. Core Stream Engine Card */}
      <div className="rounded-3xl border border-purple-500/30 bg-gradient-to-br from-purple-950/60 via-slate-900/60 to-black p-5 shadow-2xl">
        <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/20 text-purple-300 ring-1 ring-purple-400/30">
              <Server className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-purple-100">Core Stream Engine Bağlantısı</h3>
                <span className="rounded-full bg-purple-500/20 px-2.5 py-0.5 text-[10px] font-bold text-purple-300 border border-purple-500/30">
                  guncelmis yeni dosya.py
                </span>
              </div>
              <p className="text-xs text-white/60">
                Harici HLS/TS çekirdek motoru ile iki yönlü canlı senkronizasyon ve akış sağlık takibi.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncCoreEngine}
              disabled={coreSyncing}
              className="flex items-center gap-2 rounded-2xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50 hover:bg-purple-500 active:scale-95"
            >
              <RefreshCw className={`h-4 w-4 ${coreSyncing ? "animate-spin" : ""}`} />
              {coreSyncing ? "Senkronize Ediliyor…" : "Şimdi Senkronize Et"}
            </button>
            <button
              onClick={handleSaveCoreConfig}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/10"
            >
              {coreSaved ? "Kaydedildi ✓" : "Ayarları Kaydet"}
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1.5fr_1fr_auto]">
          <input
            value={coreApiUrl}
            onChange={(e) => setCoreApiUrl(e.target.value)}
            placeholder="Core Engine API URL (örn: http://localhost:8080)"
            className="rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs text-white"
          />
          <input
            type="password"
            value={coreApiKey}
            onChange={(e) => setCoreApiKey(e.target.value)}
            placeholder="API Güvenlik Anahtarı (Opsiyonel)"
            className="rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs text-white"
          />
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-xs font-medium text-white/80 cursor-pointer">
            <input
              type="checkbox"
              checked={coreAutoSync}
              onChange={(e) => setCoreAutoSync(e.target.checked)}
              className="rounded accent-purple-500"
            />
            Oto Senk
          </label>
        </div>
      </div>

      {/* 4. URL-Specter Scraper */}
      <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/60 to-slate-900/60 p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/25 text-emerald-200">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-emerald-100">Tam Otonom Sistem (URL-Specter)</h3>
              <p className="text-xs text-white/60">
                Sistem tohum URL'leri otomatik tarar, Chrome kamuflajıyla indirir, M3U/HLS/MP4 adaylarını çıkarır.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={handleBootstrap}
              disabled={running}
              className="flex items-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 font-black text-black disabled:opacity-50"
              title="Kamuya açık Türkiye IPTV kaynaklarını ekle ve hemen tara"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe2 className="h-4 w-4" />}
              🌍 Otomatik Kaynak Bul & Tara
            </button>
            <button
              onClick={handleRun}
              disabled={running}
              className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 font-black text-black disabled:opacity-50"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {running ? "Taranıyor…" : "Şimdi Tara"}
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_200px_auto]">
          <input
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="Yeni tohum URL (https://…)"
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
          />
          <input
            value={newHint}
            onChange={(e) => setNewHint(e.target.value)}
            placeholder="İpucu (opsiyonel)"
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
          />
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/15 text-white"
          >
            <Plus className="h-4 w-4" /> Tohum Ekle
          </button>
        </div>
      </div>

      {/* Log */}
      {log.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-black/60 p-4 font-mono text-xs">
          <div className="mb-2 flex items-center gap-2 text-emerald-300">
            <Play className="h-3 w-3" /> Canlı Kayıt
          </div>
          <div className="max-h-48 space-y-1 overflow-auto">
            {log.map((l, i) => (
              <div key={i} className="text-white/70">
                {l}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seeds list */}
      <div className="rounded-2xl border border-white/10 bg-white/5">
        <div className="border-b border-white/10 px-4 py-3 text-sm font-bold text-white">
          Tohum URL'ler ({seeds.length})
        </div>
        {loading ? (
          <div className="p-6 text-center text-white/60">Yükleniyor…</div>
        ) : seeds.length === 0 ? (
          <div className="p-6 text-center text-white/60">Henüz tohum yok. Yukarıdan ekle.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {seeds.map((s) => (
              <div
                key={s.id}
                className={`grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 text-sm ${s.disabled ? "opacity-50" : ""}`}
              >
                <div className="min-w-0">
                  <div className="truncate font-mono text-xs text-white/90">{s.url}</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-white/50">
                    {s.hint && <span className="rounded bg-white/5 px-1.5 py-0.5">{s.hint}</span>}
                    {s.force_category && (
                      <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-purple-200">
                        {s.force_category}
                      </span>
                    )}
                    <span>öncelik {s.priority}</span>
                    <span className="text-emerald-300">✓ {s.success_count}</span>
                    <span className="text-red-300">✗ {s.failure_count}</span>
                    {s.last_scanned_at && <span>son: {new Date(s.last_scanned_at).toLocaleString()}</span>}
                    {s.last_error && <span className="text-red-300">hata: {s.last_error.slice(0, 60)}</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={async () => {
                      await toggleFn({ data: { id: s.id, disabled: !s.disabled } });
                      refresh();
                    }}
                    className="rounded-lg bg-white/5 p-2 hover:bg-white/10"
                    title={s.disabled ? "Etkinleştir" : "Devre dışı"}
                  >
                    <Power className={`h-4 w-4 ${s.disabled ? "text-white/40" : "text-emerald-300"}`} />
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm("Sil?")) {
                        await delFn({ data: { id: s.id } });
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
