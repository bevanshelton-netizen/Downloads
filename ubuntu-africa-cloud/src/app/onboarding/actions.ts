"use server";

import { redirect } from "next/navigation";
import { tenantSchema } from "@/lib/validation/tenant";
import { requireUser } from "@/lib/auth/require-user";

export async function createOrganisation(formData: FormData) {
  const parsed = tenantSchema.safeParse({ name: formData.get("name"), slug: formData.get("slug") });
  if (!parsed.success) redirect("/onboarding?error=Enter%20a%20valid%20organisation%20name%20and%20simple%20web%20address.");

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("create_tenant_for_current_user", {
    tenant_name: parsed.data.name,
    tenant_slug: parsed.data.slug,
  });
  if (error) redirect("/onboarding?error=That%20web%20address%20may%20already%20be%20in%20use.");
  redirect("/dashboard");
}
