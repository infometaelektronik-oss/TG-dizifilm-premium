export type StreamCategory = "Live TV" | "Series" | "Movies" | "Radio";
export type StreamType = "HLS" | "MP4" | "AUDIO";
export type StreamStatus = "unknown" | "active" | "degraded" | "dead";
export type SubCategory =
  | "Ulusal"
  | "Haber"
  | "Yabancı Haber"
  | "Yabancı TV"
  | "Sinema"
  | "Yabancı Sinema"
  | "Dizi"
  | "Belgesel"
  | "Spor"
  | "Yabancı Spor"
  | "Çocuk"
  | "Müzik"
  | "Diğer";

const RADIO_HINTS =
  /\b(radyo|radio|fm|am\b|podcast|kral pop|kral fm|kral world|power fm|metro fm|virgin|joy|alem|slow|jazz|klasik|haber\s*radyo|trtfm|trt radyo)\b/i;
const AUDIO_EXT = /\.(aac|mp3|ogg|m4a)(?:\?|$)/i;
const VOD_EXT = /\.(mp4|mkv|avi|mov|webm)(?:\?|$)/i;

/** Turkish National & General Broadcasters */
export const TR_NATIONAL_HINTS =
  /\b(trt\s*1|trt\s*2|trt\s*avaz|trt\s*t[uü]rk|trt\s*diyanet|atv\b|kanal\s*d|show\s*tv|star\s*tv|now\s*tv|fox\s*tv|tv\s*8\b(?!(\.5|sports))|beyaz\s*tv|kanal\s*7|teve2|tlc|dmax|tg\s*tv)\b/i;

/** Turkish News Broadcasters */
export const TR_NEWS_HINTS =
  /\b(trt\s*haber|habert[uü]rk|ntv\b(?!(\s*plus|\s*sport))|cnn\s*t[uü]rk|a\s*haber|halk\s*tv|s[oö]zc[uü]\s*tv|tele\s*1|tv\s*100|tgrt\s*haber|bloomberg\s*ht|beng[uü]\s*t[uü]rk|[uü]lke\s*tv|flash\s*haber|krt\b|a\s*para|ekot[uü]rk|24\s*tv|haber\s*global)\b/i;

/** Turkish Sports Broadcasters */
export const TR_SPORTS_HINTS =
  /\b(trt\s*spor|a\s*spor|tv\s*8\.5|s\s*sport|sports\s*tv|fb\s*tv|gs\s*tv|bjk\s*tv|tivibu\s*spor|tjk\s*tv)\b/i;

/** Turkish Kids Broadcasters */
export const TR_KIDS_HINTS =
  /\b(trt\s*[cç]ocuk|minika\s*[cç]ocuk|minika\s*go|cartoon\s*network\s*tr|zarok\s*tv)\b/i;

/** Turkish Documentary & Nature Broadcasters */
export const TR_DOC_HINTS =
  /\b(trt\s*belgesel|habitat\s*tv|yaban\s*tv|tgrt\s*belgesel)\b/i;

/** Turkish Music Broadcasters */
export const TR_MUSIC_HINTS =
  /\b(kral\s*pop|kral\s*tv|power\s*tv|dream\s*t[uü]rk|number\s*1|numberone|trt\s*m[uü]zik)\b/i;

/** General Turkish Signals */
export const TR_GENERAL_HINTS =
  /(?:^|[^a-z0-9])(t[uü]rk|turkiye|türkiye|turkce|türkçe|ulusal|dizi|b[oö]l[uü]m|yerli|istanbul|ankara|izmir)(?=$|[^a-z0-9])|\.tr\//i;

/** Foreign News Broadcasters (MUST NOT mix with Turkish News) */
export const FOREIGN_NEWS_HINTS =
  /\b(bbc\s*(?:news|world)?|cnn\s*(?!t[uü]rk)|sky\s*news|france\s*24|al\s*jazeera|deutsche\s*welle|dw\b|euronews|rt\s*news|fox\s*news|msnbc|abc\s*news|cbs\s*news|cnbc|bloomberg(?!\s*ht)|reuters|nhk\s*world|cgtn|i24\s*news|cnews|rai\s*news)\b/i;

/** Foreign Sports Broadcasters */
export const FOREIGN_SPORTS_HINTS =
  /\b(sky\s*sports?|espn|eurosport|bein\s*sports?(?!\s*tr)|supersport|bt\s*sport|tsn\b|dazn|fox\s*sports?|star\s*sports?|nbc\s*sports?)\b/i;

