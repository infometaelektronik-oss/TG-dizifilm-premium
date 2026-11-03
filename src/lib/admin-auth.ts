// SERVER-ONLY admin authorization helpers.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function assertAdminRole(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Yalnızca adminler bu işlemi yapabilir.");
}
