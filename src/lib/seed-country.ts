// Ülke kodu → Türkçe ülke adı. Tarama kaynağının (iptv-org ülke listesi, Radio Browser)
// adresinden veya kanalın tvg-id sonekinden (ör. "Franceinfo.fr") ülkeyi kesin olarak bulur.

export const ISO_COUNTRY_TR: Record<string, string> = {
  tr: "Türkiye", az: "Azerbaycan", cy: "Kıbrıs", de: "Almanya", fr: "Fransa", gb: "İngiltere", uk: "İngiltere",
  us: "ABD", it: "İtalya", es: "İspanya", nl: "Hollanda", be: "Belçika", at: "Avusturya", ch: "İsviçre",
  gr: "Yunanistan", bg: "Bulgaristan", ro: "Romanya", ru: "Rusya", ua: "Ukrayna", pl: "Polonya",
  pt: "Portekiz", se: "İsveç", no: "Norveç", fi: "Finlandiya", dk: "Danimarka", hu: "Macaristan",
  cz: "Çekya", rs: "Sırbistan", hr: "Hırvatistan", ba: "Bosna", al: "Arnavutluk", mk: "Kuzey Makedonya",
  xk: "Kosova", ge: "Gürcistan", kz: "Kazakistan", uz: "Özbekistan", tm: "Türkmenistan", kg: "Kırgızistan",
  ir: "İran", iq: "Irak", sy: "Suriye", sa: "Suudi Arabistan", ae: "BAE", qa: "Katar", eg: "Mısır",
  il: "İsrail", lb: "Lübnan", jo: "Ürdün", ma: "Fas", dz: "Cezayir", tn: "Tunus", in: "Hindistan",
  pk: "Pakistan", bd: "Bangladeş", cn: "Çin", jp: "Japonya", kr: "Güney Kore", au: "Avustralya",
  ca: "Kanada", mx: "Meksika", br: "Brezilya", ar: "Arjantin", cl: "Şili", co: "Kolombiya",
};

/** Kaynak listede ülke sabitse döndürür. */
export function countryFromSeedUrl(url: string): string | null {
  const m =
    url.match(/\/countries\/([a-z]{2})\.m3u/i) ||
    url.match(/\/streams\/([a-z]{2})(?:_[a-z0-9]+)?\.m3u/i) ||
    url.match(/bycountrycodeexact\/([a-z]{2})/i);
  if (!m) return null;
  return ISO_COUNTRY_TR[m[1].toLowerCase()] || m[1].toUpperCase();
}

/** iptv-org tvg-id "Kanal.fr@SD" → Fransa */
export function countryFromTvgId(tvgId?: string | null): string | null {
  if (!tvgId) return null;
  const m = tvgId.match(/\.([a-z]{2})(?:@|$)/i);
  if (!m) return null;
  return ISO_COUNTRY_TR[m[1].toLowerCase()] || null;
}
