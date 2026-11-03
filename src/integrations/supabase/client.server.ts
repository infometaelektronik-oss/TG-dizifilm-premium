import { nativeDb } from "@/db/native-db";

export const supabaseAdmin = nativeDb;
export const createSupabaseAdminClient = () => nativeDb;
export default supabaseAdmin;
