import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Bu dosyadaki fonksiyonlar artik scraper_seeds tabanli otonom sisteme devredilmistir.
// Dosya, yardimci tipler veya ileride gerekebilecek legacy referanslar icin bosaltildi.

export type ScrapedItem = {
  title: string;
  category: "Live TV" | "Series" | "Movies" | "Radio";
  description?: string;
  posterUrl?: string;
  logoUrl?: string;
  backdropUrl?: string;
  channelGroup?: string;
  subCategory?: string;
  streamUrl?: string;
  referer?: string;
  tags?: string[];
};

export type PendingImport = {
  id: string;
  sourceUrl: string | null;
  status: "pending" | "approved" | "rejected";
  payload: ScrapedItem;
  createdAt: string;
};
