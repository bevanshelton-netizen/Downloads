"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const registrationSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.email().max(254),
  password: z.string().min(10).max(128)
    .regex(/[A-Z]/, "uppercase")
    .regex(/[a-z]/, "lowercase")
    .regex(/[0-9]/, "number"),
});

export async function register(formData: FormData) {
  const parsed = registrationSchema.safeParse({
    fullName: formData.get("fullName"), email: formData.get("email"), password: formData.get("password"),
  });
  if (!parsed.success) redirect("/register?error=Use%20a%20valid%20email%20and%20a%2010-character%20password%20with%20upper%2C%20lower%20and%20number.");

  const supabase = await createClient();
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${appUrl}/auth/confirm`,
      data: { full_name: parsed.data.fullName },
    },
  });
  if (error) redirect("/register?error=Registration%20could%20not%20be%20completed.");
  redirect("/login?message=Check%20your%20email%20to%20confirm%20your%20account.");
}
