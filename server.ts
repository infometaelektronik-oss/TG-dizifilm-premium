import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { loadStore, saveStore } from "./src/db/native-db.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize native database on boot
  const initialStore = loadStore();

  // Ensure default public seeds are populated if empty
  if (!initialStore.scraper_seeds || initialStore.scraper_seeds.length === 0) {
    const defaultSeeds = [
      { id: "seed-tr-1", url: "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/tr.m3u", hint: "iptv-org TR canlı", force_category: "Live TV", priority: 95, disabled: false, created_at: new Date().toISOString() },
      { id: "seed-tr-2", url: "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/tr_kablo.m3u", hint: "iptv-org TR Kablo", force_category: "Live TV", priority: 90, disabled: false, created_at: new Date().toISOString() },
      { id: "seed-tr-3", url: "https://iptv-org.github.io/iptv/countries/tr.m3u", hint: "iptv-org TR mirror", force_category: "Live TV", priority: 85, disabled: false, created_at: new Date().toISOString() },
      { id: "seed-tr-4", url: "https://iptv-org.github.io/iptv/languages/tur.m3u", hint: "Türkçe dil filtresi", force_category: "Live TV", priority: 80, disabled: false, created_at: new Date().toISOString() },
      { id: "seed-tr-5", url: "https://iptv-org.github.io/iptv/categories/news.m3u", hint: "Haber kanalları", force_category: "Live TV", priority: 60, disabled: false, created_at: new Date().toISOString() },
      { id: "seed-tr-6", url: "https://iptv-org.github.io/iptv/categories/movies.m3u", hint: "Film kanalları", force_category: "Movies", priority: 60, disabled: false, created_at: new Date().toISOString() },
      { id: "seed-tr-7", url: "https://de1.api.radio-browser.info/json/stations/bycountrycodeexact/TR?hidebroken=true&order=clickcount&reverse=true&limit=400", hint: "Türk radyoları (Radio Browser)", force_category: "Radio", priority: 88, disabled: false, created_at: new Date().toISOString() },
      { id: "seed-tr-8", url: "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8", hint: "Free-TV genel", force_category: "Live TV", priority: 40, disabled: false, created_at: new Date().toISOString() }
    ];
    initialStore.scraper_seeds = defaultSeeds;
    saveStore(initialStore);
  }

  console.log(`[NativeDB] Initialized with ${initialStore.user_streams?.length || 0} user streams, ${initialStore.home_rows?.length || 0} home rows, and ${initialStore.scraper_seeds?.length || 0} scraper seeds.`);

  app.use(express.json({ limit: "50mb" }));

  // Static assets
  app.use("/assets", express.static(path.resolve(__dirname, "public/assets")));
  app.use("/public", express.static(path.resolve(__dirname, "public")));

  // Stream proxy CORS headers
  const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Content-Type, Accept, Authorization",
    "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type",
    "Access-Control-Max-Age": "86400",
  };

  // Database API
  app.get("/api/db/data", (_req, res) => {
    res.json(loadStore(true));
  });

  app.post("/api/db/sync", (req, res) => {
    try {
      if (req.body && typeof req.body === "object") {
        const current = loadStore();
        const incoming = req.body;
        // Protect server database from stale client overwrites (e.g. tablet with 128 items vs 4400+ items on server)
        if (
          Array.isArray(incoming.user_streams) &&
          Array.isArray(current.user_streams) &&
          incoming.user_streams.length < current.user_streams.length / 2 &&
          current.user_streams.length > 500
        ) {
          console.warn(
            `[NativeDB] Blocked stale client sync: incoming ${incoming.user_streams.length} vs server ${current.user_streams.length} streams.`
          );
          return res.json({ ok: true, preserved: true });
        }
        saveStore(req.body);
        res.json({ ok: true });
      } else {
        res.status(400).json({ error: "Invalid payload" });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Helper for M3U playlist segment rewriting
  function absolutizeUrl(ref: string, base: URL): string {
    try {
      return new URL(ref, base).toString();
    } catch {
      return ref;
    }
  }

  function rewriteM3UPlaylist(text: string, base: URL, referer?: string): string {
    const proxyBase = "/api/public/stream-proxy";
    const refQ = referer ? `&referer=${encodeURIComponent(referer)}` : "";
    return text
      .split(/\r?\n/)
      .map((line) => {
        const t = line.trim();
        if (!t || t.startsWith("#")) {
          return line.replace(/URI="([^"]+)"/gi, (_m, u) => {
            const abs = absolutizeUrl(u, base);
            return `URI="${proxyBase}?url=${encodeURIComponent(abs)}${refQ}"`;
          });
        }
        const abs = absolutizeUrl(t, base);
        return `${proxyBase}?url=${encodeURIComponent(abs)}${refQ}`;
      })
      .join("\n");
  }

  // HLS Stream Proxy
  app.options("/api/public/stream-proxy", (_req, res) => {
    res.set(CORS_HEADERS).status(204).end();
  });

  app.all("/api/public/stream-proxy", async (req, res) => {
    res.set(CORS_HEADERS);
    const target = req.query.url as string;
    if (!target || !/^https?:\/\//i.test(target)) {
      return res.status(400).send("Missing or invalid url param");
    }

    const referer = (req.query.referer as string) || undefined;
    const origin = (req.query.origin as string) || undefined;

    try {
      const upstreamUrl = new URL(target);
      const headers: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "*/*",
        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.7",
        Referer: referer || `${upstreamUrl.protocol}//${upstreamUrl.host}/`,
        Origin: origin || `${upstreamUrl.protocol}//${upstreamUrl.host}`,
      };

      if (req.headers.range) {
        headers["Range"] = req.headers.range as string;
      }

      const upstream = await fetch(target, {
        method: req.method === "HEAD" ? "HEAD" : "GET",
        headers,
        redirect: "follow",
      });

      res.status(upstream.status);

      // Strip headers that Node's fetch uncompressed or that conflict with streaming
      const omitHeaders = new Set([
        "content-encoding",
        "content-length",
        "transfer-encoding",
        "connection",
        "access-control-allow-origin",
        "access-control-allow-methods",
        "access-control-allow-headers",
        "access-control-expose-headers",
        "access-control-max-age",
      ]);

      upstream.headers.forEach((v, k) => {
        const lower = k.toLowerCase();
        if (!omitHeaders.has(lower) && !lower.startsWith("access-control-")) {
          res.setHeader(k, v);
        }
      });

      if (req.method === "HEAD") {
        return res.end();
      }

      const ct = (upstream.headers.get("content-type") || "").toLowerCase();
      const isPlaylist =
        ct.includes("mpegurl") ||
        ct.includes("vnd.apple.mpegurl") ||
        /\.m3u8(\?|$)/i.test(upstreamUrl.pathname);

      if (isPlaylist) {
        const text = await upstream.text();
        const rewritten = rewriteM3UPlaylist(text, upstreamUrl, referer);
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
        return res.send(rewritten);
      }

      if (upstream.body) {
        const reader = upstream.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            res.end();
            break;
          }
          res.write(value);
        }
      } else {
        res.end();
      }
    } catch (e: any) {
      if (!res.headersSent) {
        res.status(502).send("Upstream fetch failed: " + e.message);
      }
    }
  });

  // Google Cloud Gemini Text Generation Proxy
  app.post("/api/gemini", async (req, res) => {
    const { prompt, systemInstruction } = req.body || {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "prompt is required", text: null });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({ text: null, note: "GEMINI_API_KEY not configured" });
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: systemInstruction ? { systemInstruction } : undefined,
      });
      return res.json({ text: response.text ?? null });
    } catch (err: any) {
      console.error("[Server Gemini Proxy] Error:", err?.message || err);
      return res.json({ text: null, error: err?.message || "Gemini error" });
    }
  });

  // Google Gemini Real-Time Turkish Dubbing & Scene Analysis Endpoint
  app.post("/api/ai/live-dubbing", async (req, res) => {
    try {
      const { title, category, genre, description, currentTime, history } = req.body || {};
      if (!title) {
        return res.status(400).json({ ok: false, error: "title parametresi zorunludur" });
      }
      const { generateLiveDubbingDialogue } = await import("./src/lib/gemini-dubbing.server.ts");
      const result = await generateLiveDubbingDialogue({
        title,
        category,
        genre,
        description,
        currentTime: Number(currentTime) || 0,
        history: Array.isArray(history) ? history : [],
      });
      res.json(result);
    } catch (e: any) {
      console.error("[Live Dubbing API Error]", e);
      res.status(500).json({ ok: false, error: e.message || String(e) });
    }
  });

  // AI Assistant Chat API using Google Cloud Gemini
  app.post("/api/chat", async (req, res) => {
    const { messages } = req.body || {};
    const msgs = Array.isArray(messages) ? messages : [];
    const lastMsg = msgs[msgs.length - 1];
    const userPrompt =
      typeof lastMsg === "string"
        ? lastMsg
        : lastMsg?.text || lastMsg?.content || (Array.isArray(lastMsg?.parts) ? lastMsg?.parts[0]?.text : "") || "";

    const SYSTEM_PROMPT = `Sen TG. Dizi Film uygulamasının yapay zeka asistanısın.
Türkçe konuşan kullanıcıya kısa, sıcak ve net cevaplar ver.
Görevin: Türk dizileri (Kanal D, Show TV, Star TV, ATV, TRT, NOW) ve filmler hakkında öneri vermek,
kullanıcıyı doğru kategoriye (Canlı TV, Diziler, Filmler, TG TV) yönlendirmek.
En fazla 5 öneri ver, markdown formatında yaz.`;

    let reply = "";
    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI();
        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: userPrompt || "Merhaba",
          config: { systemInstruction: SYSTEM_PROMPT },
        });
        reply = response.text || "";
      } catch (e) {
        console.error("[Chat] Gemini error:", e);
      }
    }

    if (!reply) {
      const lower = userPrompt.toLowerCase();
      if (lower.includes("canlı") || lower.includes("kanal") || lower.includes("tv")) {
        reply = `📺 **Canlı TV Önerileri:**
* **TG TV:** 24 saat kesintisiz popüler dizi & film maratonu
* **TRT 1 / ATV / Kanal D / Show TV / NOW:** Ulusal kanalları sol menüdeki **Canlı TV** sekmesinden anında izleyebilirsiniz!
* Yayın akışını görmek için sol menüden **Yayın Akışı** sekmesine göz atabilirsiniz.`;
      } else if (lower.includes("film") || lower.includes("sinema")) {
        reply = `🎬 **Film Önerileri:**
* **Aksiyon & Macera:** Nefes kesen yerli ve yabancı sinema filmleri
* **Dram:** Duygusal ve ödüllü yapımlar
* **Komedi:** Ailecek izlenebilecek popüler filmler
Sol menüdeki **Filmler** sekmesinden kategoriye göre filtreleyebilirsiniz!`;
      } else {
        reply = `✨ **TG Asistan:**
Hoş geldiniz! TG. Dizi Film platformunda 4.400'den fazla kanal ve içerik yer almaktadır.
* 📺 **Canlı TV:** Ulusal ve yabancı canlı kanallar
* 📻 **Radyo:** Canlı ulusal radyo istasyonları
* 🎭 **Diziler & Filmler:** Popüler yerli ve yabancı içerikler
* ⚡ **TG TV:** Özel otonom yayın akışı
Size nasıl yardımcı olabilirim?`;
      }
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("x-vercel-ai-data-stream", "v1");
    res.send(`0:${JSON.stringify(reply)}\n`);
  });

  // Real Autonomous Scan Cron Endpoint
  app.all("/api/public/cron/autonomous-scan", async (req, res) => {
    try {
      const { runAutonomousScan } = await import("./src/lib/autonomous.server.ts");
      const batchSize = Number(req.query.batch) || (req.method === "POST" ? 3 : 1);
      const result = await runAutonomousScan(batchSize);
      res.json({ ok: true, ...result, executedAt: new Date().toISOString() });
    } catch (err: any) {
      console.error("[Autonomous Scan Endpoint] Error:", err?.message || err);
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

  // Core Stream Engine Configuration & Sync Endpoints
  app.get("/api/core-engine/config", async (_req, res) => {
    try {
      const { getCoreEngineConfig } = await import("./src/lib/core-engine.server.ts");
      const config = await getCoreEngineConfig();
      res.json(config);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/core-engine/config", async (req, res) => {
    try {
      const { saveCoreEngineConfig } = await import("./src/lib/core-engine.server.ts");
      await saveCoreEngineConfig(req.body || {});
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/core-engine/sync", async (req, res) => {
    try {
      const { syncCoreStreamEngine } = await import("./src/lib/core-engine.server.ts");
      const { apiUrl, apiKey } = req.body || {};
      const result = await syncCoreStreamEngine(apiUrl, apiKey);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // Media Crawler Endpoint (invokes media crawler logic from media_crawler.py)
  app.post("/api/media-crawler/crawl", async (req, res) => {
    try {
      const { url, allowHosts, importToStreams, category } = req.body || {};
      if (!url || typeof url !== "string") {
        return res.status(400).json({ ok: false, error: "Hedef URL parametresi gerekli." });
      }
      const { runMediaCrawl } = await import("./src/lib/media-crawler.server.ts");
      const result = await runMediaCrawl(url, { allowHosts, importToStreams: importToStreams !== false, category });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message || String(e) });
    }
  });

  // Quarantine Action Endpoint (approve / unquarantine / delete)
  app.post("/api/quarantine/action", async (req, res) => {
    try {
      const { id, action } = req.body || {};
      if (!id || !action) return res.status(400).json({ ok: false, error: "id ve action parametreleri zorunludur." });
      const store = loadStore();
      const streams = store.user_streams || [];
      const idx = streams.findIndex((s) => s.id === id);
      if (idx === -1) return res.status(404).json({ ok: false, error: "İçerik bulunamadı." });

      if (action === "delete") {
        const removed = streams.splice(idx, 1)[0];
        // Also clean up any home_row_items referencing it
        if (store.home_row_items) {
          store.home_row_items = store.home_row_items.filter((item: any) => item.stream_id !== id);
        }
        store.user_streams = streams;
        saveStore(store);
        const { logAudit } = await import("./src/lib/audit.server.ts");
        await logAudit({
          action: "quarantine.delete",
          source: "admin",
          level: "warn",
          entity: "user_streams",
          entityId: id,
          message: `Karantinadaki içerik kalıcı silindi: ${removed.title}`,
        });
        return res.json({ ok: true, action: "deleted" });
      }

      // approve or unquarantine
      streams[idx].is_active = true;
      streams[idx].status = "active";
      streams[idx].quarantine_reason = null;
      streams[idx].failure_count = 0;
      streams[idx].manual_lock = true;
      streams[idx].promoted_at = new Date().toISOString();
      store.user_streams = streams;
      saveStore(store);

      const { logAudit } = await import("./src/lib/audit.server.ts");
      await logAudit({
        action: "quarantine.approve",
        source: "admin",
        level: "success",
        entity: "user_streams",
        entityId: id,
        message: `Karantinadaki içerik onaylandı ve yayına alındı: ${streams[idx].title}`,
      });
      res.json({ ok: true, action: "approved", item: streams[idx] });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message || String(e) });
    }
  });

  // Quarantine Bulk Action Endpoint
  app.post("/api/quarantine/bulk", async (req, res) => {
    try {
      const { action, ids } = req.body || {};
      const store = loadStore();
      let streams = store.user_streams || [];
      const targetIds = new Set(Array.isArray(ids) && ids.length > 0 ? ids : streams.filter((s: any) => !s.is_active || s.quarantine_reason).map((s: any) => s.id));

      if (action === "delete_all") {
        const beforeCount = streams.length;
        streams = streams.filter((s: any) => !targetIds.has(s.id));
        const deletedCount = beforeCount - streams.length;
        if (store.home_row_items) {
          store.home_row_items = store.home_row_items.filter((item: any) => !targetIds.has(item.stream_id));
        }
        store.user_streams = streams;
        saveStore(store);
        return res.json({ ok: true, count: deletedCount });
      }

      // approve_all
      let approvedCount = 0;
      for (const s of streams) {
        if (targetIds.has(s.id)) {
          s.is_active = true;
          s.status = "active";
          s.quarantine_reason = null;
          s.failure_count = 0;
          s.manual_lock = true;
          s.promoted_at = new Date().toISOString();
          approvedCount++;
        }
      }
      store.user_streams = streams;
      saveStore(store);
      res.json({ ok: true, count: approvedCount });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message || String(e) });
    }
  });

  // Autonomous Multi-Agent Network Execution
  app.post("/api/autonomous/run-agents", async (_req, res) => {
    try {
      const { runAutonomousAgentNetwork } = await import("./src/lib/autonomous-agents.server.ts");
      const result = await runAutonomousAgentNetwork();
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message || String(e) });
    }
  });

  // Telegram Test Notification
  app.post("/api/autonomous/telegram-test", async (req, res) => {
    try {
      const { message } = req.body || {};
      const { sendTelegramReport } = await import("./src/lib/autonomous-agents.server.ts");
      const defaultMsg = message || "Ağa, programda yayın gecikmesi ve önbellek sıkıntısı vardı, Gemini Guardian tarafından çözüldü.";
      const result = await sendTelegramReport(defaultMsg);
      res.json({ ok: result.sent, mode: result.mode, message: defaultMsg, error: result.error });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message || String(e) });
    }
  });

  // Telegram Settings GET / POST
  app.get("/api/autonomous/telegram-settings", async (_req, res) => {
    try {
      const store = loadStore();
      const settings = store.app_settings || [];
      const token = settings.find((s: any) => s.key === "telegram_bot_token")?.value || process.env.TELEGRAM_BOT_TOKEN || "";
      const chatId = settings.find((s: any) => s.key === "telegram_chat_id")?.value || process.env.TELEGRAM_CHAT_ID || "";
      res.json({ ok: true, hasToken: Boolean(token), botTokenMasked: token ? `${token.slice(0, 6)}...${token.slice(-4)}` : "", chatId });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message || String(e) });
    }
  });

  app.post("/api/autonomous/telegram-settings", async (req, res) => {
    try {
      const { botToken, chatId } = req.body || {};
      const store = loadStore();
      if (!Array.isArray(store.app_settings)) store.app_settings = [];
      
      const upsertSetting = (key: string, value: string) => {
        const idx = store.app_settings.findIndex((s: any) => s.key === key);
        if (idx >= 0) store.app_settings[idx].value = value;
        else store.app_settings.push({ key, value, updated_at: new Date().toISOString() });
      };

      if (typeof botToken === "string") upsertSetting("telegram_bot_token", botToken.trim());
      if (typeof chatId === "string") upsertSetting("telegram_chat_id", chatId.trim());

      saveStore(store);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message || String(e) });
    }
  });

  // Stream Speed Test & Autonomous Server Failover Endpoint
  app.post("/api/diagnostics/speed-test", async (req, res) => {
    try {
      const { streamUrl, streamId, title, forceFailover } = req.body || {};
      if (!streamUrl) {
        return res.status(400).json({ ok: false, error: "streamUrl zorunludur." });
      }
      const { runStreamSpeedTest } = await import("./src/lib/diagnostics.server.ts");
      const result = await runStreamSpeedTest({ streamUrl, streamId, title, forceFailover });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message || String(e) });
    }
  });

  // Smart Tools Runner Endpoint (executes without freezing frontend)
  app.post("/api/smart-tools/run", async (req, res) => {
    try {
      const { action, minHeight, limit } = req.body || {};
      const { logAudit } = await import("./src/lib/audit.server.ts");

      if (action === "ai-categorize") {
        // AI & Heuristic Automatic Channel Categorization
        const { detectOriginAndSubCategory } = await import("./src/lib/media-classifier.ts");
        const store = loadStore();
        const streams = store.user_streams || [];
        let updatedCount = 0;
        let trCount = 0;
        let foreignCount = 0;
        let newsCount = 0;

        for (const s of streams) {
          const res = detectOriginAndSubCategory(s.title, s.source_url, s.channel_group);
          const changed =
            s.is_foreign !== res.isForeign ||
            s.country !== (res.country || null) ||
            s.sub_category !== res.subCategory;
          if (changed) {
            s.is_foreign = res.isForeign;
            s.country = res.country || null;
            s.sub_category = res.subCategory;
            updatedCount++;
          }
          if (!res.isForeign) trCount++;
          else foreignCount++;
          if (res.subCategory === "Haber" || res.subCategory === "Yabancı Haber") newsCount++;
        }
        store.user_streams = streams;
        saveStore(store);

        await logAudit({
          action: "smart.categorize",
          source: "smart_tools",
          level: "success",
          message: `AI kanal sınıflandırması tamamlandı: ${updatedCount} kanal güncellendi (${trCount} Türk, ${foreignCount} Yabancı).`,
        });

        return res.json({
          ok: true,
          summary: `AI Kanal Sınıflandırması Tamamlandı · ${updatedCount} kayıt yeniden düzenlendi · Toplam ${trCount} Türk/Ulusal, ${foreignCount} Yabancı, ${newsCount} Haber kanalı net olarak ayrıştırıldı.`,
          updated: updatedCount,
          trCount,
          foreignCount,
        });
      }

      if (action === "quarantine-sweep") {
        const store = loadStore();
        const streams = store.user_streams || [];
        let quarantined = 0;
        // Check for streams that have failed before or are marked dead
        for (const s of streams) {
          if (s.status === "dead" || (s.failure_count && s.failure_count >= 2)) {
            if (s.is_active !== false) {
              s.is_active = false;
              s.quarantine_reason = "link_health_failed";
              quarantined++;
            }
          }
        }
        store.user_streams = streams;
        saveStore(store);
        return res.json({ ok: true, quarantined });
      }

      if (action === "normalize") {
        const { runNormalizer } = await import("./src/lib/normalizer.server.ts");
        const r = await runNormalizer(limit || 40);
        return res.json({
          ok: true,
          summary: `İsim temizleme bitti · ${r.updated}/${r.scanned} kayıt düzeltildi · ${r.logosMatched} logo eşlendi`,
          samples: r.samples?.map((s) => `${s.from} → ${s.to}`) || [],
        });
      }

      if (action === "heal") {
        const { runSelfHeal } = await import("./src/lib/self-heal.server.ts");
        const r = await runSelfHeal();
        return res.json({
          ok: true,
          summary: `Onarma bitti · ${r.broken} bozuk · ${r.healed} onarıldı · ${r.noAlternative} alternatifsiz`,
          samples: r.samples || [],
        });
      }

      if (action === "dedupe") {
        const { runDedupe } = await import("./src/lib/self-heal.server.ts");
        const r = await runDedupe();
        return res.json({
          ok: true,
          summary: `Birleştirme bitti · ${r.groups} grup · ${r.merged} yedek kaynak bağlandı`,
          samples: r.samples || [],
        });
      }

      if (action === "quality") {
        const { runQualitySweep } = await import("./src/lib/quality.server.ts");
        const r = await runQualitySweep(limit || 40, minHeight || 480);
        return res.json({
          ok: true,
          summary: `Kalite taraması · ${r.checked} yayın · ${r.measured} ölçüldü · ${r.deactivated} düşük kaliteli pasife alındı`,
          samples: [],
        });
      }

      if (action === "meta") {
        const { runMetaEnrichment } = await import("./src/lib/metadata.server.ts");
        const r = await runMetaEnrichment(20);
        return res.json({
          ok: true,
          summary: `Meta-veri zenginleştirme · ${r.updated}/${r.scanned} içerik zenginleştirildi (${r.source})`,
          samples: [],
        });
      }

      if (action === "import-raw-m3u") {
        const { content, category: chosenCategory } = req.body || {};
        if (!content || typeof content !== "string") {
          return res.status(400).json({ ok: false, error: "Metin içeriği gerekli." });
        }
        const { parseM3U } = await import("./src/lib/m3u-parser.ts");
        const { classify } = await import("./src/lib/media-classifier.ts");
        const store = loadStore();
        if (!Array.isArray(store.user_streams)) store.user_streams = [];

        let items: Array<{ title: string; url: string; logo?: string; group?: string }> = [];
        const trimmed = content.trim();

        if (trimmed.includes("#EXTM3U") || trimmed.includes("#EXTINF")) {
          const parsed = parseM3U(trimmed);
          items = parsed.map((p) => ({ title: p.title, url: p.url, logo: p.tvgLogo, group: p.groupTitle }));
        } else {
          const lines = trimmed.split(/[\r\n]+/).map((l) => l.trim()).filter((l) => /^https?:\/\//i.test(l));
          items = lines.map((url, i) => {
            const filename = url.split("/").pop()?.split("?")[0] || `Medya Akışı ${i + 1}`;
            return { title: decodeURIComponent(filename).replace(/\.[a-z0-9]+$/i, ""), url };
          });
        }

        let importedCount = 0;
        const now = new Date().toISOString();
        const finalCategory = chosenCategory || "Movies";

        for (const it of items) {
          const existingIdx = store.user_streams.findIndex((s) => s.source_url === it.url);
          const classified = classify(it.title, it.url, it.group);
          const cat = finalCategory || classified.category || "Movies";
          const subCat = cat === "Movies" ? "Sinema" : cat === "Series" ? "Dizi" : (classified.subCategory || "Genel");

          const rec = {
            id: existingIdx >= 0 ? store.user_streams[existingIdx].id : `imp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            title: it.title,
            normalized_title: it.title.toLowerCase(),
            source_url: it.url,
            category: cat,
            sub_category: subCat,
            country: classified.country || "Türkiye",
            is_foreign: classified.isForeign ?? false,
            stream_type: it.url.toLowerCase().includes(".mp4") ? "MP4" : "HLS",
            poster_url: it.logo || null,
            logo_url: it.logo || null,
            description: `Doğrudan içe aktarıldı (${cat}).`,
            channel_group: cat === "Movies" ? "Filmler" : cat === "Series" ? "Diziler" : "Ulusal",
            is_active: true,
            status: "active",
            quarantine_reason: null,
            failure_count: 0,
            manual_lock: true,
            tags: ["direct-import", cat.toLowerCase()],
            updated_at: now,
            created_at: existingIdx >= 0 ? store.user_streams[existingIdx].created_at : now,
          };

          if (existingIdx >= 0) {
            store.user_streams[existingIdx] = { ...store.user_streams[existingIdx], ...rec };
          } else {
            store.user_streams.unshift(rec);
          }
          importedCount++;
        }

        saveStore(store);

        await logAudit({
          action: "smart.import_raw",
          source: "smart_tools",
          level: "success",
          message: `${importedCount} adet içerik (${finalCategory}) başarıyla aktarıldı.`,
        });

        return res.json({
          ok: true,
          count: importedCount,
          summary: `${importedCount} adet içerik başarıyla aktarıldı ve yayına alındı.`,
        });
      }

      res.status(400).json({ ok: false, error: "Bilinmeyen akıllı araç eylemi" });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message || String(e) });
    }
  });

  // M3U / M3U8 Direct Import Endpoint (URL or pasted text or file)
  app.post("/api/import-m3u", async (req, res) => {
    try {
      const { text, url, autoActivate, forceCategory } = req.body || {};
      let content = text;
      if (!content && url) {
        const upstream = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 TG-App" } });
        if (!upstream.ok) throw new Error(`URL indirilemedi: HTTP ${upstream.status}`);
        content = await upstream.text();
      }
      if (!content || typeof content !== "string") {
        return res.status(400).json({ ok: false, error: "Geçerli bir M3U8/M3U içeriği veya URL sağlanmadı." });
      }

      const { parseM3U } = await import("./src/lib/m3u-parser.ts");
      const { classify } = await import("./src/lib/media-classifier.ts");
      const entries = parseM3U(content);
      if (entries.length === 0) {
        return res.status(400).json({ ok: false, error: "İçerikte geçerli bir #EXTINF veya akış linki bulunamadı." });
      }

      const store = loadStore();
      const existing = store.user_streams || [];
      const byUrl = new Map<string, any>(existing.map((s: any) => [s.source_url, s]));
      let added = 0;
      let updated = 0;

      for (const entry of entries) {
        const classified = classify(entry.title, entry.url, entry.groupTitle);
        const finalCategory = forceCategory || classified.category;
        const now = new Date().toISOString();

        if (byUrl.has(entry.url)) {
          const item = byUrl.get(entry.url);
          item.title = entry.title || item.title;
          item.category = finalCategory;
          item.sub_category = entry.subCategory || classified.subCategory || item.sub_category;
          item.country = classified.country || item.country;
          item.is_foreign = classified.isForeign;
          if (entry.tvgLogo) item.poster_url = entry.tvgLogo;
          if (autoActivate !== false) {
            item.is_active = true;
            item.quarantine_reason = null;
          }
          item.updated_at = now;
          updated++;
        } else {
          const newItem = {
            id: `stream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            title: entry.title,
            source_url: entry.url,
            category: finalCategory,
            sub_category: entry.subCategory || classified.subCategory || null,
            stream_type: classified.streamType,
            poster_url: entry.tvgLogo || null,
            logo_url: entry.tvgLogo || null,
            backdrop_url: null,
            description: entry.groupTitle ? `Grup: ${entry.groupTitle}` : null,
            channel_group: entry.groupTitle || null,
            country: classified.country,
            is_foreign: classified.isForeign,
            tags: classified.tags,
            is_active: autoActivate !== false,
            status: "active",
            quarantine_reason: autoActivate === false ? "manual" : null,
            failure_count: 0,
            manual_lock: false,
            created_at: now,
            updated_at: now,
          };
          existing.push(newItem);
          byUrl.set(entry.url, newItem);
          added++;
        }
      }

      store.user_streams = existing;
      saveStore(store);

      const { logAudit } = await import("./src/lib/audit.server.ts");
      await logAudit({
        action: "m3u.import",
        source: "admin",
        level: "success",
        message: `M3U8 içeriği içe aktarıldı: ${added} yeni kanal eklendi, ${updated} kanal güncellendi. Toplam ${entries.length} akış bulundu.`,
      });

      res.json({
        ok: true,
        count: entries.length,
        added,
        updated,
        summary: `${entries.length} akış işlendi (${added} yeni eklendi, ${updated} güncellendi).`,
      });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message || String(e) });
    }
  });

  // Audit Logs API Endpoint
  app.get("/api/audit-logs", (_req, res) => {
    try {
      const store = loadStore();
      const logs = (store.audit_logs || []).slice(-200).reverse();
      res.json(logs);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/audit-logs", async (req, res) => {
    try {
      const { action, message, level, source, entity, entityId } = req.body || {};
      const { logAudit } = await import("./src/lib/audit.server.ts");
      await logAudit({
        action: action || "system.log",
        message: message || "Log kaydı",
        level: level || "info",
        source: source || "system",
        entity: entity || undefined,
        entityId: entityId || undefined,
      });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/audit-logs/clear", (_req, res) => {
    try {
      const store = loadStore();
      store.audit_logs = [];
      saveStore(store);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Cron simulation endpoints
  app.all("/api/public/cron/:job", (req, res) => {
    res.json({ ok: true, job: req.params.job, executedAt: new Date().toISOString() });
  });

  // Autonomous background synchronizer for Core Stream Engine (runs every 30 mins)
  setInterval(async () => {
    try {
      const { getCoreEngineConfig, syncCoreStreamEngine } = await import("./src/lib/core-engine.server.ts");
      const config = await getCoreEngineConfig();
      if (config.apiUrl && config.autoSync) {
        console.log("[Core Stream Engine] Starting scheduled background sync...");
        const res = await syncCoreStreamEngine();
        console.log(`[Core Stream Engine] Scheduled sync completed: ${res.newOrUpdated} items.`);
      }
    } catch (err: any) {
      console.warn("[Core Stream Engine] Scheduled sync error:", err?.message || err);
    }
  }, 30 * 60 * 1000);

  // Mount Vite development middlewares or production static files
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(__dirname, "dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[TG. Dizi Film] Sunucu http://localhost:${PORT} adresinde hazır!`);
  });
}

startServer().catch((err) => {
  console.error("Server startup error:", err);
  process.exit(1);
});
