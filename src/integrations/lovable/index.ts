import { nativeDb } from "../supabase/client";

export const lovable = {
  auth: {
    signInWithOAuth: async (_provider: "google" | "apple" | "microsoft" | "lovable", _opts?: any) => {
      await nativeDb.auth.signInWithPassword({ email: "admin@tgdizifilm.app" });
      const user = (await nativeDb.auth.getUser()).data.user;
      return { data: { user, session: (await nativeDb.auth.getSession()).data.session } };
    },
    signOut: async () => {
      await nativeDb.auth.signOut();
    },
    getUser: async () => {
      return (await nativeDb.auth.getUser()).data;
    },
    getSession: async () => {
      return (await nativeDb.auth.getSession()).data;
    },
  },
};

export default lovable;
