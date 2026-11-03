import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, RefreshCcw } from "lucide-react";
import type { UserStream } from "@/lib/streams.functions";
import {
  listReplitEpisodes,
  addReplitEpisode,
  deleteReplitEpisode,
} from "@/lib/replit-content.functions";

type Episode = {
  id: string;
  contentId: string;
  season: number;
  episodeNumber: number;
  streamUrl: string;
  createdAt: string;
};

export function EpisodeManager({ streams }: { streams: UserStream[] }) {
  const listFn = useServerFn(listReplitEpisodes);
  const addFn = useServerFn(addReplitEpisode);
  const delFn = useServerFn(deleteReplitEpisode);

  const series = streams.filter((s) => s.category === "Series");
  const [contentId, setContentId] = useState<string>("");
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ season: 1, episodeNumber: 1, streamUrl: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reload = async (id: string) => {
    if (!id) return;
    setLoading(true);
    try { setEpisodes((await listFn({ data: { contentId: id } })) as Episode[]); }
    catch { setEpisodes([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (contentId) reload(contentId); }, [contentId]);

  const submit = async () => {
    if (!contentId) { setErr("Önce bir dizi seç."); return; }
    if (!form.streamUrl) { setErr("Stream URL zorunlu."); return; }
    setErr(null); setBusy(true);
    try {
      await addFn({ data: { contentId, season: form.season, episodeNumber: form.episodeNumber, streamUrl: form.streamUrl } });
      setForm({ season: form.season, episodeNumber: form.episodeNumber + 1, streamUrl: "" });
      await reload(contentId);
    } catch (e) { setErr(e instanceof Error ? e.message : "Eklenemedi"); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <section className="rounded-3xl border border-purple-500/20 bg-slate-950/80 p-4">
        <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-purple-200">Diziler</h3>
        {series.length === 0 && (
          <p className="text-xs text-white/50">Henüz dizi yok. "İçerik Ekle" sekmesinden Dizi türünde bir içerik ekle.</p>
        )}
        <ul className="max-h-[70vh] space-y-1 overflow-y-auto">
          {series.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => setContentId(s.id)}
                className={`w-full truncate rounded-xl px-3 py-2 text-left text-xs font-bold ${contentId === s.id ? "bg-purple-600 text-white" : "text-white/80 hover:bg-white/5"}`}
              >
                {s.title}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        {!contentId ? (
          <p className="text-sm text-white/60">Bölümlerini yönetmek için soldan bir dizi seç.</p>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-purple-200">Sezon</span>
                <input type="number" min={0} value={form.season}
                  onChange={(e) => setForm((f) => ({ ...f, season: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-purple-200">Bölüm No</span>
                <input type="number" min={0} value={form.episodeNumber}
                  onChange={(e) => setForm((f) => ({ ...f, episodeNumber: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500" />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-purple-200">Stream URL</span>
                <input value={form.streamUrl}
                  onChange={(e) => setForm((f) => ({ ...f, streamUrl: e.target.value }))}
                  placeholder="https://.../ep.mp4"
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500" />
              </label>
            </div>
            {err && <div className="mb-3 rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-200">{err}</div>}
            <div className="mb-4 flex gap-2">
              <button onClick={submit} disabled={busy}
                className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">
                <Plus className="h-4 w-4" /> {busy ? "Ekleniyor…" : "Bölüm Ekle"}
              </button>
              <button onClick={() => reload(contentId)}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/80">
                <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Yenile
              </button>
            </div>

            <div className="space-y-2">
              {episodes.length === 0 && !loading && <p className="text-xs text-white/50">Bu dizide henüz bölüm yok.</p>}
              {episodes
                .slice()
                .sort((a, b) => a.season - b.season || a.episodeNumber - b.episodeNumber)
                .map((ep) => (
                  <div key={ep.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                    <div className="w-16 text-xs font-black text-purple-200">S{ep.season}E{ep.episodeNumber}</div>
                    <div className="min-w-0 flex-1 truncate text-xs text-white/70">{ep.streamUrl}</div>
                    <button
                      onClick={async () => {
                        if (!confirm(`S${ep.season}E${ep.episodeNumber} silinsin mi?`)) return;
                        try { await delFn({ data: { id: ep.id } }); await reload(contentId); }
                        catch (e) { alert(e instanceof Error ? e.message : "Silinemedi"); }
                      }}
                      className="rounded-lg bg-white/10 p-2 text-white hover:bg-red-600/40"
                    ><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
