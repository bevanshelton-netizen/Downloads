import Link from "next/link";
import { login } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  return <main className="mx-auto min-h-screen max-w-md px-6 py-16">
    <Link href="/" className="text-sm font-semibold">← Ubuntu Africa Cloud</Link>
    <h1 className="mt-8 text-4xl font-bold">Sign in</h1>
    {params.message && <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">{params.message}</p>}
    {params.error && <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-900">{params.error}</p>}
    <form action={login} className="mt-8 space-y-5 rounded-2xl border bg-white p-6 shadow-sm">
      <label className="block text-sm font-semibold">Email<input name="email" type="email" required autoComplete="email" className="mt-2 w-full rounded-xl border px-4 py-3" /></label>
      <label className="block text-sm font-semibold">Password<input name="password" type="password" required autoComplete="current-password" minLength={8} className="mt-2 w-full rounded-xl border px-4 py-3" /></label>
      <button className="w-full rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white">Sign in</button>
    </form>
    <p className="mt-6 text-sm">No account? <Link href="/register" className="font-semibold underline">Join the pilot</Link></p>
  </main>;
}
