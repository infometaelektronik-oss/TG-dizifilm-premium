import { nativeDb } from "@/db/native-db";

export { nativeDb };
export const supabase = nativeDb;
export const createClient = () => nativeDb;
export default supabase;
