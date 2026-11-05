import { useEffect, useState } from "react";
import {
  Monitor,
  Palette,
  Volume2,
  AudioLines,
  Sparkles,
  Wifi,
  Subtitles,
  Languages,
  Lock,
  Sun,
  Contrast,
  Zap,
} from "lucide-react";

type Slider = { id: string; label: string; value: number; min?: number; max?: number; icon?: any };

// Persist any Settings toggle/slider to localStorage so it survives reloads.
function usePersistentState<T>(key: string, initial: T) {
  const storageKey = `tg-settings:${key}`;
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw !== null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      /* quota / private mode */
    }
  }, [storageKey, value]);
  return [value, setValue] as const;
}

export function SettingsView({
  registerRef,
  focusedKey,
}: {
  registerRef: (key: string, el: HTMLElement | null) => void;
  focusedKey: string | null;
}) {
  // Display
  const [picture, setPicture] = usePersistentState("picture", "Sinema");
  const [brightness, setBrightness] = usePersistentState("brightness", 70);
  const [contrast, setContrast] = usePersistentState("contrast", 65);
  const [saturation, setSaturation] = usePersistentState("saturation", 60);
  const [sharpness, setSharpness] = usePersistentState("sharpness", 55);
  const [hdr, setHdr] = usePersistentState("hdr", true);
  const [motion, setMotion] = usePersistentState("memc", false);
  const [colorTemp, setColorTemp] = usePersistentState("colorTemp", "Sıcak");

  // Audio
  const [audioMode, setAudioMode] = usePersistentState("audioMode", "Dolby Atmos");
  const [atmos, setAtmos] = usePersistentState("atmos", true);
  const [nightMode, setNightMode] = usePersistentState("nightMode", false);
  const [dialogue, setDialogue] = usePersistentState("dialogue", true);
  const [eq, setEq] = usePersistentState<number[]>("eq", [60, 55, 50, 55, 60, 65, 60, 55, 50, 55]);

  // Subtitle/Language
  const [subtitle, setSubtitle] = usePersistentState("subtitle", "Türkçe");
  const [subtitleSize, setSubtitleSize] = usePersistentState("subtitleSize", 22);
  const [audioLang, setAudioLang] = usePersistentState("audioLang", "Orijinal");
  const [liveSubtitleAiPref, setLiveSubtitleAiPref] = usePersistentState("liveSubtitleAiPref", true);

  // Parental + Network + Dynamic Tuning
  const [pin, setPin] = usePersistentState("pin", false);
  const [bandwidth, setBandwidth] = usePersistentState("bandwidth", 85);
  const [adaptiveBitrate, setAdaptiveBitrate] = usePersistentState("adaptiveBitrate", true);
  const [dynamicUiTuning, setDynamicUiTuning] = usePersistentState("dynamicUiTuning", true);

  let idx = 0;
  const key = () => `set-${idx++}`;

  return (
    <div className="grid grid-cols-2 gap-6 pb-10">
      {/* DISPLAY */}
      <Section title="Görüntü Ayarları" icon={<Monitor className="h-5 w-5" />}>
        <ChoiceRow
          label="Sinema Modu"
          options={["Standart", "Sinema", "Canlı", "Spor", "Oyun", "HDR Pro"]}
          value={picture}
          onChange={setPicture}
          registerRef={registerRef}
          focusedKey={focusedKey}
          baseKey={key()}
        />
        <SliderRow
          label="Parlaklık"
          icon={<Sun className="h-4 w-4" />}
          value={brightness}
          onChange={setBrightness}
          focusKey={key()}
          focusedKey={focusedKey}
          registerRef={registerRef}
        />
        <SliderRow
          label="Kontrast"
          icon={<Contrast className="h-4 w-4" />}
          value={contrast}
          onChange={setContrast}
          focusKey={key()}
          focusedKey={focusedKey}
          registerRef={registerRef}
        />
        <SliderRow
          label="Renk Doygunluğu"
          icon={<Palette className="h-4 w-4" />}
          value={saturation}
          onChange={setSaturation}
          focusKey={key()}
          focusedKey={focusedKey}
          registerRef={registerRef}
        />
        <SliderRow
          label="Keskinlik"
          icon={<Zap className="h-4 w-4" />}
          value={sharpness}
          onChange={setSharpness}
          focusKey={key()}
          focusedKey={focusedKey}
          registerRef={registerRef}
        />
        <ChoiceRow
          label="Renk Sıcaklığı"
          options={["Soğuk", "Nötr", "Sıcak"]}
          value={colorTemp}
          onChange={setColorTemp}
          registerRef={registerRef}
          focusedKey={focusedKey}
          baseKey={key()}
        />
        <ToggleRow label="HDR10+ / Dolby Vision" value={hdr} onChange={setHdr} focusKey={key()} focusedKey={focusedKey} registerRef={registerRef} />
        <ToggleRow label="Hareket Yumuşatma (MEMC)" value={motion} onChange={setMotion} focusKey={key()} focusedKey={focusedKey} registerRef={registerRef} />
      </Section>

      {/* AUDIO */}
      <Section title="Ses Ayarları" icon={<Volume2 className="h-5 w-5" />}>
        <ChoiceRow
          label="Ses Çıkışı"
          options={["Stereo", "Surround 5.1", "Dolby Atmos", "DTS:X"]}
          value={audioMode}
          onChange={setAudioMode}
          registerRef={registerRef}
          focusedKey={focusedKey}
          baseKey={key()}
        />
        <ToggleRow
          label="Dolby Atmos Sürükleyici Ses"
          value={atmos}
          onChange={setAtmos}
          focusKey={key()}
          focusedKey={focusedKey}
          registerRef={registerRef}
        />
        <ToggleRow
          label="Gece Modu (Dinamik Sıkıştırma)"
          value={nightMode}
          onChange={setNightMode}
          focusKey={key()}
          focusedKey={focusedKey}
          registerRef={registerRef}
        />
        <ToggleRow
          label="Diyalog Belirginleştirici"
          value={dialogue}
          onChange={setDialogue}
          focusKey={key()}
          focusedKey={focusedKey}
          registerRef={registerRef}
        />

        {/* Equalizer */}
        <div className="mt-2 rounded-2xl border border-white/10 bg-black/40 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-purple-200">
            <AudioLines className="h-4 w-4" /> Equalizer (10 Bant)
          </div>
          <div className="flex h-40 items-end gap-2">
            {["32", "64", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"].map((hz, i) => {
              const fk = key();
              const isFocus = focusedKey === fk;
              return (
                <button
                  key={hz}
                  ref={(el) => registerRef(fk, el)}
                  data-focus-key={fk}
                  tabIndex={-1}
                  onClick={() =>
                    setEq((arr) => arr.map((v, j) => (j === i ? (v + 10) % 110 : v)))
                  }
                  className={`group flex flex-1 flex-col items-center gap-1 rounded-xl p-1 outline-none transition ${
                    isFocus ? "neon-ring scale-105 bg-purple-600/20" : "hover:bg-white/5"
                  }`}
                >
                  <div className="relative flex h-28 w-full items-end justify-center rounded-md bg-white/5">
                    <div
                      className="w-3 rounded-full bg-gradient-to-t from-purple-700 via-purple-500 to-fuchsia-300 shadow-[0_0_15px_rgba(168,85,247,0.7)]"
                      style={{ height: `${eq[i]}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-white/60">{hz}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            {["Düz", "Pop", "Rock", "Sinema", "Klasik", "Bass+"].map((p) => {
              const fk = key();
              const isFocus = focusedKey === fk;
              return (
                <button
                  key={p}
                  ref={(el) => registerRef(fk, el)}
                  data-focus-key={fk}
                  tabIndex={-1}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold outline-none transition ${
                    isFocus
                      ? "neon-ring scale-105 bg-purple-600 text-white"
                      : "bg-white/5 text-white/70 hover:text-white"
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      {/* SUBTITLES & LANGUAGE */}
      <Section title="Altyazı & Dil" icon={<Subtitles className="h-5 w-5" />}>
        <ChoiceRow
          label="Altyazı Dili"
          options={["Kapalı", "Türkçe", "English", "Deutsch", "العربية"]}
          value={subtitle}
          onChange={setSubtitle}
          registerRef={registerRef}
          focusedKey={focusedKey}
          baseKey={key()}
        />
        <SliderRow
          label="Altyazı Boyutu"
          icon={<Sparkles className="h-4 w-4" />}
          value={subtitleSize}
          onChange={setSubtitleSize}
          min={12}
          max={48}
          focusKey={key()}
          focusedKey={focusedKey}
          registerRef={registerRef}
        />
        <ChoiceRow
          label="Ses Dili"
          options={["Orijinal", "Türkçe Dublaj", "English", "Çoklu"]}
          value={audioLang}
          onChange={setAudioLang}
          registerRef={registerRef}
          focusedKey={focusedKey}
          baseKey={key()}
        />
        <ToggleRow
          label="Canlı AI Altyazı (Yabancı Yayınlarda Çeviri)"
          value={liveSubtitleAiPref}
          onChange={setLiveSubtitleAiPref}
          focusKey={key()}
          focusedKey={focusedKey}
          registerRef={registerRef}
          icon={<Sparkles className="h-4 w-4 text-amber-400" />}
        />
      </Section>

      {/* NETWORK & PARENTAL */}
      <Section title="Yayın & Ebeveyn Kontrolü" icon={<Wifi className="h-5 w-5" />}>
        <ToggleRow
          label="Kanal Kalite / Adaptif Bitrate (Donma Önleyici)"
          value={adaptiveBitrate}
          onChange={setAdaptiveBitrate}
          focusKey={key()}
          focusedKey={focusedKey}
          registerRef={registerRef}
          icon={<Zap className="h-4 w-4 text-cyan-400" />}
        />
        <ToggleRow
          label="Dinamik Arayüz Sıralaması (Dynamic UI Tuning)"
          value={dynamicUiTuning}
          onChange={setDynamicUiTuning}
          focusKey={key()}
          focusedKey={focusedKey}
          registerRef={registerRef}
          icon={<Palette className="h-4 w-4 text-purple-400" />}
        />
        <SliderRow
          label="Maks. Bant Genişliği"
          icon={<Wifi className="h-4 w-4" />}
          value={bandwidth}
          onChange={setBandwidth}
          focusKey={key()}
          focusedKey={focusedKey}
          registerRef={registerRef}
        />
        <ToggleRow
          label="Otomatik 4K (Hızlı bağlantıda)"
          value={true}
          onChange={() => {}}
          focusKey={key()}
          focusedKey={focusedKey}
          registerRef={registerRef}
        />
        <ToggleRow
          label="Ebeveyn PIN Kilidi"
          value={pin}
          onChange={setPin}
          focusKey={key()}
          focusedKey={focusedKey}
          registerRef={registerRef}
          icon={<Lock className="h-4 w-4" />}
        />
        <ChoiceRow
          label="Yaş Sınırı"
          options={["7+", "13+", "16+", "18+"]}
          value="13+"
          onChange={() => {}}
          registerRef={registerRef}
          focusedKey={focusedKey}
          baseKey={key()}
        />
        <div className="mt-2 rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4 text-xs text-purple-100">
          <div className="font-bold uppercase tracking-widest text-purple-300">
            <Languages className="mr-1 inline h-3 w-3" /> Sistem
          </div>
          <div className="mt-1 text-white/70">
            TG. Dizi Film v2.4 · Dolby Atmos™ Sertifikalı · 4K HDR10+ Hazır
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600/20 text-purple-300">
          {icon}
        </div>
        <h3 className="text-lg font-black tracking-tight">{title}</h3>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  focusKey,
  focusedKey,
  registerRef,
  icon,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  focusKey: string;
  focusedKey: string | null;
  registerRef: (k: string, el: HTMLElement | null) => void;
  icon?: React.ReactNode;
}) {
  const isFocus = focusedKey === focusKey;
  return (
    <button
      ref={(el) => registerRef(focusKey, el)}
      data-focus-key={focusKey}
      tabIndex={-1}
      onClick={() => onChange(!value)}
      className={`flex items-center justify-between rounded-xl px-4 py-3 text-left outline-none transition ${
        isFocus ? "neon-ring scale-[1.02] bg-purple-600/20" : "bg-white/5 hover:bg-white/10"
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-white">
        {icon}
        {label}
      </span>
      <span
        className={`relative h-6 w-11 rounded-full transition ${value ? "bg-purple-500" : "bg-white/20"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${value ? "left-5" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}

function SliderRow({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  icon,
  focusKey,
  focusedKey,
  registerRef,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  icon?: React.ReactNode;
  focusKey: string;
  focusedKey: string | null;
  registerRef: (k: string, el: HTMLElement | null) => void;
}) {
  const isFocus = focusedKey === focusKey;
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <button
      ref={(el) => registerRef(focusKey, el)}
      data-focus-key={focusKey}
      tabIndex={-1}
      onClick={() => onChange(Math.min(max, value + 5))}
      className={`rounded-xl px-4 py-3 text-left outline-none transition ${
        isFocus ? "neon-ring scale-[1.02] bg-purple-600/20" : "bg-white/5 hover:bg-white/10"
      }`}
    >
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-semibold text-white">
          {icon}
          {label}
        </span>
        <span className="font-mono text-purple-200">{value}</span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 to-fuchsia-400 shadow-[0_0_15px_rgba(168,85,247,0.7)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </button>
  );
}

function ChoiceRow({
  label,
  options,
  value,
  onChange,
  registerRef,
  focusedKey,
  baseKey,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  registerRef: (k: string, el: HTMLElement | null) => void;
  focusedKey: string | null;
  baseKey: string;
}) {
  return (
    <div className="rounded-xl bg-white/5 px-4 py-3">
      <div className="mb-2 text-sm font-semibold text-white">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt, i) => {
          const fk = `${baseKey}-${i}`;
          const isFocus = focusedKey === fk;
          const isActive = opt === value;
          return (
            <button
              key={opt}
              ref={(el) => registerRef(fk, el)}
              data-focus-key={fk}
              tabIndex={-1}
              onClick={() => onChange(opt)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider outline-none transition ${
                isFocus
                  ? "neon-ring scale-105 bg-purple-600 text-white"
                  : isActive
                    ? "bg-purple-500/30 text-purple-100 ring-1 ring-purple-400/50"
                    : "bg-white/5 text-white/60"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
