import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Note = { id: string; title: string; body: string | null; read_at: string | null; created_at: string };

export function NotificationBell() {
  const [userId, setUserId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUserId(s?.user?.id ?? null));
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("notifications")
      .select("id,title,body,read_at,created_at")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setNotes((data as Note[]) || []));
    const ch = supabase
      .channel(`notes-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as Note;
          setNotes((prev) => [n, ...prev].slice(0, 20));
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification(n.title, { body: n.body ?? undefined });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId]);

  if (!userId) return null;
  const unread = notes.filter((n) => !n.read_at).length;

  const markAll = async () => {
    const ids = notes.filter((n) => !n.read_at).map((n) => n.id);
    if (ids.length === 0) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
    setNotes((p) => p.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
  };

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) markAll();
        }}
        aria-label="Bildirimler"
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white outline-none ring-purple-500 focus:ring-4"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-fuchsia-500 px-1 text-[10px] font-bold">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-white/10 bg-black/95 p-2 shadow-2xl">
          <div className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-purple-300">Bildirimler</div>
          {notes.length === 0 ? (
            <div className="px-3 py-4 text-sm text-white/50">Takip ettiğiniz dizilerde yeni bölüm olunca burada görünür.</div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {notes.map((n) => (
                <div key={n.id} className="rounded-xl px-3 py-2 hover:bg-white/5">
                  <div className="text-sm font-semibold text-white">{n.title}</div>
                  {n.body && <div className="text-xs text-white/60">{n.body}</div>}
                  <div className="mt-0.5 text-[10px] text-white/40">{new Date(n.created_at).toLocaleString("tr-TR")}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
