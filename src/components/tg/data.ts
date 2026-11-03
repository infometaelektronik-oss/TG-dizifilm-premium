export type Media = {
  id: string;
  title: string;
  year: number;
  genre: string;
  genres: string[];
  duration: string;
  rating: string;
  poster: string;
  backdrop: string;
  description: string;
  trailer?: string;
  video?: string;
  // V2 fields
  publishedAt?: string;
  referer?: string;
  subCategory?: string;
  seriesTitle?: string;
  season?: number;
  episode?: number;
  country?: string;
  isForeign?: boolean;
  streamId?: string;
  backupUrls?: string[];
  cast?: string[];
  isLive?: boolean;
};

export type Channel = {
  id: string;
  name: string;
  logo: string;
  accent: string;
  items: Media[];
};

export type ScheduleEntry = {
  time: string;
  title: string;
  kind: "Dizi" | "Film" | "Haber" | "Yarışma" | "Spor" | "Magazin" | "Belgesel";
  live?: boolean;
};

export const GENRES = [
  "Tümü",
  "Dram",
  "Komedi",
  "Aksiyon",
  "Romantik",
  "Tarih",
  "Polisiye",
  "Belgesel",
  "Spor",
] as const;

// Uygulamaya sabit yazılmış örnek (sahte) içerikler kaldırıldı.
// Tüm içerik yalnızca veritabanından gelir.
