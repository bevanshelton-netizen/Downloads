import { createOrganisation } from "./actions";
import { requireUser } from "@/lib/auth/require-user";
import { redirect } from "next/navigation";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("tenant_members").select("tenant_id").limit(1);
  if (data?.length) redirect("/dashboard");
  const params = await searchParams;
  return <main className="mx-auto min-h-screen max-w-xl px-6 py-16">
    <h1 className="text-4xl font-bold">Create your organisation</h1>
    <p className="mt-3 text-slate-600">This becomes the secure workspace for your website and support requests.</p>
    {params.error && <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-900">{params.error}</p>}
    <form action={createOrganisation} className="mt-8 space-y-5 rounded-2xl border bg-white p-6 shadow-sm">
      <label className="block text-sm font-semibold">Organisation name<input name="name" required maxLength={100} className="mt-2 w-full rounded-xl border px-4 py-3" /></label>
      <label className="block text-sm font-semibold">Preferred web name<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="my-business" className="mt-2 w-full rounded-xl border px-4 py-3" /></label>
      <p className="text-xs text-slate-500">Use lowercase letters, numbers and hyphens only.</p>
      <button className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950">Create secure workspace</button>
    </form>
  </main>;
}
