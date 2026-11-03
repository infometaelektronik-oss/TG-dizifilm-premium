import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Download,
  FileCode,
  FileText,
  FileUp,
  Link,
  Loader2,
  Radio,
  Upload,
  X,
} from "lucide-react";
import { exportBackup, importBackup } from "@/lib/admin-ops.functions";

export function BackupPanel({ onChanged }: { onChanged: () => void }) {
  const exportFn = useServerFn(exportBackup);
  const importFn = useServerFn(importBackup);
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [activate, setActivate] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showM3uModal, setShowM3uModal] = useState(false);
  const [m3uUrl, setM3uUrl] = useState("");
  const [m3uText, setM3uText] = useState("");
  const [m3uCategory, setM3uCategory] = useState("");
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const download = async (format: "json" | "m3u") => {
    setBusy(format);
    setNote(null);
    try {
      const res = await exportFn({ data: { format } });
      const blob = new Blob([res.content], {
        type: format === "json" ? "application/json" : "audio/x-mpegurl",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tgdizifilm-yedek-${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      setNote(`${res.count} içerik dışa aktarıldı.`);
      showToast(`${res.count} içerik ${format.toUpperCase()} formatında indirildi.`);
    } catch (e: any) {
      setNote(e.message || "Dışa aktarılamadı");
      showToast(e.message || "Hata", "error");
    } finally {
      setBusy(null);
    }
  };

  const handleFile = async (file: File) => {
    setBusy("import");
    setNote(null);
    try {
      const content = await file.text();
      const isM3u = file.name.endsWith(".m3u") || file.name.endsWith(".m3u8") || content.includes("#EXTINF") || content.includes("#EXTM3U");

      if (isM3u) {
        // Send to M3U endpoint
        const res = await fetch("/api/import-m3u", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: content, autoActivate: activate }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "M3U içe aktarılamadı");
        setNote(data.summary);
        showToast(data.summary, "success");
      } else {
        // Standard JSON backup
        const res = await importFn({ data: { content, activateStreams: activate } });
        setNote(`Geri yüklendi → ${res.streams} yayın, ${res.seeds} tohum, ${res.layout} şerit.`);
        showToast(`${res.streams} yayın ve ayarlar geri yüklendi.`);
      }
      onChanged();
    } catch (e: any) {
      setNote(e.message || "Geri yüklenemedi");
      showToast(e.message || "İçe aktarım hatası", "error");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleM3uSubmit = async () => {
    if (!m3uUrl && !m3uText) {
      showToast("Lütfen bir M3U8 URL'si girin veya metin yapıştırın.", "error");
      return;
    }
    setBusy("m3u-modal");
    try {
      const res = await fetch("/api/import-m3u", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: m3uUrl || undefined,
          text: m3uText || undefined,
          autoActivate: activate,
          forceCategory: m3uCategory || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "M3U içe aktarılamadı");
      setNote(data.summary);
      showToast(data.summary, "success");
      setShowM3uModal(false);
      setM3uUrl("");
      setM3uText("");
      onChanged();
    } catch (e: any) {
      showToast(e.message || "İçe aktarım başarısız", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-6">
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

      {/* Header */}
      <div className="rounded-3xl border border-purple-500/20 bg-white/5 p-6 backdrop-blur">
        <h3 className="text-lg font-black text-white">Yedekleme &amp; M3U8 Akış Aktarımı</h3>
        <p className="mt-1 text-xs text-white/55">
          Tüm kanalları, tohum adreslerini ve sistem düzenini tek tıkla yedekleyin veya bilgisayarınızdan M3U/M3U8 çalma listesi yükleyin.
        </p>

        {/* Drag & Drop File Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          onClick={() => fileRef.current?.click()}
          className={`mt-6 flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-8 text-center transition ${
            isDragOver
              ? "border-purple-400 bg-purple-500/20 scale-[1.01]"
              : "border-white/20 bg-black/40 hover:border-purple-500/50 hover:bg-black/60"
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".m3u,.m3u8,.json,application/json,audio/x-mpegurl,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-600/25 text-purple-300">
            {busy === "import" ? <Loader2 className="h-7 w-7 animate-spin" /> : <FileUp className="h-7 w-7" />}
          </div>
          <h4 className="mt-4 text-base font-black text-white">
            M3U8, M3U veya JSON dosyasını buraya sürükleyip bırakın
          </h4>
          <p className="mt-1 text-xs text-white/50">veya dosya seçmek için bu alana tıklayın (.m3u, .m3u8, .json)</p>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5 text-xs text-white/70">
            <input
              type="checkbox"
              id="activate-check"
              checked={activate}
              onChange={(e) => setActivate(e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              className="accent-purple-500"
            />
            <label htmlFor="activate-check" onClick={(e) => e.stopPropagation()}>
              İçe aktarılan yayınları doğrudan ana sayfada yayına al
            </label>
          </div>
        </div>

        {/* Action Buttons Grid */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {/* M3U Link/Text Import */}
          <div className="flex flex-col justify-between rounded-2xl border border-cyan-500/20 bg-cyan-950/20 p-4">
            <div>
              <div className="flex items-center gap-2 font-black text-cyan-200">
                <Link className="h-4 w-4" /> M3U8 URL / Metin İçe Aktar
              </div>
              <p className="mt-1 text-xs text-white/60">
                İnternetteki bir IPTV çalma listesi linkini veya M3U metin kodlarını yapıştırarak aktarın.
              </p>
            </div>
            <button
              onClick={() => setShowM3uModal(true)}
              className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-cyan-500 py-2.5 text-xs font-black text-black hover:bg-cyan-400"
            >
              <FileCode className="h-4 w-4" /> URL veya Metin Gir
            </button>
          </div>

          {/* JSON Export */}
          <div className="flex flex-col justify-between rounded-2xl border border-purple-500/20 bg-purple-950/20 p-4">
            <div>
              <div className="flex items-center gap-2 font-black text-purple-200">
                <Download className="h-4 w-4" /> Sistem JSON Yedeği
              </div>
              <p className="mt-1 text-xs text-white/60">
                Tüm kanalları, şeritleri, otonom tohumları ve kuralları JSON olarak bilgisayarınıza indirin.
              </p>
            </div>
            <button
              onClick={() => download("json")}
              disabled={busy !== null}
              className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-purple-600 py-2.5 text-xs font-black text-white hover:bg-purple-500 disabled:opacity-50"
            >
              {busy === "json" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              JSON Yedeği İndir
            </button>
          </div>

          {/* M3U Export */}
          <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-black/40 p-4">
            <div>
              <div className="flex items-center gap-2 font-black text-white">
                <FileText className="h-4 w-4" /> M3U Çalma Listesi İndir
              </div>
              <p className="mt-1 text-xs text-white/60">
                Sistemdeki tüm canlı TV ve radyo kanallarını standart M3U çalma listesi olarak dışa aktarın.
              </p>
            </div>
            <button
              onClick={() => download("m3u")}
              disabled={busy !== null}
              className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-white/10 py-2.5 text-xs font-black text-white hover:bg-white/20 disabled:opacity-50"
            >
              {busy === "m3u" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              M3U Listesi İndir
            </button>
          </div>
        </div>

        {note && <div className="mt-4 rounded-xl bg-purple-500/15 p-3 text-xs text-purple-200">{note}</div>}
      </div>

      {/* M3U Import Modal */}
      {showM3uModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-white/20 bg-slate-950 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="h-5 w-5 text-cyan-400" />
                <h3 className="text-lg font-black text-white">M3U / M3U8 Akış İçeriği Aktar</h3>
              </div>
              <button
                onClick={() => setShowM3uModal(false)}
                className="rounded-full bg-white/10 p-1.5 text-white/70 hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-purple-200">
                  M3U8 / M3U Bağlantı Adresi (URL)
                </label>
                <input
                  type="url"
                  value={m3uUrl}
                  onChange={(e) => setM3uUrl(e.target.value)}
                  placeholder="https://example.com/playlist.m3u8"
                  className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="text-center text-xs font-bold text-white/40">— VEYA —</div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-purple-200">
                  M3U Dosya İçeriği (Metin Yapıştır)
                </label>
                <textarea
                  value={m3uText}
                  onChange={(e) => setM3uText(e.target.value)}
                  rows={5}
                  placeholder="#EXTM3U&#10;#EXTINF:-1 tvg-name=&quot;Kanal Adı&quot;,Kanal Adı&#10;https://.../stream.m3u8"
                  className="w-full rounded-2xl border border-white/10 bg-black/60 p-4 font-mono text-xs text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-purple-200">
                    Hedef Kategori
                  </label>
                  <select
                    value={m3uCategory}
                    onChange={(e) => setM3uCategory(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs text-white outline-none"
                  >
                    <option value="">Otomatik Ayrıştır (AI/Kural)</option>
                    <option value="Live TV">Canlı TV</option>
                    <option value="Series">Dizi</option>
                    <option value="Movies">Film</option>
                    <option value="Radio">Radyo</option>
                  </select>
                </div>
                <div className="flex items-center">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-white/80">
                    <input
                      type="checkbox"
                      checked={activate}
                      onChange={(e) => setActivate(e.target.checked)}
                      className="accent-purple-500"
                    />
                    Doğrudan yayına al
                  </label>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-white/10 pt-4">
                <button
                  onClick={() => setShowM3uModal(false)}
                  className="rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white/70 hover:bg-white/15"
                >
                  İptal
                </button>
                <button
                  onClick={handleM3uSubmit}
                  disabled={busy === "m3u-modal"}
                  className="flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-2 text-xs font-black text-black hover:bg-cyan-400 disabled:opacity-50"
                >
                  {busy === "m3u-modal" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  İçerikleri İçe Aktar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
