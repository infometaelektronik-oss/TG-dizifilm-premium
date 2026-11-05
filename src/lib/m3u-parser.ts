// Lightweight M3U/M3U8 playlist parser focused on #EXTINF entries.
// Also detects series episode metadata (S01E02, Sezon 1 Bölüm 2) and sub-category.

export type M3UEntry = {
  title: string;
  url: string;
  groupTitle?: string;
  tvgId?: string;
  tvgLogo?: string;
  attrs: Record<string, string>;
  series?: { title: string; season: number; episode: number };
  subCategory?: SubCategory;
};

export type SubCategory =
  | "Ulusal"
  | "Haber"
  | "Sinema"
  | "Dizi"
  | "Belgesel"
  | "Spor"
  | "Çocuk"
  | "Müzik"
  | "Diğer";

const ATTR_RE = /([\w-]+)="([^"]*)"/g;

function findMetadataDelimiter(line: string): number {
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    if (line[index] === '"') quoted = !quoted;
    if (line[index] === "," && !quoted) return index;
  }
  return -1;
}

const SUB_RULES: Array<[SubCategory, RegExp]> = [
  ["Haber", /\b(haber|news|cnn|bbc|ntv|a haber|halk tv|haberturk|tgrt)\b/i],
  ["Spor", /\b(spor|sport|sports|bein|smart spor|tivibu spor|s sport|tjk)\b/i],
  ["Belgesel", /\b(belgesel|discovery|nat geo|national geographic|history|animal planet|trt belgesel|da vinci)\b/i],
  ["Çocuk", /\b(cocuk|çocuk|kids|cartoon|nick|disney|baby|minika|trt cocuk)\b/i],
  ["Sinema", /\b(sinema|movie|film|cinema|kanal d max|tv2|fx|tnt)\b/i],
  ["Müzik", /\b(muzik|müzik|music|kral|power|number ?one|mtv|vh1)\b/i],
  ["Ulusal", /\b(trt 1|trt2|trt haber|atv|star tv|kanal d|show tv|fox tv|tv8|now tv|tlc)\b/i],
];

export function guessSubCategory(...parts: (string | undefined)[]): SubCategory | undefined {
  const hay = parts.filter(Boolean).join(" ");
  for (const [name, re] of SUB_RULES) if (re.test(hay)) return name;
  return undefined;
}

const SERIES_PATTERNS = [
  /^(?<title>.+?)[\s._-]+S(?<s>\d{1,2})\s*E(?<e>\d{1,3})\b/i,
  /^(?<title>.+?)[\s._-]+Sezon\s*(?<s>\d{1,2})\s*B(?:ö|o)l(?:ü|u)m\s*(?<e>\d{1,3})\b/i,
  /^(?<title>.+?)[\s._-]+(?<s>\d{1,2})x(?<e>\d{1,3})\b/i,
];

export function detectSeries(title: string, groupTitle?: string):
  | { title: string; season: number; episode: number }
  | undefined {
  const hay = `${title} ${groupTitle || ""}`;
  for (const re of SERIES_PATTERNS) {
    const m = re.exec(hay);
    if (m && m.groups) {
      return {
        title: m.groups.title.replace(/[._]+/g, " ").trim(),
        season: parseInt(m.groups.s, 10),
        episode: parseInt(m.groups.e, 10),
      };
    }
  }
  return undefined;
}

export function parseM3U(text: string): M3UEntry[] {
  const lines = text.split(/\r?\n/);
  const entries: M3UEntry[] = [];
  let current: Partial<M3UEntry> | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#EXTM3U")) continue;

    if (line.startsWith("#EXTINF")) {
      // Attribute values (notably http-user-agent) may contain commas. The
      // playlist title starts after the first comma outside quoted values.
      const commaIdx = findMetadataDelimiter(line);
      const attrPart = commaIdx >= 0 ? line.slice(0, commaIdx) : line;
      const title = commaIdx >= 0 ? line.slice(commaIdx + 1).trim() : "";
      const attrs: Record<string, string> = {};
      for (const m of attrPart.matchAll(ATTR_RE)) attrs[m[1].toLowerCase()] = m[2];
      current = {
        title: title || attrs["tvg-name"] || "Untitled",
        groupTitle: attrs["group-title"],
        tvgId: attrs["tvg-id"],
        tvgLogo: attrs["tvg-logo"],
        attrs,
      };
      continue;
    }

    if (line.startsWith("#")) continue;

    if (/^https?:\/\//i.test(line)) {
      if (!current) current = { title: "Untitled", attrs: {} };
      const t = current.title || "Untitled";
      const g = current.groupTitle;
      entries.push({
        title: t,
        url: line,
        groupTitle: g,
        tvgId: current.tvgId,
        tvgLogo: current.tvgLogo,
        attrs: current.attrs || {},
        series: detectSeries(t, g),
        subCategory: guessSubCategory(t, g),
      });
      current = null;
    }
  }

  return entries;
}

// Strip control characters and clamp text length. Returns null if empty.
export function sanitizeText(input: string | undefined | null, max = 240): string | null {
  if (!input) return null;
  // eslint-disable-next-line no-control-regex
  const clean = String(input).replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  if (!clean) return null;
  return clean.slice(0, max);
}

export function sanitizeUrl(input: string | undefined | null): string | null {
  if (!input) return null;
  const s = String(input).trim();
  if (!/^https?:\/\//i.test(s)) return null;
  return s.slice(0, 2000);
}
