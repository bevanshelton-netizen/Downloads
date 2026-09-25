"use server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
export async function resetRequest(formData: FormData){const email=String(formData.get("email")??"").trim(); const supabase=await createClient(); const appUrl=process.env.APP_URL; if(email && appUrl) await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${appUrl}/update-password`}); redirect("/login?reset=sent");}
