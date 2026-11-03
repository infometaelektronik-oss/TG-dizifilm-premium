import { createFileRoute } from "@tanstack/react-router";

const SYSTEM_PROMPT = `Sen TG. Dizi Film uygulamasının yapay zeka asistanısın.
Türkçe konuşan kullanıcıya kısa, sıcak ve net cevaplar ver.
Görevin: Türk dizileri (Kanal D, Show TV, Star TV, ATV, TRT, NOW) ve filmler hakkında öneri vermek,
oyuncu/konu/yayın tarihi sormak, kullanıcıyı doğru kategoriye (Canlı TV, Diziler, Filmler, TG TV) yönlendirmek.
Kullanıcının Türkçe sorusunu ANLAMAK için şu eşleştirmeleri kullan:
- "sinema" / "film" / "vizyon" → Movies / Dram + Aksiyon
- "korku" / "gerilim" → Korku / Gerilim filmleri
- "polisiye" / "dedektif" / "cinayet" → Suç / Gerilim dizileri
- "aile" / "çocuk" → Aile filmleri / Animasyon
- "romantik" / "aşk" → Romantik komedi / Dram
- "yerli dizi" / "türk dizisi" → Türk Dizileri
- Kullanıcı "bugün ne var" veya "yayın akışı" gibi sorsa TG TV veya ulusal kanalların günün programını sıralayarak öner.
Yasadışı yayın linki PAYLAŞMA. Sadece kullanıcının kendi eklediği kaynakları ya da resmi yayıncı sitelerini tavsiye et.
Cevaplarını markdown ile, gerekiyorsa madde imleriyle ver. En fazla 5 öneri, en fazla 8 satır.`;

type ChatRequestBody = { messages?: Array<{ role?: string; content?: string; text?: string; parts?: any[] }> };

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;
const hits = new Map<string, number[]>();

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (list.length >= RATE_MAX) {
    hits.set(ip, list);
    return false;
  }
  list.push(now);
  hits.set(ip, list);
  return true;
}

export const Route = (createFileRoute("/api/chat") as any)({
  server: {
    handlers: {
      POST: async ({ request }: any) => {
        const ip =
          request.headers.get("cf-connecting-ip") ||
          request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
          "unknown";

        if (!rateLimit(ip)) {
          return new Response(JSON.stringify({ error: "Çok hızlı istek gönderildi! 1 dakika bekleyin." }), {
            status: 429,
            headers: { "content-type": "application/json", "retry-after": "60" },
          });
        }

        const body = (await request.json().catch(() => ({}))) as ChatRequestBody;
        const messages = body.messages || [];

        if (!Array.isArray(messages) || messages.length === 0) {
          return new Response("Messages are required", { status: 400 });
        }

        const lastMsg = messages[messages.length - 1];
        const userPrompt =
          typeof lastMsg === "string"
            ? lastMsg
            : lastMsg.text || lastMsg.content || (Array.isArray(lastMsg.parts) ? lastMsg.parts[0]?.text : "") || "";

        let responseText = "";

        if (process.env.GEMINI_API_KEY) {
          try {
            const { GoogleGenAI } = await import("@google/genai");
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
            const result = await ai.models.generateContent({
              model: "gemini-3.8-flash",
              contents: userPrompt,
              config: {
                systemInstruction: SYSTEM_PROMPT,
              },
            });
            responseText = result.text || "";
          } catch (e) {
            console.error("[Chat] Gemini API error:", e);
          }
        }

        if (!responseText) {
          // Smart fallback recommendations for TG. Dizi Film
          const lower = userPrompt.toLowerCase();
          if (lower.includes("canlı") || lower.includes("kanal") || lower.includes("tv")) {
            responseText = `📺 **Canlı TV Önerileri:**
* **TG TV:** 24 saat kesintisiz popüler dizi & film maratonu
* **TRT 1 / ATV / Kanal D / Show TV / NOW:** Ulusal ana akım kanalları sol menüdeki **Canlı TV** sekmesinden anında izleyebilirsiniz!
* Yayın akışını görmek için sol menüden **Yayın Akışı** sekmesine göz atabilirsiniz.`;
          } else if (lower.includes("film") || lower.includes("sinema")) {
            responseText = `🎬 **Film Önerileri:**
* **Aksiyon & Macera:** Nefes kesen yerli ve yabancı sinema filmleri
* **Dram:** Duygusal ve ödüllü yapımlar
* **Komedi:** Ailecek izlenebilecek popüler filmler
Sol menüdeki **Filmler** sekmesinden kategoriye göre filtreleyebilirsiniz!`;
          } else {
            responseText = `✨ **TG Asistan:**
Hoş geldiniz! TG. Dizi Film platformunda 4.400'den fazla kanal ve içerik yer almaktadır.
* 📺 **Canlı TV:** Ulusal ve yabancı canlı kanallar
* 📻 **Radyo:** Canlı ulusal radyo istasyonları
* 🎭 **Diziler & Filmler:** Popüler yerli ve yabancı içerikler
* ⚡ **TG TV:** Özel otonom yayın akışı
Size nasıl bir öneride bulunmamı istersiniz?`;
          }
        }

        // Return formatted response compatible with AI SDK / UI
        const streamData = `0:${JSON.stringify(responseText)}\n`;
        return new Response(streamData, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "x-vercel-ai-data-stream": "v1",
          },
        });
      },
    },
  },
});
