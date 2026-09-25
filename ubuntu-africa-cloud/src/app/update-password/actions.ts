"use server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
export async function updatePassword(formData: FormData){const p=String(formData.get("password")??""); if(p.length<10) return; const supabase=await createClient(); await supabase.auth.updateUser({password:p}); redirect("/dashboard");}
