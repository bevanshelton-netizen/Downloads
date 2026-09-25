import Link from "next/link";
import { register } from "./actions";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return <main className="mx-auto min-h-screen max-w-md px-6 py-16">
    <Link href="/" className="text-sm font-semibold">← Ubuntu Africa Cloud</Link>
    <h1 className="mt-8 text-4xl font-bold">Join the pilot</h1>
    <p className="mt-3 text-slate-600">Create your personal login first. Your organisation is added after email verification.</p>
    {params.error && <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-900">{params.error}</p>}
    <form action={register} className="mt-8 space-y-5 rounded-2xl border bg-white p-6 shadow-sm">
      <label className="block text-sm font-semibold">Full name<input name="fullName" required maxLength={100} className="mt-2 w-full rounded-xl border px-4 py-3" /></label>
      <label className="block text-sm font-semibold">Email<input name="email" type="email" required autoComplete="email" className="mt-2 w-full rounded-xl border px-4 py-3" /></label>
      <label className="block text-sm font-semibold">Password<input name="password" type="password" required autoComplete="new-password" minLength={10} className="mt-2 w-full rounded-xl border px-4 py-3" /></label>
      <p className="text-xs text-slate-500">At least 10 characters with uppercase, lowercase and a number.</p>
      <button className="w-full rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950">Create account</button>
    </form>
  </main>;
}
