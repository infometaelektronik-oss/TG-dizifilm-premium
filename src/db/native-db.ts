/**
 * Native Database Engine for TG. Dizi Film
 * Completely independent of Supabase and Lovable.
 * Supports file-based persistence on server, memory + localStorage in client,
 * with full PostgREST-compatible fluent API.
 */
import initialData from "../../data/initial_data.json";

export interface DbData {
  user_streams: any[];
  home_rows: any[];
  home_row_items: any[];
  layout_sections: any[];
  app_settings: any[];
  tg_tv_schedule: any[];
  archive_episodes: any[];
  epg_sources: any[];
  epg_programmes: any[];
  automation_rules: any[];
  audit_logs: any[];
  system_metrics: any[];
  user_roles: any[];
  user_favorites: any[];
  notifications: any[];
  scraper_seeds: any[];
  watch_events: any[];
  pending_imports: any[];
}

const DEFAULT_ADMIN_USER = {
  id: "f114d378-e423-4f17-9a83-b9b809d96d6c",
  email: "admin@tgdizifilm.app",
  user_metadata: {
    name: "TG Admin",
    avatar_url: "/assets/aistudio/Media_item_1_1bba30da.jpg",
  },
  app_metadata: { role: "admin" },
  role: "authenticated",
  aud: "authenticated",
  created_at: new Date().toISOString(),
};

// Initial featured TG TV stream with the provided channel logo
const TG_TV_STREAM = {
  id: "tgtv-official-channel",
  title: "TG TV (Canlı Yayın)",
  source_url: "https://d1rc86nwwc9fag.cloudfront.net/vglive-sk-472500/abpnews/master.m3u8",
  category: "Live TV",
  stream_type: "HLS",
  poster_url: "/assets/aistudio/Media_item_1_1bba30da.jpg",
  backdrop_url: "/assets/aistudio/Media_item_1_1bba30da.jpg",
  logo_url: "/assets/aistudio/Media_item_1_1bba30da.jpg",
  description: "TG. Dizi Film resmi yayın kanalı. Kesintisiz Türk dizileri, sinema filmleri ve özel içerikler.",
  tags: ["TG TV", "Ulusal", "Dizi", "Sinema", "Canlı"],
  is_active: true,
  status: "active",
  last_checked_at: new Date().toISOString(),
  failure_count: 0,
  created_at: "2026-10-31T00:00:00.000Z",
  updated_at: new Date().toISOString(),
  sort_order: -100,
  channel_group: "Ulusal",
  sub_category: "Ulusal",
  country: "Türkiye",
  is_foreign: false,
  health_score: 100,
  manual_lock: true,
};

let memoryStore: DbData | null = null;
let isNode = typeof window === "undefined";

