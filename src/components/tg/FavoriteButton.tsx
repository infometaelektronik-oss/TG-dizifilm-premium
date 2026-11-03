import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function FavoriteButton({ seriesKey }: { seriesKey: string }) {
  const key = seriesKey.trim().toLowerCase();
  const [userId, setUserId] = useState<string | null>(null);
  const [fav, setFav] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (!uid) return;
      const { data: row } = await supabase.from("user_favorites").select("id").eq("series_key", key).maybeSingle();
      setFav(Boolean(row));
    });
  }, [key]);

  const toggle = async () => {
    if (!userId) {
      setHint("Takip için giriş yapın");
      setTimeout(() => setHint(null), 2500);
      return;
    }
    if (fav) {
      await supabase.from("user_favorites").delete().eq("series_key", key);
      setFav(false);
    } else {
      await supabase.from("user_favorites").insert({ user_id: userId, series_key: key, label: seriesKey });
      setFav(true);
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
      setHint("Yeni bölümde bildirim alacaksınız");
      setTimeout(() => setHint(null), 2500);
    }
  };

  return (
    <div className="relative mr-2 shrink-0">
      <button
        onClick={toggle}
        aria-label={fav ? "Takipten çık" : "Takip et"}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur outline-none ring-purple-500 transition focus:ring-4 md:h-12 md:w-12"
      >
        <Heart className={`h-6 w-6 ${fav ? "fill-current text-fuchsia-400" : ""}`} />
      </button>
      {hint && (
        <div className="absolute right-0 top-14 whitespace-nowrap rounded-lg bg-black/90 px-3 py-1.5 text-xs text-white">
          {hint}
        </div>
      )}
    </div>
  );
}
