// Replit-hosted content backend. Server-only.
const BASE = "https://content-sync-server--infometaelektro.replit.app/api";
const TOKEN = process.env.REPLIT_CONTENT_TOKEN || "tgdizifilm";

export type ReplitStream = {
  id: string;
  title: string;
  type: "movie" | "series";
  category: string;
  streamUrl: string;
  posterUrl: string;
  createdAt: string;
};

export type ReplitEpisode = {
  id: string;
  contentId: string;
  season: number;
  episodeNumber: number;
  streamUrl: string;
  createdAt: string;
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!r.ok) throw new Error(`Replit API ${r.status}: ${await r.text().catch(() => "")}`);
  if (r.status === 204) return undefined as T;
  const ct = r.headers.get("content-type") || "";
  if (!ct.includes("json")) return undefined as T;
  return (await r.json()) as T;
}

export const replitApi = {
  listStreams: () => req<ReplitStream[]>("/streams"),
  addStream: (b: { title: string; type: "movie" | "series"; category: string; streamUrl: string; posterUrl: string }) =>
    req<ReplitStream>("/streams/admin-add", { method: "POST", body: JSON.stringify(b) }),
  deleteStream: (id: string) => req<void>(`/streams/${encodeURIComponent(id)}`, { method: "DELETE" }),
  listEpisodes: (contentId: string) =>
    req<ReplitEpisode[]>(`/episodes?contentId=${encodeURIComponent(contentId)}`),
  addEpisode: (b: { contentId: string; season: number; episodeNumber: number; streamUrl: string }) =>
    req<ReplitEpisode>("/episodes", { method: "POST", body: JSON.stringify(b) }),
  deleteEpisode: (id: string) => req<void>(`/episodes/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
