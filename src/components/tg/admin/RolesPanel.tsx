import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, Users } from "lucide-react";
import { listMembers, setMemberRole, type MemberRow } from "@/lib/admin-ops.functions";

const ROLES = [
  { id: "admin", label: "Admin", hint: "Tam yetki (sistem)" },
  { id: "super_admin", label: "Süper Admin", hint: "Tüm modüller + rol yönetimi" },
  { id: "content_editor", label: "İçerik Editörü", hint: "Kart/bölüm düzenleme" },
  { id: "tech_operator", label: "Teknik Operatör", hint: "Kazıyıcı, loglar, sistem" },
] as const;

export function RolesPanel() {
  const listFn = useServerFn(listMembers);
  const setRoleFn = useServerFn(setMemberRole);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setMembers(await listFn());
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [listFn]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggle = async (userId: string, role: string, grant: boolean) => {
    setNote(null);
    try {
      await setRoleFn({ data: { userId, role: role as "admin", grant } });
      refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "İşlem başarısız");
    }
  };

  const filtered = members.filter((m) => m.email.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-amber-500/25 bg-slate-900/60 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-200">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-amber-100">Rol Bazlı Yönetim (RBAC)</h3>
            <p className="text-xs text-white/60">
              Çoklu admin desteği: Süper Admin, İçerik Editörü ve Teknik Operatör yetkileri.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          {ROLES.map((r) => (
            <div key={r.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="text-sm font-bold text-white/90">{r.label}</div>
              <div className="text-[11px] text-white/50">{r.hint}</div>
            </div>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="E-posta ara…"
          className="mt-4 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm sm:max-w-xs"
        />
        {note && <div className="mt-3 text-xs text-amber-300">{note}</div>}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5">
        <div className="border-b border-white/10 px-4 py-3 text-sm font-bold">Kullanıcılar ({filtered.length})</div>
        {loading ? (
          <div className="p-6 text-center text-white/60">Yükleniyor…</div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map((m) => (
              <div key={m.userId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-bold text-white/90">
                    <ShieldCheck className={`h-4 w-4 ${m.roles.length ? "text-emerald-300" : "text-white/25"}`} />
                    <span className="truncate">{m.email}</span>
                  </div>
                  <div className="mt-1 text-[10px] text-white/40">
                    kayıt: {new Date(m.createdAt).toLocaleDateString("tr-TR")}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map((r) => {
                    const has = m.roles.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        onClick={() => toggle(m.userId, r.id, !has)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                          has ? "bg-emerald-500 text-black" : "bg-white/5 text-white/60 hover:bg-white/10"
                        }`}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
