import { createMiddleware } from "@tanstack/react-start";
import { nativeDb } from "@/db/native-db";

export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const { data } = await nativeDb.auth.getSession();
    const token = data?.session?.access_token || "tg-native-admin-token";
    return next({
      headers: { Authorization: `Bearer ${token}` },
    });
  }
);
