import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requirePlatformAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");
  const { data: admin } = await supabase.from("platform_admins").select("role").eq("user_id", user.id).maybeSingle();
  if (!admin) redirect("/dashboard");
  return { supabase, user, role: admin.role };
}
