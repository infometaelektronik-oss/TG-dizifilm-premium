import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Bot, Send, Sparkles, X } from "lucide-react";
import ReactMarkdown from "react-markdown";

type Props = {
  open: boolean;
  onClose: () => void;
  focusedKey: string | null;
  registerRef: (key: string, el: HTMLElement | null) => void;
};

const transport = new DefaultChatTransport({ api: "/api/chat" });

export function AIAssistant({ open, onClose, focusedKey, registerRef }: Props) {
  const { messages, sendMessage, status, error } = useChat({
    id: "tg-assistant",
    messages: [] as UIMessage[],
    transport,
  });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";

  const submit = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    await sendMessage({ text });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-end bg-black/70 backdrop-blur-sm md:items-stretch">
      <div className="flex h-[85vh] w-full max-w-full flex-col rounded-t-3xl border border-purple-500/30 bg-gradient-to-b from-[#1a0b2e] to-black shadow-[0_-30px_120px_-30px_rgba(168,85,247,0.6)] md:h-full md:max-w-md md:rounded-none md:border-l md:border-t-0">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-600">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.3em] text-purple-300">TG Asistan</div>
              <div className="text-base font-black">Dizi & Film yapay zekası</div>
            </div>
          </div>
          <button
            ref={(el) => registerRef("ai-close", el)}
            data-focus-key="ai-close"
            tabIndex={-1}
            onClick={onClose}
            className={`flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white outline-none transition hover:bg-white/15 ${focusedKey === "ai-close" ? "neon-ring scale-110" : ""}`}
            aria-label="Kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-6 scrollbar-hide">
          {messages.length === 0 && (
            <div className="rounded-3xl border border-purple-500/20 bg-purple-500/5 p-5 text-sm text-white/80">
              <div className="mb-2 flex items-center gap-2 text-purple-200">
                <Bot className="h-4 w-4" /> <strong>Merhaba!</strong>
              </div>
              Sana bir dizi/film önereyim mi? Örnekler:
              <ul className="mt-3 list-disc space-y-1 pl-5 text-white/65">
                <li>"Bu akşam Kanal D'de ne var?"</li>
                <li>"Polisiye dizi öner"</li>
                <li>"Aile filmi izlemek istiyorum"</li>
              </ul>
            </div>
          )}

          {messages.map((m) => {
            const text = m.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join("");
            const mine = m.role === "user";
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    mine
                      ? "bg-purple-600 text-white"
                      : "bg-white/5 text-white/90"
                  }`}
                >
                  {mine ? (
                    text
                  ) : (
                    <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-strong:text-purple-200">
                      <ReactMarkdown>{text || "…"}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {status === "submitted" && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-purple-200">
                Düşünüyor…
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200">
              {error.message.includes("429")
                ? "Çok hızlı! Birazdan tekrar dene."
                : error.message.includes("402")
                  ? "AI kredisi tükendi. Workspace ayarlarından yükle."
                  : `Hata: ${error.message}`}
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex items-center gap-2 border-t border-white/10 bg-black/40 p-4"
        >
          <input
            ref={(el) => {
              inputRef.current = el;
              registerRef("ai-input", el);
            }}
            data-focus-key="ai-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Bir şey sor…"
            disabled={busy}
            className={`flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-purple-400 focus:ring-4 focus:ring-purple-500/30 ${focusedKey === "ai-input" ? "neon-ring" : ""}`}
          />
          <button
            ref={(el) => registerRef("ai-send", el)}
            data-focus-key="ai-send"
            tabIndex={-1}
            type="submit"
            disabled={busy || !input.trim()}
            className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-600 text-white outline-none transition disabled:opacity-40 ${focusedKey === "ai-send" ? "neon-ring scale-110" : ""}`}
            aria-label="Gönder"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  );
}

export function AIAssistantFab({
  focusedKey,
  registerRef,
  onOpen,
}: {
  focusedKey: string | null;
  registerRef: (key: string, el: HTMLElement | null) => void;
  onOpen: () => void;
}) {
  return (
    <button
      ref={(el) => registerRef("ai-fab", el)}
      data-focus-key="ai-fab"
      tabIndex={-1}
      onClick={onOpen}
      className={`fixed bottom-6 right-6 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 text-white shadow-[0_20px_60px_-10px_rgba(168,85,247,0.7)] outline-none transition active:scale-95 ${focusedKey === "ai-fab" ? "neon-ring scale-110" : ""}`}
      aria-label="Yapay zeka asistanı"
    >
      <Sparkles className="h-7 w-7" />
    </button>
  );
}