/** Non-country groups from playlist metadata */
const NON_COUNTRY_GROUPS = new Set([
  "news", "music", "movies", "sports", "series", "kids", "general", "undefined",
  "movies;series", "animation;kids", "classic;series", "documentary", "entertainment",
  "vod movies (en)", "bilinmiyor", "auto", "channels", "live", "tv", "stream",
]);

/** English → Turkish country labels */
export const COUNTRY_TR: Record<string, string> = {
  Italy: "İtalya", UK: "İngiltere", "United Kingdom": "İngiltere", USA: "ABD",
  "United States": "ABD", Germany: "Almanya", France: "Fransa", Spain: "İspanya",
  Greece: "Yunanistan", Russia: "Rusya", Ukraine: "Ukrayna", Hungary: "Macaristan",
  "Czech Republic": "Çekya", Poland: "Polonya", Romania: "Romanya", Bulgaria: "Bulgaristan",
  Netherlands: "Hollanda", Belgium: "Belçika", Portugal: "Portekiz", Sweden: "İsveç",
  Norway: "Norveç", Finland: "Finlandiya", Denmark: "Danimarka", Austria: "Avusturya",
  Switzerland: "İsviçre", Canada: "Kanada", Brazil: "Brezilya", Argentina: "Arjantin",
  Chile: "Şili", Mexico: "Meksika", India: "Hindistan", China: "Çin", Korea: "Kore",
  "South Korea": "Güney Kore", Japan: "Japonya", "日本 / Japan": "Japonya",
  "United Arab Emirates": "BAE", Egypt: "Mısır", "Saudi Arabia": "Suudi Arabistan",
  Azerbaijan: "Azerbaycan", "North Macedonia": "Kuzey Makedonya", Albania: "Arnavutluk",
  Serbia: "Sırbistan", Croatia: "Hırvatistan", Bosnia: "Bosna", Mongolia: "Moğolistan",
  Iran: "İran", Iraq: "Irak", Israel: "İsrail", Australia: "Avustralya",
  Türkiye: "Türkiye", Turkey: "Türkiye", TR: "Türkiye",
};

export function countryLabel(country?: string | null): string {
  if (!country) return "Diğer Ülkeler";
  return COUNTRY_TR[country] || country;
}

/** Detects whether the item is genuinely Turkish or Foreign */
export function detectOriginAndSubCategory(
  title: string,
  sourceUrl: string,
  groupTitle?: string | null,
): { country: string | null; isForeign: boolean; subCategory: SubCategory } {
  const t = (title || "").trim();
  const g = (groupTitle || "").trim();
  const u = (sourceUrl || "").trim();
  const haystack = `${t} ${g} ${u}`.toLowerCase();

  // Explicit Foreign News Check
  if (FOREIGN_NEWS_HINTS.test(haystack) && !/cnn\s*t[uü]rk/i.test(t)) {
    return { country: detectForeignCountry(g), isForeign: true, subCategory: "Yabancı Haber" };
  }

  // Explicit Foreign Sports Check
  if (FOREIGN_SPORTS_HINTS.test(haystack) && !TR_SPORTS_HINTS.test(t)) {
    return { country: detectForeignCountry(g), isForeign: true, subCategory: "Yabancı Spor" };
  }

  // Turkish Checks
  const isTrNews = TR_NEWS_HINTS.test(t) || TR_NEWS_HINTS.test(g);
  if (isTrNews) {
    return { country: "Türkiye", isForeign: false, subCategory: "Haber" };
  }

  const isTrNational = TR_NATIONAL_HINTS.test(t) || (TR_GENERAL_HINTS.test(haystack) && /\b(ulusal|genel|ana)\b/i.test(haystack));
  if (isTrNational) {
    return { country: "Türkiye", isForeign: false, subCategory: "Ulusal" };
  }

  const isTrSports = TR_SPORTS_HINTS.test(t) || (TR_GENERAL_HINTS.test(haystack) && /\b(spor|lig|futbol)\b/i.test(haystack));
  if (isTrSports) {
    return { country: "Türkiye", isForeign: false, subCategory: "Spor" };
  }

  const isTrKids = TR_KIDS_HINTS.test(t) || (TR_GENERAL_HINTS.test(haystack) && /\b([cç]ocuk|bebek|animasyon)\b/i.test(haystack));
  if (isTrKids) {
    return { country: "Türkiye", isForeign: false, subCategory: "Çocuk" };
  }

  const isTrDoc = TR_DOC_HINTS.test(t) || (TR_GENERAL_HINTS.test(haystack) && /\b(belgesel|do[gğ]a|av)\b/i.test(haystack));
  if (isTrDoc) {
    return { country: "Türkiye", isForeign: false, subCategory: "Belgesel" };
  }

  const isTrMusic = TR_MUSIC_HINTS.test(t) || (TR_GENERAL_HINTS.test(haystack) && /\b(m[uü]zik|pop|t[uü]rk[uü])\b/i.test(haystack));
  if (isTrMusic) {
    return { country: "Türkiye", isForeign: false, subCategory: "Müzik" };
  }

  // General Turkish match
  if (TR_GENERAL_HINTS.test(haystack) || g.toLowerCase().includes("tur") || g.toLowerCase().includes("türkiye")) {
    return { country: "Türkiye", isForeign: false, subCategory: "Ulusal" };
  }

  // Otherwise, it is Foreign
  const foreignCountry = detectForeignCountry(g);
  let subCategory: SubCategory = "Yabancı TV";
  if (/\b(news|haber|noticias|nachrichten|actualit[eé])\b/i.test(haystack)) {
    subCategory = "Yabancı Haber";
  } else if (/\b(sport|spor|deportes|calcio|football)\b/i.test(haystack)) {
    subCategory = "Yabancı Spor";
  } else if (/\b(movie|cinema|film|kino|pelicula)\b/i.test(haystack)) {
    subCategory = "Yabancı Sinema";
  } else if (/\b(kids|enfant|kinder|infantil)\b/i.test(haystack)) {
    subCategory = "Çocuk";
  } else if (/\b(music|musique|musik)\b/i.test(haystack)) {
    subCategory = "Müzik";
  }

  return { country: foreignCountry, isForeign: true, subCategory };
}

