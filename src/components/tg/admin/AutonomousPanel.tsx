import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bot, CheckCircle2, Film, Globe2, Layers, Loader2, Play, Plus, Power, Radio, RefreshCw, Server, Sparkles, Trash2, Tv, Zap } from "lucide-react";
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

  // Media Crawler State (media_crawler.py integration)
  const [crawlUrl, setCrawlUrl] = useState("");
  const [crawlCategory, setCrawlCategory] = useState<"Live TV" | "Movies" | "Series" | "Radio">("Live TV");
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

  useEffect(() => {
    refresh();
    loadCoreConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const append = (line: string) => setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${line}`, ...prev].slice(0, 30));

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
    append("⚡ Core Stream Engine otonom veri senkronizasyonu başlatıldı…");
    try {
      // First save current config
      await handleSaveCoreConfig();
      const res = await fetch("/api/core-engine/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiUrl: coreApiUrl, apiKey: coreApiKey }),
      });
      const data = await res.json();
      if (data.ok) {
        setCoreStats(data);
        append(
          `✓ Senkronizasyon başarılı: ${data.totalFetched} öğe çekildi, ${data.newOrUpdated} içerik güncellendi. ` +
          `(Canlı TV: ${data.categories?.liveTv || 0}, Dizi: ${data.categories?.series || 0}, Film: ${data.categories?.movies || 0}, Radyo: ${data.categories?.radio || 0})`
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
    if (!crawlUrl.trim()) {
      append("⚠ Hedef web URL adresi boş. Lütfen taranacak bir sayfa adresi girin.");
      return;
    }
    setCrawling(true);
    setCrawlResults(null);
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
      await addFn({ data: { url: newUrl.trim(), hint: newHint.trim() || undefined } });
      setNewUrl(""); setNewHint("");
      append(`Tohum eklendi: ${newUrl}`);
      refresh();
    } catch (e) {
      append(`Ekleme hatası: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="space-y-5">
      {/* Core Stream Engine Card */}
      <div className="rounded-3xl border border-violet-500/30 bg-gradient-to-br from-violet-950/70 via-slate-900/80 to-black p-5 shadow-2xl">
        <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/25 text-violet-300 ring-1 ring-violet-400/40">
              <Server className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-violet-100">Core Stream Engine API</h3>
                <span className="rounded-full bg-violet-500/20 px-2.5 py-0.5 text-[10px] font-bold text-violet-300 border border-violet-500/30">
                  Otonom Entegrasyon
                </span>
              </div>
              <p className="text-xs text-white/60">
                Core Stream Engine API adresini bir kez tanımlayın. Aktif ve onaylanmış canlı TV, radyo, dizi ve film içerikleri
                otonom olarak türlerine (Drama, Bilim Kurgu vb.) göre ayrıştırılarak arka planda kesintisiz güncellenir.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveCoreConfig}
              className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/15 border border-white/15"
            >
              {coreSaved ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Sparkles className="h-4 w-4 text-violet-400" />}
              {coreSaved ? "Kaydedildi" : "Ayarları Kaydet"}
            </button>
            <button
              onClick={handleSyncCoreEngine}
              disabled={coreSyncing}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-2.5 text-xs font-black text-white disabled:opacity-50 shadow-lg shadow-violet-500/20 hover:opacity-90"
            >
              {coreSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {coreSyncing ? "Senkronize Ediliyor…" : "Şimdi Senkronize Et"}
            </button>
          </div>
        </div>

        {/* Form Inputs */}
        <div className="grid gap-3 sm:grid-cols-[1.5fr_1fr_auto]">
          <input
            value={coreApiUrl}
            onChange={(e) => setCoreApiUrl(e.target.value)}
            placeholder="Core Stream Engine API URL (https://api.example.com/streams)"
            className="rounded-xl border border-violet-500/30 bg-black/50 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-400"
          />
          <input
            value={coreApiKey}
            onChange={(e) => setCoreApiKey(e.target.value)}
            placeholder="API Anahtarı / Bearer Token (opsiyonel)"
            type="password"
            className="rounded-xl border border-white/10 bg-black/50 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-400"
          />
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-medium text-white/80 cursor-pointer hover:bg-white/5">
            <input
              type="checkbox"
              checked={coreAutoSync}
              onChange={(e) => setCoreAutoSync(e.target.checked)}
              className="rounded accent-violet-500"
            />
            Otomatik Güncelle (30 dk)
          </label>
        </div>

        {/* Stats & Genres summary */}
        {coreStats && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-white/80">
                  <Tv className="h-3.5 w-3.5 text-emerald-400" /> Canlı TV: <b className="text-white">{coreStats.categories?.liveTv || 0}</b>
                </span>
                <span className="flex items-center gap-1.5 text-white/80">
                  <Film className="h-3.5 w-3.5 text-amber-400" /> Filmler: <b className="text-white">{coreStats.categories?.movies || 0}</b>
                </span>
                <span className="flex items-center gap-1.5 text-white/80">
                  <Layers className="h-3.5 w-3.5 text-sky-400" /> Diziler: <b className="text-white">{coreStats.categories?.series || 0}</b>
                </span>
                <span className="flex items-center gap-1.5 text-white/80">
                  <Radio className="h-3.5 w-3.5 text-fuchsia-400" /> Radyo: <b className="text-white">{coreStats.categories?.radio || 0}</b>
                </span>
              </div>
              <span className="text-[11px] text-white/40">
                Son Senkronizasyon: {new Date(coreStats.lastSynced).toLocaleTimeString()}
              </span>
            </div>

            {/* Genre tags */}
            {coreStats.genres && Object.keys(coreStats.genres).length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5 pt-2 border-t border-white/5">
                {Object.entries(coreStats.genres).map(([genre, count]) => (
                  <span
                    key={genre}
                    className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-0.5 text-[10px] text-white/70"
                  >
                    <span>{genre}</span>
                    <span className="font-mono text-violet-300 font-bold">{count as number}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Media Crawler Card (media_crawler.py Integration) */}
      <div className="rounded-3xl border border-sky-500/30 bg-gradient-to-br from-sky-950/70 via-slate-900/80 to-black p-5 shadow-2xl">
        <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/25 text-sky-300 ring-1 ring-sky-400/40">
              <Globe2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-sky-100">Media Crawler (Sayfa & Akış Analizi)</h3>
                <span className="rounded-full bg-sky-500/20 px-2.5 py-0.5 text-[10px] font-bold text-sky-300 border border-sky-500/30">
                  media_crawler.py
                </span>
              </div>
              <p className="text-xs text-white/60">
                Hedef bir web adresi veya manifest URL'si girin. Sayfa içi .m3u8, .mp4 ve .mpd akış adayları taranır,
                DRM koruması kontrol edilir ve doğrudan yayın veritabanınıza aktarılır.
              </p>
            </div>
          </div>
          <button
            onClick={handleRunCrawl}
            disabled={crawling}
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-500 px-5 py-2.5 text-xs font-black text-black disabled:opacity-50 shadow-lg shadow-sky-500/20 hover:opacity-90"
          >
            {crawling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {crawling ? "Analiz Ediliyor…" : "Sayfayı Keşfet & İçe Aktar"}
          </button>
        </div>

        {/* Inputs */}
        <div className="grid gap-3 sm:grid-cols-[1.5fr_140px_auto]">
          <input
            value={crawlUrl}
            onChange={(e) => setCrawlUrl(e.target.value)}
            placeholder="Taranacak Web / Akış URL (https://...)"
            className="rounded-xl border border-sky-500/30 bg-black/50 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-400"
          />
          <select
            value={crawlCategory}
            onChange={(e) => setCrawlCategory(e.target.value as any)}
            className="rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-400"
          >
            <option value="Live TV">Canlı TV</option>
            <option value="Movies">Film</option>
            <option value="Series">Dizi</option>
            <option value="Radio">Radyo</option>
          </select>
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-medium text-white/80 cursor-pointer hover:bg-white/5">
            <input
              type="checkbox"
              checked={crawlAutoImport}
              onChange={(e) => setCrawlAutoImport(e.target.checked)}
              className="rounded accent-sky-500"
            />
            Otomatik Yayına Al
          </label>
        </div>

        {/* Discovered Media Candidates */}
        {crawlResults && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-4">
            <div className="flex items-center justify-between gap-3 text-xs border-b border-white/10 pb-2.5 mb-2.5">
              <span className="font-bold text-sky-300">
                Keşif Sonucu: {crawlResults.media?.length || 0} Medya Akışı ({crawlResults.importedCount || 0} Aktarıldı)
              </span>
              <span className="text-[11px] text-white/40">
                Sayfa Sayısı: {crawlResults.pages_visited || 1}
              </span>
            </div>

            {crawlResults.media && crawlResults.media.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {crawlResults.media.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 p-2.5 text-xs">
                    <div className="truncate flex-1">
                      <span className="mr-2 rounded px-1.5 py-0.5 text-[10px] font-mono bg-sky-500/20 text-sky-300 uppercase">
                        {item.kind}
                      </span>
                      <span className="font-mono text-white/80">{item.url}</span>
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

      <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/60 to-slate-900/60 p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/25 text-emerald-200">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-emerald-100">Tam Otonom Sistem (URL-Specter)</h3>
              <p className="text-xs text-white/60">
                Kullanıcı link girmez. Sistem, aşağıdaki tohum URL'leri her 15 dk'da bir otomatik tarar,
                Chrome kamuflajıyla indirir, M3U/HLS/MP4 adaylarını çıkarır ve karantinaya yazar.
                Sağlık kontrolünden geçenler yayına alınır.
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
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
          />
          <input
            value={newHint}
            onChange={(e) => setNewHint(e.target.value)}
            placeholder="İpucu (opsiyonel)"
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
          />
          <button onClick={handleAdd} className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/15">
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
            {log.map((l, i) => <div key={i} className="text-white/70">{l}</div>)}
          </div>
        </div>
      )}

      {/* Seeds list */}
      <div className="rounded-2xl border border-white/10 bg-white/5">
        <div className="border-b border-white/10 px-4 py-3 text-sm font-bold">
          Tohum URL'ler ({seeds.length})
        </div>
        {loading ? (
          <div className="p-6 text-center text-white/60">Yükleniyor…</div>
        ) : seeds.length === 0 ? (
          <div className="p-6 text-center text-white/60">Henüz tohum yok. Yukarıdan ekle.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {seeds.map((s) => (
              <div key={s.id} className={`grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 text-sm ${s.disabled ? "opacity-50" : ""}`}>
                <div className="min-w-0">
                  <div className="truncate font-mono text-xs text-white/90">{s.url}</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-white/50">
                    {s.hint && <span className="rounded bg-white/5 px-1.5 py-0.5">{s.hint}</span>}
                    {s.force_category && <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-purple-200">{s.force_category}</span>}
                    <span>öncelik {s.priority}</span>
                    <span className="text-emerald-300">✓ {s.success_count}</span>
                    <span className="text-red-300">✗ {s.failure_count}</span>
                    {s.last_scanned_at && <span>son: {new Date(s.last_scanned_at).toLocaleString()}</span>}
                    {s.last_error && <span className="text-red-300">hata: {s.last_error.slice(0, 60)}</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={async () => { await toggleFn({ data: { id: s.id, disabled: !s.disabled } }); refresh(); }}
                    className="rounded-lg bg-white/5 p-2 hover:bg-white/10"
                    title={s.disabled ? "Etkinleştir" : "Devre dışı"}
                  >
                    <Power className={`h-4 w-4 ${s.disabled ? "text-white/40" : "text-emerald-300"}`} />
                  </button>
                  <button
                    onClick={async () => { if (confirm("Sil?")) { await delFn({ data: { id: s.id } }); refresh(); } }}
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
