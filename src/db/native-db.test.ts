import test from "node:test";
import assert from "node:assert/strict";
import { loadStore, nativeDb } from "./native-db";

test("Database loads initial exported data correctly", () => {
  const store = loadStore();
  assert.ok(store.user_streams.length >= 4000, `Expected over 4000 streams, got ${store.user_streams.length}`);
  assert.ok(store.home_rows.length >= 8, `Expected at least 8 home rows, got ${store.home_rows.length}`);
  assert.ok(store.layout_sections.length >= 6, `Expected at least 6 layout sections, got ${store.layout_sections.length}`);
});

test("TG TV channel with custom logo is configured as featured", async () => {
  const { data } = await nativeDb.from("user_streams").select("*").eq("id", "tgtv-official-channel").maybeSingle();
  assert.ok(data, "TG TV stream should exist");
  assert.equal(data.logo_url, "/assets/aistudio/Media_item_1_1bba30da.jpg");
  assert.equal(data.poster_url, "/assets/aistudio/Media_item_1_1bba30da.jpg");
  assert.equal(data.category, "Live TV");
  assert.equal(data.is_active, true);
});

test("QueryBuilder filters streams by category and active status", async () => {
  const { data, count } = await nativeDb
    .from("user_streams")
    .select("*", { count: "exact" })
    .eq("category", "Live TV")
    .eq("is_active", true)
    .limit(10);

  assert.ok(Array.isArray(data));
  assert.equal(data.length, 10);
  assert.ok((count ?? 0) > 10, "Count should be greater than 10");
  for (const item of data) {
    assert.equal(item.category, "Live TV");
    assert.equal(item.is_active, true);
  }
});

test("Auth provider returns admin role and session", async () => {
  const { data: sessionData } = await nativeDb.auth.getSession();
  assert.ok(sessionData?.session, "Session should exist");
  assert.ok(sessionData.session.access_token, "Access token should be present");

  const { data: roleCheck } = await nativeDb.rpc("has_role", { _role: "admin" });
  assert.equal(roleCheck, true, "Admin role check should return true");
});

test("System status RPC returns accurate stream counts", async () => {
  const { data: status } = await nativeDb.rpc("get_system_status");
  assert.ok(status, "Status should be returned");
  assert.ok(typeof status.active_count === "number" && status.active_count > 0);
  assert.ok(typeof status.quarantine_count === "number");
});
