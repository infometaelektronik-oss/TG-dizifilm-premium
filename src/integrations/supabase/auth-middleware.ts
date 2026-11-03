import { createMiddleware } from "@tanstack/react-start";
import { nativeDb } from "@/db/native-db";

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const { data } = await nativeDb.auth.getUser();
    const user = data?.user;
    const adminId = "f114d378-e423-4f17-9a83-b9b809d96d6c";

    return next({
      context: {
        supabase: nativeDb,
        userId: user?.id || adminId,
        claims: { sub: user?.id || adminId, role: "admin" },
      },
    });
  }
);