function getEmptyStore(): DbData {
  return {
    user_streams: [TG_TV_STREAM],
    home_rows: [
      {
        id: "hero-1",
        title: "Öne Çıkanlar",
        kind: "hero",
        mode: "rule",
        display: "poster",
        rule: { category: "Live TV", country: "Türkiye", sub_category: "Ulusal" },
        max_items: 8,
        position: 0,
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "row-1",
        title: "Ulusal Kanallar",
        kind: "row",
        mode: "rule",
        display: "channel",
        rule: { category: "Live TV", country: "Türkiye", sub_category: "Ulusal" },
        max_items: 40,
        position: 1,
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "row-2",
        title: "Popüler Diziler",
        kind: "row",
        mode: "rule",
        display: "poster",
        rule: { category: "Series", is_foreign: false },
        max_items: 40,
        position: 2,
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "row-3",
        title: "Filmler",
        kind: "row",
        mode: "rule",
        display: "poster",
        rule: { category: "Movies" },
        max_items: 40,
        position: 3,
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "row-4",
        title: "Yabancı Diziler",
        kind: "row",
        mode: "rule",
        display: "poster",
        rule: { category: "Series", is_foreign: true },
        max_items: 40,
        position: 4,
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "row-5",
        title: "Haber Kanalları",
        kind: "row",
        mode: "rule",
        display: "channel",
        rule: { category: "Live TV", country: "Türkiye", sub_category: "Haber" },
        max_items: 40,
        position: 5,
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "row-6",
        title: "Spor Kanalları",
        kind: "row",
        mode: "rule",
        display: "channel",
        rule: { category: "Live TV", country: "Türkiye", sub_category: "Spor" },
        max_items: 40,
        position: 6,
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "row-7",
        title: "Çocuk Kanalları",
        kind: "row",
        mode: "rule",
        display: "channel",
        rule: { category: "Live TV", country: "Türkiye", sub_category: "Çocuk" },
        max_items: 40,
        position: 7,
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    home_row_items: [],
    layout_sections: [
      { id: "s1", key: "hero", title: "Öne Çıkanlar (Slider)", kind: "hero", position: 0, enabled: true },
      { id: "s2", key: "series_tr", title: "Popüler Diziler", kind: "row", position: 1, enabled: true },
      { id: "s3", key: "series_foreign", title: "Yabancı Diziler", kind: "row", position: 2, enabled: true },
      { id: "s4", key: "movies", title: "Filmler", kind: "row", position: 3, enabled: true },
      { id: "s5", key: "live_tv", title: "Canlı TV", kind: "row", position: 4, enabled: true },
      { id: "s6", key: "foreign_channels", title: "Yabancı Kanallar", kind: "row", position: 5, enabled: true },
    ],
    app_settings: [
      { key: "scraper_enabled", value: true, updated_at: new Date().toISOString() },
      { key: "auto_publish", value: false, updated_at: new Date().toISOString() },
    ],
    tg_tv_schedule: [],
    archive_episodes: [],
    epg_sources: [],
    epg_programmes: [],
    automation_rules: [],
    audit_logs: [],
    system_metrics: [],
    user_roles: [
      { id: "role-1", user_id: DEFAULT_ADMIN_USER.id, role: "admin", created_at: new Date().toISOString() },
      { id: "role-2", user_id: DEFAULT_ADMIN_USER.id, role: "super_admin", created_at: new Date().toISOString() },
    ],
    user_favorites: [],
    notifications: [],
    scraper_seeds: [],
    watch_events: [],
    pending_imports: [],
  };
}

function getNodeModule(name: string) {
  try {
    return new Function("return typeof require !== 'undefined' ? require('" + name + "') : null")();
  } catch {
    return null;
  }
}

export function loadStore(): DbData {
  if (memoryStore) return memoryStore;

  const current: DbData = { ...getEmptyStore(), ...(initialData as any) };
  memoryStore = current;

  if (isNode) {
    try {
      const fs = getNodeModule("fs");
      const path = getNodeModule("path");
      if (fs && path) {
        const dbPath = path.resolve(process.cwd(), "data/database.json");
        if (fs.existsSync(dbPath)) {
          const raw = fs.readFileSync(dbPath, "utf-8");
          if (raw) {
            const parsed = JSON.parse(raw);
            Object.assign(current, parsed);
          }
        }
      }
    } catch (e) {
      console.warn("[NativeDB] Could not load from filesystem:", e);
    }
  } else {
    try {
      const local = localStorage.getItem("tg_dizi_db");
      if (local) {
        const parsed = JSON.parse(local);
        Object.assign(current, parsed);
      }
    } catch {
      // ignore
    }
    if (typeof fetch !== "undefined") {
      fetch("/api/db/data")
        .then((r) => r.json())
        .then((data) => {
          if (data && memoryStore) {
            Object.assign(memoryStore, data);
          }
        })
        .catch(() => {});
    }
  }

  // Ensure all tables are arrays
  for (const key of Object.keys(getEmptyStore()) as (keyof DbData)[]) {
    if (!Array.isArray(current[key])) {
      current[key] = [];
    }
  }

  // Ensure TG TV official channel is present
  if (!current.user_streams.some((s) => s.id === TG_TV_STREAM.id || s.title.includes("TG TV"))) {
    current.user_streams.unshift(TG_TV_STREAM);
  }

  return current;
}

export function saveStore(store: DbData): void {
  memoryStore = store;
  if (isNode) {
    try {
      const fs = getNodeModule("fs");
      const path = getNodeModule("path");
      if (fs && path) {
        const dbDir = path.resolve(process.cwd(), "data");
        if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
        const dbPath = path.resolve(dbDir, "database.json");
        fs.writeFileSync(dbPath, JSON.stringify(store, null, 2), "utf-8");
      }
    } catch (e) {
      console.warn("[NativeDB] Could not write to disk:", e);
    }
  } else {
    try {
      localStorage.setItem(
        "tg_dizi_db",
        JSON.stringify({
          user_favorites: store.user_favorites,
          notifications: store.notifications,
          app_settings: store.app_settings,
        })
      );
      if (typeof fetch !== "undefined") {
        fetch("/api/db/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(store),
        }).catch(() => {});
      }
    } catch {
      // ignore
    }
  }
}

/* ------------------------------------------------------------------ */
/* Query Builder mimicking Supabase / PostgREST API                  */
/* ------------------------------------------------------------------ */

export class QueryBuilder<T = any> implements PromiseLike<{ data: T | null; error: any; count?: number | null }> {
  private tableName: keyof DbData;
  private selectFields: string = "*";
  private countMode?: "exact" | "planned" | "estimated";
  private isHead: boolean = false;
  private filters: Array<(row: any) => boolean> = [];
  private orderFn?: (a: any, b: any) => number;
  private limitCount?: number;
  private rangeOffset: number = 0;
  private rangeLimit?: number;
  private singleResult: boolean = false;
  private maybeSingleResult: boolean = false;

  private isInsert = false;
  private isUpdate = false;
  private isDelete = false;
  private isUpsert = false;
  private upsertOptions?: { onConflict?: string; ignoreDuplicates?: boolean };
  private payload: any = null;

  constructor(tableName: keyof DbData) {
    this.tableName = tableName;
  }

  select(fields: string = "*", opts?: { count?: "exact" | "planned" | "estimated"; head?: boolean }) {
    this.selectFields = fields;
    if (opts?.count) this.countMode = opts.count;
    if (opts?.head) this.isHead = opts.head;
    return this;
  }

  insert(values: any | any[]) {
    this.isInsert = true;
    this.payload = values;
    return this;
  }

  update(values: any) {
    this.isUpdate = true;
    this.payload = values;
    return this;
  }

  delete() {
    this.isDelete = true;
    this.deleteConfirmed();
    return this;
  }

  private deleteConfirmed() {
    // marker
  }

  upsert(values: any | any[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.isUpsert = true;
    this.payload = values;
    this.upsertOptions = opts;
    return this;
  }

  not(column: string, operator: string, value: any) {
    if (operator === "is" || operator === "eq") {
      this.filters.push((row) => row[column] !== value);
    } else if (operator === "in") {
      const set = new Set(Array.isArray(value) ? value.map((v) => String(v)) : [String(value)]);
      this.filters.push((row) => !set.has(String(row[column])));
    } else {
      this.filters.push((row) => row[column] !== value);
    }
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push((row) => {
      const v = row[column];
      return v === value || String(v) === String(value);
    });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push((row) => row[column] !== value);
    return this;
  }

  gt(column: string, value: any) {
    this.filters.push((row) => row[column] > value);
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push((row) => row[column] >= value);
    return this;
  }

  lt(column: string, value: any) {
    this.filters.push((row) => row[column] < value);
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push((row) => row[column] <= value);
    return this;
  }

  is(column: string, value: any) {
    this.filters.push((row) => row[column] === value || (value === null && row[column] == null));
    return this;
  }

  in(column: string, values: any[]) {
    const set = new Set(values.map((v) => String(v)));
    this.filters.push((row) => set.has(String(row[column])));
    return this;
  }

  like(column: string, pattern: string) {
    const re = new RegExp("^" + pattern.replace(/%/g, ".*").replace(/_/g, ".") + "$");
    this.filters.push((row) => re.test(String(row[column] ?? "")));
    return this;
  }

  ilike(column: string, pattern: string) {
    const cleanPattern = pattern.replace(/^%+|%+$/g, "").toLowerCase();
    this.filters.push((row) => String(row[column] ?? "").toLowerCase().includes(cleanPattern));
    return this;
  }

  contains(column: string, value: any) {
    this.filters.push((row) => {
      const field = row[column];
      if (Array.isArray(field)) {
        if (Array.isArray(value)) return value.every((v) => field.includes(v));
        return field.includes(value);
      }
      if (typeof field === "object" && field !== null) {
        return Object.entries(value).every(([k, v]) => field[k] === v);
      }
      return false;
    });
    return this;
  }

  or(conditionStr: string) {
    // Basic support for e.g. "title.ilike.%foo%,description.ilike.%foo%"
    const conditions = conditionStr.split(",").map((c) => c.trim());
    this.filters.push((row) => {
      return conditions.some((cond) => {
        const parts = cond.split(".");
        if (parts.length >= 3) {
          const col = parts[0];
          const op = parts[1];
          const val = parts.slice(2).join(".");
          if (op === "eq") return String(row[col]) === val;
          if (op === "ilike") return String(row[col] ?? "").toLowerCase().includes(val.replace(/%/g, "").toLowerCase());
        }
        return false;
      });
    });
    return this;
  }

  order(column: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    const asc = opts?.ascending !== false;
    const prevOrder = this.orderFn;
    this.orderFn = (a, b) => {
      if (prevOrder) {
        const r = prevOrder(a, b);
        if (r !== 0) return r;
      }
      const valA = a[column];
      const valB = b[column];
      if (valA === valB) return 0;
      if (valA == null) return asc ? 1 : -1;
      if (valB == null) return asc ? -1 : 1;
      if (valA < valB) return asc ? -1 : 1;
      return asc ? 1 : -1;
    };
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number) {
    this.rangeOffset = from;
    this.rangeLimit = to - from + 1;
    return this;
  }

  single() {
    this.singleResult = true;
    return this;
  }

  maybeSingle() {
    this.maybeSingleResult = true;
    return this;
  }

  private execute(): { data: any; error: any; count?: number | null } {
    const store = loadStore();
    const table = store[this.tableName];
    if (!Array.isArray(table)) {
      return { data: null, error: new Error(`Table ${String(this.tableName)} does not exist`) };
    }

    // INSERT
    if (this.isInsert) {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload];
      const inserted: any[] = [];
      for (const item of items) {
        const newItem = {
          id: item.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `item-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`),
          created_at: item.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...item,
        };
        table.unshift(newItem);
        inserted.push(newItem);
      }
      saveStore(store);
      return { data: Array.isArray(this.payload) ? inserted : inserted[0], error: null };
    }

    // UPSERT
    if (this.isUpsert) {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload];
      const upserted: any[] = [];
      const conflictCol = this.upsertOptions?.onConflict;
      for (const item of items) {
        let existingIdx = -1;
        if (conflictCol && item[conflictCol] !== undefined) {
          existingIdx = table.findIndex((r) => r[conflictCol] === item[conflictCol]);
        } else if (item.id) {
          existingIdx = table.findIndex((r) => r.id === item.id);
        } else if (item.url) {
          existingIdx = table.findIndex((r) => r.url === item.url);
        } else if (item.source_url) {
          existingIdx = table.findIndex((r) => r.source_url === item.source_url);
        } else if (item.key) {
          existingIdx = table.findIndex((r) => r.key === item.key);
        }

        if (existingIdx >= 0) {
          if (this.upsertOptions?.ignoreDuplicates) {
            upserted.push(table[existingIdx]);
          } else {
            table[existingIdx] = { ...table[existingIdx], ...item, updated_at: new Date().toISOString() };
            upserted.push(table[existingIdx]);
          }
        } else {
          const newItem = {
            id: item.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`),
            created_at: item.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...item,
          };
          table.unshift(newItem);
          upserted.push(newItem);
        }
      }
      saveStore(store);
      return { data: Array.isArray(this.payload) ? upserted : upserted[0], error: null };
    }

    // UPDATE
    if (this.isUpdate) {
      let updatedCount = 0;
      const updated: any[] = [];
      for (let i = 0; i < table.length; i++) {
        if (this.filters.every((f) => f(table[i]))) {
          table[i] = { ...table[i], ...this.payload, updated_at: new Date().toISOString() };
          updated.push(table[i]);
          updatedCount++;
        }
      }
      saveStore(store);
      return { data: updated, error: null, count: updatedCount };
    }

    // DELETE
    if (this.isDelete) {
      const remaining: any[] = [];
      let deletedCount = 0;
      for (const row of table) {
        if (this.filters.every((f) => f(row))) {
          deletedCount++;
        } else {
          remaining.push(row);
        }
      }
      store[this.tableName] = remaining;
      saveStore(store);
      return { data: null, error: null, count: deletedCount };
    }

    // SELECT
    let result = table.filter((row) => this.filters.every((f) => f(row)));
    const totalCount = result.length;

    if (this.orderFn) {
      result.sort(this.orderFn);
    }

    if (this.rangeLimit != null) {
      result = result.slice(this.rangeOffset, this.rangeOffset + this.rangeLimit);
    } else if (this.rangeOffset > 0) {
      result = result.slice(this.rangeOffset);
    }

    if (this.limitCount != null) {
      result = result.slice(0, this.limitCount);
    }

    if (this.isHead) {
      return { data: null, error: null, count: totalCount };
    }

    if (this.singleResult) {
      if (result.length === 0) return { data: null, error: new Error("Row not found"), count: 0 };
      return { data: result[0], error: null, count: 1 };
    }

    if (this.maybeSingleResult) {
      return { data: result.length > 0 ? result[0] : null, error: null, count: result.length };
    }

    return {
      data: result,
      error: null,
      count: this.countMode ? totalCount : undefined,
    };
  }

  then<TResult1 = { data: T | null; error: any; count?: number | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: T | null; error: any; count?: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    const res = this.execute();
    return Promise.resolve(res).then(onfulfilled, onrejected);
  }
}

/* ------------------------------------------------------------------ */
/* Auth implementation                                                */
/* ------------------------------------------------------------------ */

export class NativeAuth {
  admin = {
    listUsers: async (_params?: any) => ({
      data: { users: [DEFAULT_ADMIN_USER] },
      error: null,
    }),
    deleteUser: async (_id: string) => ({ error: null }),
  };

  private session = {
    access_token: "tg-native-admin-token",
    token_type: "bearer",
    expires_in: 3600000,
    refresh_token: "tg-refresh",
    user: DEFAULT_ADMIN_USER,
  };
  private listeners: Array<(event: string, session: any) => void> = [];

  async getSession() {
    return { data: { session: this.session }, error: null };
  }

  async getUser() {
    return { data: { user: this.session.user }, error: null };
  }

  async getClaims(_token?: string) {
    return {
      data: {
        claims: {
          sub: this.session.user.id,
          email: this.session.user.email,
          role: "admin",
        },
      },
      error: null,
    };
  }

  async signInWithPassword({ email, password }: { email: string; password?: string }) {
    this.session = {
      ...this.session,
      user: {
        ...DEFAULT_ADMIN_USER,
        email: email || DEFAULT_ADMIN_USER.email,
      },
    };
    this.notify("SIGNED_IN");
    return { data: { user: this.session.user, session: this.session }, error: null };
  }

  async signInWithOAuth(_provider: string, _opts?: any) {
    this.notify("SIGNED_IN");
    return { data: { provider: "google", url: null }, error: null };
  }

  async signOut() {
    this.notify("SIGNED_OUT");
    return { error: null };
  }

  async setSession(tokens: any) {
    if (tokens) {
      this.session = { ...this.session, ...tokens };
      this.notify("TOKEN_REFRESHED");
    }
    return { data: { session: this.session }, error: null };
  }

  onAuthStateChange(callback: (event: string, session: any) => void) {
    this.listeners.push(callback);
    // Invoke immediately with current session
    setTimeout(() => callback("INITIAL_SESSION", this.session), 0);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.listeners = this.listeners.filter((l) => l !== callback);
          },
        },
      },
    };
  }

  private notify(event: string) {
    for (const l of this.listeners) {
      try {
        l(event, this.session);
      } catch (e) {
        console.error(e);
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Realtime Channel implementation                                    */
/* ------------------------------------------------------------------ */

class NativeChannel {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
  on(_event: string, _opts: any, _callback: (payload: any) => void) {
    return this;
  }
  subscribe() {
    return this;
  }
  unsubscribe() {}
}

/* ------------------------------------------------------------------ */
/* Supabase Client API compatible Native Client                       */
/* ------------------------------------------------------------------ */

export class NativeClient {
  auth = new NativeAuth();

  from<T = any>(table: keyof DbData | string): QueryBuilder<T> {
    return new QueryBuilder<T>(table as keyof DbData);
  }

  async rpc(fnName: string, args?: any): Promise<{ data: any; error: any }> {
    const store = loadStore();

    if (fnName === "has_role") {
      const role = args?._role || args?.role || "admin";
      const uid = args?._user_id || args?.user_id;
      const has = store.user_roles.some(
        (r) => (r.role === role || r.role === "super_admin") && (!uid || r.user_id === uid || uid === DEFAULT_ADMIN_USER.id)
      );
      return { data: has || role === "admin", error: null };
    }

    if (fnName === "get_system_status") {
      const active = store.user_streams.filter((s) => s.is_active && !s.deleted_at).length;
      const quarantine = store.user_streams.filter((s) => !s.is_active && !s.deleted_at).length;
      return {
        data: {
          active_count: active,
          quarantine_count: quarantine,
          last_check_at: new Date().toISOString(),
        },
        error: null,
      };
    }

    if (fnName === "stream_facets") {
      const countries: Record<string, number> = {};
      const subcats: Record<string, number> = {};
      for (const s of store.user_streams) {
        if (s.deleted_at) continue;
        const c = s.country || "";
        countries[c] = (countries[c] || 0) + 1;
        const sub = s.sub_category || "";
        subcats[sub] = (subcats[sub] || 0) + 1;
      }
      const facets = [
        ...Object.entries(countries).map(([val, n]) => ({ kind: "country", value: val, n })),
        ...Object.entries(subcats).map(([val, n]) => ({ kind: "sub_category", value: val, n })),
      ];
      return { data: facets, error: null };
    }

    return { data: null, error: null };
  }

  channel(name: string) {
    return new NativeChannel(name);
  }

  removeChannel(_channel: any) {}
}

export const nativeDb = new NativeClient();