function detectForeignCountry(groupTitle?: string | null): string | null {
  const group = (groupTitle || "").trim();
  if (!group) return null;
  const normalized = group.replace(/^VOD\s+/i, "").trim();
  if (NON_COUNTRY_GROUPS.has(normalized.toLowerCase())) return null;
  return normalized;
}

export function detectCountry(
  title: string,
  sourceUrl: string,
  groupTitle?: string | null,
): { country: string | null; isForeign: boolean } {
  const { country, isForeign } = detectOriginAndSubCategory(title, sourceUrl, groupTitle);
  return { country, isForeign };
}

export function classify(
  title: string,
  sourceUrl: string,
  groupTitle?: string,
): {
  category: StreamCategory;
  subCategory: SubCategory;
  streamType: StreamType;
  tags: string[];
  country: string | null;
  isForeign: boolean;
} {
  const haystack = `${title} ${sourceUrl} ${groupTitle || ""}`.toLowerCase();
  const path = (() => {
    try {
      return new URL(sourceUrl).pathname.toLowerCase();
    } catch {
      return sourceUrl.toLowerCase();
    }
  })();
  const isAudioExt = AUDIO_EXT.test(path);
  const isVodFile = VOD_EXT.test(path);
  const streamType: StreamType = isAudioExt
    ? "AUDIO"
    : path.endsWith(".m3u8")
      ? "HLS"
      : "MP4";

  const seriesHints = ["sezon", "season", "episode", "bölüm", "bolum", "s01e", "s02e", "s03e", "s04e", "dizi", "dizileri", "dizisi"];
  const movieHints = ["film", "filmi", "movies", "sinema", "cinema", "vod", "pelicula", "kino", "movie"];
  const isRadio = isAudioExt || RADIO_HINTS.test(haystack);
  const looksSeries = seriesHints.some((h) => haystack.includes(h));
  const looksMovie = movieHints.some((h) => haystack.includes(h)) || isVodFile;

  let category: StreamCategory = "Live TV";
  if (isRadio) {
    category = "Radio";
  } else if (looksSeries) {
    category = "Series";
  } else if (looksMovie) {
    category = "Movies";
  }

  const { country, isForeign, subCategory } = detectOriginAndSubCategory(title, sourceUrl, groupTitle);

  const tags = [
    streamType,
    category,
    subCategory,
    ...(country ? [country] : []),
    ...haystack
      .split(/[^a-z0-9ğüşöçıİĞÜŞÖÇ]+/i)
      .filter((x) => x.length > 3)
      .slice(0, 6),
  ];
  return {
    category,
    subCategory,
    streamType,
    tags: Array.from(new Set(tags)),
    country,
    isForeign,
  };
}
