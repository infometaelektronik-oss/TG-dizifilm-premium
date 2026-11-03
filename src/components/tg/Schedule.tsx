import { CalendarClock } from "lucide-react";

// Örnek (sahte) yayın akışı kaldırıldı. Gerçek akış EPG kaynakları eklendiğinde gösterilir.
export function ScheduleView({
  registerRef,
  focusedKey,
}: {
  registerRef: (key: string, el: HTMLElement | null) => void;
  focusedKey: string | null;
}) {
  return (
    <div className="space-y-8 pb-10">
      <div
        ref={(el) => registerRef("sched-0-0", el)}
        data-focus-key="sched-0-0"
        tabIndex={-1}
        className={`rounded-3xl border border-dashed border-white/15 bg-white/5 p-12 text-center text-white/60 outline-none ${
          focusedKey === "sched-0-0" ? "neon-ring" : ""
        }`}
      >
        <CalendarClock className="mx-auto mb-3 h-10 w-10 text-purple-300" />
        Henüz yayın akışı eklenmedi.
      </div>
    </div>
  );
}
