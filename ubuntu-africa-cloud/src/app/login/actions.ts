"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(128),
});

export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) redirect("/login?error=Please%20enter%20a%20valid%20email%20and%20password.");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect("/login?error=Login%20failed.%20Check%20your%20details%20or%20verify%20your%20email.");
  redirect("/dashboard");
}
